// engine.js — المحرك الرئيسي: يجمع كل الأجزاء بدورة لعبة كاملة (يد واحدة + مباراة كاملة)

import { HandRuleError } from "./deal.js";
import { dealInitial, completeDealAfterPurchase } from "./deal.js";
import { BiddingState, BidChoice } from "./bidding.js";
import { validatePlay, determineTrickWinner } from "./trick.js";
import { DoublingState, SunDoublingState } from "./doubling.js";
import { detectBestProject, resolveProjectPriority } from "./projects.js";
import { scoreHand, PendingPot } from "./scoring.js";

export { HandRuleError };

const MATCH_TARGET = 152;

export class BalootMatch {
  /// seatOrder: 4 معرّفات لاعبين بترتيب الجلوس الثابت [يمين, صدر, يسار, دلر] وقت أول يد
  /// teamOfPlayer(playerID) => "A" | "B" (تُمرَّر من المستدعي، ثابتة طول المباراة)
  constructor(seatOrder, teamOfPlayer) {
    this.baseSeatOrder = seatOrder; // ثابت - يمثّل مقاعد الجلوس الفيزيائية
    this.teamOfPlayer = teamOfPlayer;
    this.partnerOfID = (id) => {
      const idx = seatOrder.indexOf(id);
      // بما إن الفرق تتقابل، شريك أي مقعد هو المقعد المقابل (idx و idx+2 بالدوران الدائري لـ4 مقاعد)
      return seatOrder[(idx + 2) % 4];
    };
    this.cumulativeScores = { A: 0, B: 0 };
    this.pendingPot = new PendingPot();
    this.dealerIndex = 0; // index بـ baseSeatOrder لمين يوزّع هالجولة
    this.matchOver = false;
    this.matchWinner = null; // "A" | "B"
    this.matchEndReason = null;

    this._startNewHand();
  }

  get dealerID() {
    return this.baseSeatOrder[this.dealerIndex];
  }

  /// ترتيب المزايدة/التوزيع لهذي اليد: يبدأ من يمين الموزّع الحالي
  _seatOrderForThisHand() {
    const order = [];
    for (let i = 1; i <= 4; i++) {
      order.push(this.baseSeatOrder[(this.dealerIndex + i) % 4]);
    }
    return order; // [يمين الموزّع, صدره, يسار الموزّع, الموزّع] - آخر واحد بالمصفوفة هو الموزّع نفسه
  }

  _startNewHand() {
    const seatOrder = this._seatOrderForThisHand();
    this.currentSeatOrder = seatOrder;
    const dealt = dealInitial(seatOrder);
    this.hands = dealt.hands;
    this.flippedCard = dealt.flippedCard;
    this._remainingDeckAfterInitial = dealt.remainingDeck;
    this.bidding = new BiddingState(seatOrder, this.flippedCard.suit, this.teamOfPlayer);
    this.phase = "bidding";
    this.doubling = null;
    this.sunDoubling = null;
    this.tricksWon = []; // [{playerID, cards}]
    this.currentTrick = []; // [{playerID, card}] الشوط الجاري
    this.completedTrick = null; // شوط اكتمل (4 ورق) بس لسه ينتظر الواجهة تعرضه قبل ما ينكسح
    this.projectsAnnounced = new Map(); // playerID -> project object (بعد الكشف الفعلي)
    this.handResult = null;
    this.projectsResolved = false; // يُصفّر كل يد جديدة - يضمن resolveProjects تُستدعى مرة وحدة بالوقت الصحيح
    this.projectEntries = null;
    this.projectResult = null;
    this.projectPoints = null;
  }

  // ===== المزايدة =====

  submitBid(playerID, choice, trumpSuitForHukm = null) {
    if (this.phase !== "bidding") throw new HandRuleError("مو وقت المزايدة الحين");
    const result = this.bidding.submitBid(playerID, choice, trumpSuitForHukm);

    if (this.bidding.isDead) {
      this.phase = "dead";
      return { dead: true };
    }
    if (result) {
      this._completePurchase(result);
    }
    return result;
  }

  _completePurchase(bidResult) {
    const { buyerID, isAshkal, trumpSuit } = bidResult;
    const completed = completeDealAfterPurchase(
      { hands: this.hands, remainingDeck: this._remainingDeckAfterInitial, flippedCard: this.flippedCard },
      this.currentSeatOrder, buyerID, isAshkal, this.partnerOfID
    );
    this.hands = completed.hands;
    this.trumpSuit = trumpSuit;
    this.isHukm = trumpSuit !== null;
    this.buyerID = buyerID;
    this.buyerTeam = this.teamOfPlayer(buyerID);
    this.opponentTeam = this.buyerTeam === "A" ? "B" : "A";

    this._setupBalootEligibility();

    if (this.isHukm) {
      this.doubling = new DoublingState(this.buyerTeam, this.opponentTeam, true);
      this.phase = "doubling"; // نافذة الدبل قبل أول رمية
    } else {
      // صن (بأي طريقة وصلنا له - شراء مباشر، رفع حكم معلّق، أو اشكل) - نفحص شرط دبل الصن المنفصل
      const sunDoubling = new SunDoublingState(
        this.buyerTeam, this.opponentTeam,
        this.cumulativeScores[this.buyerTeam], this.cumulativeScores[this.opponentTeam]
      );
      if (sunDoubling.canOffer()) {
        this.sunDoubling = sunDoubling;
        this.phase = "sunDoubling"; // نافذة قرار وحيد للخصم: دبل صن أو لعب عادي
      } else {
        this.phase = "playing";
        this._firstPlayerID = this.currentSeatOrder[0];
        this.turnPlayerID = this._firstPlayerID;
      }
    }
  }

  // ===== دبل الصن (منفصل تماماً عن دبل الحكم) =====

  /// الخصم يقرر: doubled=true (دبل صن ×2) أو false (لعب عادي) - قرار وحيد نهائي
  decideSunDouble(teamID, doubled) {
    if (this.phase !== "sunDoubling") throw new HandRuleError("نافذة دبل الصن مغلقة الحين");
    this.sunDoubling.decide(teamID, doubled);
    this.phase = "playing";
    this._firstPlayerID = this.currentSeatOrder[0];
    this.turnPlayerID = this._firstPlayerID;
  }

  // ===== الدبل (بس بالحكم) =====

  requestDouble(teamID) {
    if (this.phase !== "doubling") throw new HandRuleError("نافذة الدبل مغلقة الحين");
    const level = this.doubling.requestNextLevel(teamID);
    if (this.doubling.isMatchEndingKahwa) {
      this._kahwaActive = true;
    }
    return level;
  }

  /// أي طرف يقرر عدم رفع التحدي أكثر - ينتقل للعب
  proceedToPlay() {
    if (this.phase !== "doubling") throw new HandRuleError("مو وقت بدء اللعب الحين");
    this.phase = "playing";
    this._firstPlayerID = this.currentSeatOrder[0];
    this.turnPlayerID = this._firstPlayerID;
  }

  // ===== إعلان المشاريع (مبسّط: يُستدعى مرة وحدة بأول شوط، يحسب أفضل مشروع لكل لاعب تلقائياً) =====

  /// يُستدعى بعد اكتمال اليد (كل الأوراق موزّعة، قبل الشوط الأول) لتحديد الفريق الفائز بالمشاريع
  resolveProjects() {
    this.projectsResolved = true;
    const entries = this.currentSeatOrder.map((playerID) => ({
      playerID,
      project: detectBestProject(this.hands.get(playerID), this.isHukm),
    }));
    this.projectEntries = entries; // يخزّن للواجهة - مين عنده وش مشروع
    const teamA = entries.filter((e) => this.teamOfPlayer(e.playerID) === "A");
    const teamB = entries.filter((e) => this.teamOfPlayer(e.playerID) === "B");

    const seatPriority = (id) => this.currentSeatOrder.indexOf(id); // 0=يمين، 1=صدر، 2=يسار، 3=الموزّع (أصغر=أقرب لدور اللعب)
    const result = resolveProjectPriority(teamA, teamB, this.trumpSuit, seatPriority);

    this.projectResult = result;
    if (result.winningTeam === "A") {
      this.projectPoints = { A: teamA.reduce((s, e) => s + (e.project ? projectPointsOf(e.project) : 0), 0), B: 0 };
    } else if (result.winningTeam === "B") {
      this.projectPoints = { A: 0, B: teamB.reduce((s, e) => s + (e.project ? projectPointsOf(e.project) : 0), 0) };
    } else {
      this.projectPoints = { A: 0, B: 0 };
    }
    return result;
  }

  /// يفحص كل لاعب: هل يملك الشايب+البنت من لون الحكم؟ لو نعم، يفعّل له راية "يقدر يعلن بلوت"
  _setupBalootEligibility() {
    this.balootState = new Map(); // playerID -> { eligible, announced, cardsPlayed: Set<cardId>, confirmed }
    if (!this.isHukm) return;
    for (const playerID of this.currentSeatOrder) {
      const hand = this.hands.get(playerID);
      const hasKing = hand.some((c) => c.suit === this.trumpSuit && c.rank === 13); // King
      const hasQueen = hand.some((c) => c.suit === this.trumpSuit && c.rank === 12); // Queen
      if (hasKing && hasQueen) {
        this.balootState.set(playerID, { eligible: true, announced: false, cardsPlayed: new Set(), confirmed: false });
      }
    }
  }

  /// يُستدعى من playCard كل ما يرمي لاعب مؤهل ورقة من زوج البلوت (K أو Q من الحكم)
  /// isBalootPressed: هل ضغط اللاعب زر "بلوت" وقت هذي الرمية بالذات (يُرسل من الواجهة)
  _trackBalootPlay(playerID, card, isBalootPressed) {
    const state = this.balootState?.get(playerID);
    if (!state || !state.eligible) return;
    const isBalootCard = card.suit === this.trumpSuit && (card.rank === 12 || card.rank === 13);
    if (!isBalootCard) return;

    const isFirstOfPair = state.cardsPlayed.size === 0;
    state.cardsPlayed.add(card.id);

    if (isFirstOfPair) {
      if (isBalootPressed) {
        state.announced = true;
      } else {
        // ما أعلن بالورقة الأولى - يسقط حقه للأبد بهذي اليد، حتى لو أعلن لاحقاً بالثانية
        state.eligible = false;
      }
    } else if (state.cardsPlayed.size === 2 && state.announced) {
      // هذي الورقة الثانية من الزوج، وأُعلن صح بالأولى - تُحتسب النقاط
      state.confirmed = true;
    }
  }

  /// فحص بدون أي تعديل - يستخدمه الواجهة لتعطيل الورق غير القانوني مسبقاً (فلسفة المنع بدل العقوبة)
  isCardLegal(playerID, card) {
    if (this.phase !== "playing" || playerID !== this.turnPlayerID) return false;
    try {
      validatePlay({
        hand: this.hands.get(playerID), card, cardsPlayed: this.currentTrick,
        trumpSuit: this.trumpSuit, partnerOfID: this.partnerOfID, playerID,
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  // ===== اللعب =====

  playCard(playerID, card, isBalootPressed = false) {
    if (this.phase !== "playing") throw new HandRuleError("مو وقت اللعب الحين");
    if (this.completedTrick) throw new HandRuleError("لسه ما انكسح الشوط السابق - انتظر");
    if (playerID !== this.turnPlayerID) throw new HandRuleError("مو دورك");

    const hand = this.hands.get(playerID);
    validatePlay({
      hand, card, cardsPlayed: this.currentTrick,
      trumpSuit: this.trumpSuit, partnerOfID: this.partnerOfID, playerID,
    });

    const idx = hand.findIndex((c) => c.id === card.id);
    hand.splice(idx, 1);
    this.currentTrick.push({ playerID, card });
    this._trackBalootPlay(playerID, card, isBalootPressed);

    if (this.currentTrick.length === 4) {
      const winnerID = determineTrickWinner(this.currentTrick, this.trumpSuit);
      this.tricksWon.push({
        playerID: winnerID,
        cards: this.currentTrick.map((e) => e.card),
        plays: this.currentTrick.map((e) => ({ playerID: e.playerID, card: e.card })), // تفصيل مين رمى وش بالضبط - يفيد تتبع الفراغات
      });
      // لا نصفّر currentTrick هنا فوراً - نخليه ظاهر (completedTrick) حتى تستدعي الواجهة clearCompletedTrick()
      // بعد وقفة كافية (2-3 ثواني) يشوف فيها كل اللاعبين الشوط كامل قبل ما ينكسح
      this.completedTrick = this.currentTrick;
      this.currentTrick = [];
      this.turnPlayerID = winnerID; // الفائز بالشوط يبدأ اللي بعده

      if (this.tricksWon.length === 8) {
        this._finishHand();
        return { trickComplete: true, winnerID, handComplete: true };
      }
      return { trickComplete: true, winnerID, handComplete: false };
    }

    // الدور ينتقل لليّلي بعده بترتيب الجلوس الفيزيائي (مو ترتيب المزايدة)
    const seatIdx = this.baseSeatOrder.indexOf(playerID);
    this.turnPlayerID = this.baseSeatOrder[(seatIdx + 1) % 4];
    return { trickComplete: false };
  }

  /// تُستدعى من الواجهة بعد وقفة كافية لعرض الشوط المكتمل - تصفّر completedTrick فعلياً
  clearCompletedTrick() {
    this.completedTrick = null;
  }

  _finishHand() {
    const capotTeam = this._detectCapotTeam();
    const lastTrickWinnerTeam = this.teamOfPlayer(this.tricksWon[this.tricksWon.length - 1].playerID);

    const balootPointsByTeam = this._detectBalootPoints();

    const result = scoreHand({
      tricksWon: this.tricksWon,
      trumpSuit: this.trumpSuit,
      isHukm: this.isHukm,
      lastTrickWinnerTeam,
      capotTeam,
      teamOfPlayer: this.teamOfPlayer,
      buyerTeam: this.buyerTeam,
      projectPointsByTeam: this.projectPoints ?? { A: 0, B: 0 },
      doubleMultiplier: this.doubling?.multiplier ?? this.sunDoubling?.multiplier ?? 1,
      balootPointsByTeam,
    });

    // استثناء الدبل: تعادل + دبل فعّال = لا تعليق، الفريق المتحدّي يخسر فوراً (نطبّقه هنا فوق نتيجة scoreHand العامة)
    if (result.isPending && this.doubling && this.doubling.level > 0) {
      const loserTeam = this.buyerTeam; // بالتعادل، "المتحدّي" بالسياق العام هو من فشل بتحقيق الأغلبية = صاحب النقاط المعلّقة
      const winnerTeam = loserTeam === "A" ? "B" : "A";
      const totalNet = (result.A + result.B + result.pendingAmount); // نجمع كل شي كان بالتعليق فوق الفوري
      result.isPending = false;
      result[winnerTeam] = totalNet;
      result[loserTeam] = 0;
      result.isDefeat = true;
      result.doubleTieOverride = true;
    }

    this.handResult = result;

    const released = this.pendingPot.applyHandResult(result);
    this.cumulativeScores.A += result.A;
    this.cumulativeScores.B += result.B;
    if (released > 0) {
      // الفائز الفعلي بهذي اليد (مين حصل نقاط > 0 من رصيد اليد) ياخذ المتراكم
      const actualWinner = result.A > result.B ? "A" : "B";
      this.cumulativeScores[actualWinner] += released;
    }

    this.phase = "handOver";
    this._checkMatchOver();
  }

  _detectCapotTeam() {
    const teams = new Set(this.tricksWon.map((t) => this.teamOfPlayer(t.playerID)));
    return teams.size === 1 ? [...teams][0] : null;
  }

  _detectBalootPoints() {
    const points = { A: 0, B: 0 };
    if (!this.isHukm || !this.balootState) return points;
    for (const [playerID, state] of this.balootState) {
      if (state.confirmed) {
        points[this.teamOfPlayer(playerID)] += 2; // نقطتان بعد التقريب - تُضاف مباشرة فوق نقاط اليد المُقرَّبة (مش خام 20)
      }
    }
    return points;
  }

  _checkMatchOver() {
    const { A, B } = this.cumulativeScores;
    if (this._kahwaActive) {
      const winner = A > B ? "A" : B > A ? "B" : (this.buyerTeam === "A" ? "B" : "A"); // تعادل تام بالقهوة - نفس منطق الخصم يغلب المشتري احتياطاً
      this.matchOver = true;
      this.matchWinner = winner;
      this.matchEndReason = "قهوة (خمسة) - نهاية فورية بغض النظر عن الرصيد التراكمي";
      return;
    }
    if (A < MATCH_TARGET && B < MATCH_TARGET) return; // ما وصل أحد للحد بعد

    if (A >= MATCH_TARGET && B < MATCH_TARGET) {
      this.matchOver = true; this.matchWinner = "A"; this.matchEndReason = "تجاوز 152";
    } else if (B >= MATCH_TARGET && A < MATCH_TARGET) {
      this.matchOver = true; this.matchWinner = "B"; this.matchEndReason = "تجاوز 152";
    } else if (A > B) {
      this.matchOver = true; this.matchWinner = "A"; this.matchEndReason = "تجاوز الاثنين - الأعلى نقاط";
    } else if (B > A) {
      this.matchOver = true; this.matchWinner = "B"; this.matchEndReason = "تجاوز الاثنين - الأعلى نقاط";
    } else {
      // تساوي تام بعد تجاوز الاثنين - الخصم يغلب المشتري
      this.matchOver = true;
      this.matchWinner = this.opponentTeam;
      this.matchEndReason = "تعادل تام بعد التجاوز - الخصم يغلب المشتري";
    }
  }

  /// ينتقل ليد جديدة (يدور التوزيع لليمين) - يُستدعى بعد handOver أو dead
  advanceToNextHand() {
    if (this.matchOver) throw new HandRuleError("المباراة انتهت بالفعل");
    if (this.phase !== "handOver" && this.phase !== "dead") {
      throw new HandRuleError("اليد الحالية لسه ما خلصت");
    }
    this.dealerIndex = (this.dealerIndex + 1) % 4;
    this._kahwaActive = false;
    this._startNewHand();
  }
}

export function projectPointsOf(project) {
  const points = { sira: 20, khamseen: 50, mia: 100, arbaamia: 400, baloot: 20 };
  return points[project.type];
}
