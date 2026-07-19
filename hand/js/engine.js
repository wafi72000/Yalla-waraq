// engine.js — حالة الجولة ومحرك الدورة (سحب/رمي/تجديد/تتابع)

import { Deck } from "./models.js";
import { HandEscalation } from "./escalation.js";
import { HandDeclaration } from "./declaration.js";

export const DrawSource = Object.freeze({ STOCK: "stock", LEFT_DISCARD: "leftDiscard" });

// لازم تكتمل 4 لفّات (4 لاعبين × 4 = 16 سحبة) قبل ما يُفتح أخذ ورقة النار (وبالتالي النزول/الخالص)
export const MIN_DRAWS_BEFORE_LEFT_DISCARD = 16;

export class ExposedMeld {
  constructor(cards, kind, declaredByPlayerID) {
    this.id = `m${Math.random().toString(36).slice(2)}`;
    this.cards = cards;
    this.kind = kind;
    this.declaredByPlayerID = declaredByPlayerID;
  }
}

export class HandGameState {
  constructor(players) {
    this.players = players; // [{id, name, isAI, hand: []}]
    this.currentTurnIndex = 0;
    this.dealerIndex = Math.floor(Math.random() * players.length); // الموزع الأول عشوائي
    this.drawPile = Deck.handDeck();
    this.discardPile = []; // آخر عنصر = فوق الكومة
    this.exposedMelds = [];
    this.hasDrawnThisTurn = false;
    this.lastDrawSource = null; // DrawSource.STOCK أو DrawSource.LEFT_DISCARD - مصدر آخر سحبة بهذا الدور
    this.lastDrawnCardID = null; // معرّف الورقة المسحوبة هذا الدور بالضبط - يحمي الإرجاع من أي إعادة ترتيب باليد
    this.totalDrawsThisRound = 0; // لتتبع اللفّات (لفة = 4 سحبات، واحدة لكل لاعب)
    this.hasMadeProgressThisTurn = false; // نزّل أو أضاف على بير مكشوف بهذا الدور (يلزم بعد أخذ ورقة من النار)
    this.exposedActionPlayers = new Set(); // مين لمس أي بير مكشوف هذي الجولة (نزول أو إضافة) - يستبعدهم من مسار الهند/لون/قرينق المخفي
    this.cardsPlacedBy = new Map(); // playerID -> عدد الورق اللي "هو نفسه" نزّله/أضافه طول الجولة (بغض النظر عن بير مين) - سقفه 14

    this.escalation = new HandEscalation();
    this.declaration = new HandDeclaration();

    this.roundNumber = 1;
    this.totalRounds = 5;
    this.cumulativeScores = new Map(players.map((p) => [p.id, 0]));

    this.roundEndedReason = null;
    this.lastEndingTier = null;
    this.turnsThisRound = 0;
    this.maxTurnsPerRound = 600; // حماية احترازية - لو تجاوزها نعتبر الجولة عالقة
  }

  get currentTurnPlayerID() {
    return this.players[this.currentTurnIndex]?.id ?? null;
  }

  get isRoundOver() { return this.roundEndedReason !== null; }
  get isLeftDiscardUnlocked() { return this.totalDrawsThisRound >= MIN_DRAWS_BEFORE_LEFT_DISCARD; }
  get isStuck() { return !this.isRoundOver && this.turnsThisRound >= this.maxTurnsPerRound; }
  get isGameOver() { return this.roundNumber > this.totalRounds; }

  player(id) { return this.players.find((p) => p.id === id) ?? null; }

  playerToLeft(playerID) {
    const idx = this.players.findIndex((p) => p.id === playerID);
    if (idx === -1) return null;
    return this.players[(idx + 1) % this.players.length];
  }

  leaderboardSorted() {
    return this.players
      .map((p) => [p, this.cumulativeScores.get(p.id) ?? 0])
      .sort((a, b) => a[1] - b[1]);
  }
}

export class HandRuleError extends Error {}

export class HandEngine {
  constructor(players) {
    this.state = new HandGameState(players);
  }

  startNewRound() {
    const s = this.state;
    s.drawPile = Deck.handDeck();
    s.drawPile.shuffle();
    s.discardPile = [];
    s.exposedMelds = [];
    s.hasDrawnThisTurn = false;
    s.lastDrawSource = null;
    s.lastDrawnCardID = null;
    s.totalDrawsThisRound = 0;
    s.hasMadeProgressThisTurn = false;
    s.exposedActionPlayers = new Set();
    s.cardsPlacedBy = new Map();
    s.turnsThisRound = 0;
    s.roundEndedReason = null;
    s.lastEndingTier = null;
    s.escalation.reset();
    s.declaration.reset();

    const hands = s.drawPile.deal(14, s.players.length);
    s.players.forEach((p, i) => { p.hand = hands[i]; });

    s.currentTurnIndex = (s.dealerIndex + 1) % s.players.length;
  }

  advanceToNextRound() {
    const s = this.state;
    s.roundNumber += 1;
    s.dealerIndex = (s.dealerIndex + 1) % s.players.length;
    if (!s.isGameOver) this.startNewRound();
  }

  _ensureCurrentTurn(playerID) {
    if (this.state.currentTurnPlayerID !== playerID) {
      throw new HandRuleError("ليس دورك الآن");
    }
  }

  drawCard(playerID, source) {
    const s = this.state;
    this._ensureCurrentTurn(playerID);
    if (s.hasDrawnThisTurn) throw new HandRuleError("سحبت بالفعل هذا الدور");
    const player = s.player(playerID);
    if (!player) throw new HandRuleError("لاعب غير موجود");

    if (source === DrawSource.LEFT_DISCARD && !s.isLeftDiscardUnlocked) {
      throw new HandRuleError(
        `ما يجوز أخذ ورقة النار إلا بعد اكتمال 4 لفّات (${MIN_DRAWS_BEFORE_LEFT_DISCARD} سحبة) - لازم تسحب من الدِّستة لحد الآن`
      );
    }

    let drawnCard;
    if (source === DrawSource.STOCK) {
      if (s.drawPile.isEmpty) this._renewDrawPile();
      drawnCard = s.drawPile.drawOne();
      if (!drawnCard) throw new HandRuleError("لا يوجد ورق بالدِّستة");
    } else {
      drawnCard = s.discardPile.pop();
      if (!drawnCard) throw new HandRuleError("لا توجد ورقة بالنار لأخذها");
    }

    player.hand.push(drawnCard);
    s.hasDrawnThisTurn = true;
    s.lastDrawSource = source;
    s.lastDrawnCardID = drawnCard.id;
    s.totalDrawsThisRound += 1;
    return drawnCard;
  }

  _renewDrawPile() {
    const s = this.state;
    s.drawPile.renew(s.discardPile);
    s.discardPile = [];
  }

  discardCard(playerID, card) {
    const s = this.state;
    this._ensureCurrentTurn(playerID);
    if (!s.hasDrawnThisTurn) throw new HandRuleError("يجب السحب أولاً قبل أي إجراء آخر");
    if (s.lastDrawSource === DrawSource.LEFT_DISCARD && !s.hasMadeProgressThisTurn) {
      throw new HandRuleError(
        "أخذت ورقة من النار - لازم تنزل عليها أو تكمّل خالص هذا الدور، أو ترجعها وتسحب من الدِّستة بدالها"
      );
    }
    const player = s.player(playerID);
    const idx = player.hand.findIndex((c) => c.id === card.id);
    if (idx === -1) throw new HandRuleError("هذه الورقة ليست بيد اللاعب");

    player.hand.splice(idx, 1);
    if (card.isJoker) s.escalation.registerJokerDiscarded();
    s.discardPile.push(card);
    s.turnsThisRound += 1;
    this._advanceTurn();
  }

  /// يرجّع آخر ورقة أُخذت من النار هذا الدور (لو ما نزّلت أو خالصت عليها)، ويسمح لك تسحب من الدِّستة بدالها
  /// يحدّد الورقة بمعرّفها بالضبط (lastDrawnCardID) - لا يفترض موضعها باليد، لأن المستخدم قد يكون رتّب يده بعد السحب
  undoLeftDiscardDraw(playerID) {
    const s = this.state;
    this._ensureCurrentTurn(playerID);
    if (!s.hasDrawnThisTurn || s.lastDrawSource !== DrawSource.LEFT_DISCARD) {
      throw new HandRuleError("ما أخذت ورقة من النار هذا الدور");
    }
    if (s.hasMadeProgressThisTurn) {
      throw new HandRuleError("ما يصير ترجع الورقة - سبق ونزّلت/أضفت عليها هذا الدور");
    }
    const player = s.player(playerID);
    const idx = player.hand.findIndex((c) => c.id === s.lastDrawnCardID);
    if (idx === -1) throw new HandRuleError("تعذّر تحديد الورقة المسحوبة لإرجاعها");
    const [card] = player.hand.splice(idx, 1);
    s.discardPile.push(card);
    s.hasDrawnThisTurn = false;
    s.lastDrawSource = null;
    s.lastDrawnCardID = null;
  }

  _advanceTurn() {
    const s = this.state;
    s.hasDrawnThisTurn = false;
    s.lastDrawSource = null;
    s.lastDrawnCardID = null;
    s.hasMadeProgressThisTurn = false;
    s.currentTurnIndex = (s.currentTurnIndex + 1) % s.players.length;
  }
}
