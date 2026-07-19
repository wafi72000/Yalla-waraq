// ai.js — ذكاء اصطناعي محسّن: مزايدة بتقييم أدق، دبل فعلي، ولعب يراعي الشريك

import { BidChoice } from "./bidding.js";
import { validatePlay } from "./trick.js";
import { cardValue, strengthIndex } from "./models.js";

/// يحسب قوة يد تقريبية لتحديد هل اللاعب "يشتري" أو يمرر
function handStrength(hand, suit) {
  return hand.reduce((sum, c) => sum + cardValue(c, suit ?? null), 0);
}

/// يقرر قرار المزايدة للاعب AI. availableChoices من BiddingState. flippedSuit للحكم الأول.
export function aiDecideBid(hand, availableChoices, flippedSuit, round) {
  if (availableChoices.includes(BidChoice.HUKM)) {
    const trumpCandidateSuit = round === 1 ? flippedSuit : strongestOtherSuit(hand, flippedSuit);
    const strength = handStrength(hand, trumpCandidateSuit);
    const trumpCount = hand.filter((c) => c.suit === trumpCandidateSuit).length;
    if (trumpCount >= 3 && strength >= 20) {
      return { choice: BidChoice.HUKM, trumpSuitForHukm: round === 2 ? trumpCandidateSuit : null };
    }
  }
  if (availableChoices.includes(BidChoice.SUN)) {
    const strength = handStrength(hand, null);
    if (strength >= 18) return { choice: BidChoice.SUN };
  }
  return { choice: BidChoice.PASS };
}

function strongestOtherSuit(hand, excludeSuit) {
  const bySuit = new Map();
  for (const c of hand) {
    if (c.suit === excludeSuit) continue;
    bySuit.set(c.suit, (bySuit.get(c.suit) ?? 0) + cardValue(c, c.suit));
  }
  let best = null, bestVal = -1;
  for (const [suit, val] of bySuit) if (val > bestVal) { best = suit; bestVal = val; }
  return best;
}

/// يقيّم قوة يد اللاعب الخصم/المشتري لقرار الدبل - يحسب عدد أوراق الحكم القوية اللي يملكها
function trumpStrengthScore(hand, trumpSuit) {
  const trumpCards = hand.filter((c) => c.suit === trumpSuit);
  const highValueCount = trumpCards.filter((c) => c.rank === 11 || c.rank === 9).length; // الولد والتسعة (أقوى ورقتين بالحكم)
  return { trumpCount: trumpCards.length, highValueCount, totalValue: handStrength(trumpCards, trumpSuit) };
}

/// قرار الدبل: يُستدعى بعد الشراء (حكم)، يرجع true لو يبي يطلب المستوى التالي، false لو يكتفي
/// role: "opponent" (يقرر دبل/فور) أو "buyer" (يقرر ثري/خمسة)
/// cumulativeScores (اختياري): { A, B } - يُستخدم لتعديل الجرأة حسب موقف المباراة
/// myTeam: فريق هذا الـAI - يلزم لمعرفة هل هو متأخر أو متقدم بالنشرة
export function aiDecideDouble(hand, trumpSuit, currentLevel, role, cumulativeScores = null, myTeam = null) {
  const { trumpCount, highValueCount, totalValue } = trumpStrengthScore(hand, trumpSuit);
  const isVeryStrong = trumpCount >= 4 && highValueCount >= 1 && totalValue >= 25;
  const isStrong = trumpCount >= 3 && totalValue >= 18; // معيار أخف يُستخدم فقط بحالة المجازفة الكبرى

  let desperate = false; // متأخر جداً - القهوة فرصته الوحيدة الواقعية للفوز
  let comfortable = false; // متقدم جداً - يقفل باب القهوة تماماً، يحمي صدارته
  if (cumulativeScores && myTeam) {
    const myScore = cumulativeScores[myTeam];
    const otherTeam = myTeam === "A" ? "B" : "A";
    const otherScore = cumulativeScores[otherTeam];
    desperate = otherScore - myScore >= 100; // فارق ضخم لصالح الخصم - المسار العادي شبه مستحيل
    comfortable = myScore - otherScore >= 100; // نفس الفارق لكن لصالحنا - نحمي الصدارة
  }

  if (comfortable) return false; // متقدمين بوضوح - نقفل باب التصعيد نهائياً، ما نجازف بصدارتنا

  if (desperate) {
    // متأخرين جداً - نجازف حتى بمستوى "خمسة" لو معنا يد حكم معقولة (معيار أخف من المعتاد، لأن القهوة فرصتنا الوحيدة)
    return isStrong;
  }

  // الوضع الطبيعي (بدون فارق نقاط حاسم): نفس المعيار المحافظ السابق
  if (!isVeryStrong) return false;
  if (currentLevel >= 2 && !(trumpCount >= 5 && highValueCount >= 2)) return false;
  if (currentLevel >= 3) return false; // يكتفي عند "فور" بالوضع العادي - القهوة فقط للحالة اليائسة أعلاه
  return true;
}

/// يبني خريطة "مين فاضي من وش لون" بناءً على الأشواط المكتملة (كل شوط فيه plays: مين رمى وش) - أي لاعب ما اتبع لون القيادة معروف إنه فاضي منه
function inferVoidSuits(completedTricks) {
  const voidMap = new Map(); // playerID -> Set(suits)
  for (const trick of completedTricks ?? []) {
    if (!trick.plays || trick.plays.length === 0) continue;
    const leadSuit = trick.plays[0].card.suit;
    for (const play of trick.plays) {
      if (play.card.suit !== leadSuit) {
        if (!voidMap.has(play.playerID)) voidMap.set(play.playerID, new Set());
        voidMap.get(play.playerID).add(leadSuit);
      }
    }
  }
  return voidMap;
}

/// يختار ورقة للرمي - يراعي وضع الشريك: لو شريكه رابح بالشوط الحالي، يلعب بأمان (تغسيل بورقة رخيصة)
/// لو هو أو خصمه رابح، يحاول ياخذ الشوط لو ممكن، وإلا يرمي أرخص ورقة قانونية
/// completedTricks (اختياري): تاريخ الأشواط المكتملة - يُستخدم لتتبع فراغات الخصوم عند فتح شوط جديد
export function aiChooseCard(hand, cardsPlayed, trumpSuit, partnerOfID, playerID, completedTricks = []) {
  const legal = hand.filter((card) => {
    try {
      validatePlay({ hand, card, cardsPlayed, trumpSuit, partnerOfID, playerID });
      return true;
    } catch (e) {
      return false;
    }
  });
  if (legal.length === 0) return null;

  if (cardsPlayed.length === 0) {
    const voidMap = inferVoidSuits(completedTricks);
    return chooseOpeningLead(legal, trumpSuit, hand, voidMap, playerID, partnerOfID);
  }

  const leadSuit = cardsPlayed[0].card.suit;
  const currentBest = currentWinnerCard(cardsPlayed, leadSuit, trumpSuit);
  const partnerIsWinning = currentBest && partnerOfID(playerID) === currentBest.playerID;

  if (partnerIsWinning) {
    // شريكي رابح - ما أحتاج أضحّي بورقة قوية، أرمي أرخص ورقة قانونية
    return cheapestLegal(legal, trumpSuit);
  }

  // أنا أو الخصم اللي رابح - أحاول آخذ الشوط لو أقدر بأقل ورقة كافية، وإلا أرمي الأرخص
  const winningOptions = legal.filter((card) => wouldWinTrick(card, cardsPlayed, leadSuit, trumpSuit));
  if (winningOptions.length > 0) {
    // نختار أضعف ورقة "كافية" للفوز (تقتصد بالأوراق القوية لاحقاً)
    winningOptions.sort((a, b) => strengthIndex(a, trumpSuit) - strengthIndex(b, trumpSuit));
    return winningOptions[winningOptions.length - 1]; // الأضعف من بين الفائزة (أعلى index = أضعف)
  }
  return cheapestLegal(legal, trumpSuit);
}

/// يفتح الشوط: يفضّل لون عادي (غير الحكم) عنده فيه ورق كثير (يفرّغ الأطول أول)
/// يتجنّب يفتح بلون يعرف إن خصمه (مو شريكه) فاضي منه، إلا لو ما فيه خيار ثاني - لأن الخصم يقدر يقطعه بالحكم
function chooseOpeningLead(legal, trumpSuit, fullHand, voidMap, playerID, partnerOfID) {
  const nonTrump = legal.filter((c) => c.suit !== trumpSuit);
  let pool = nonTrump.length > 0 ? nonTrump : legal;

  // نستبعد الألوان اللي خصم (مو شريكنا) معروف فاضي منها - يقدر يقطعها بالحكم لو فتحنا فيها
  const partnerID = partnerOfID(playerID);
  const risky = new Set();
  for (const [voidPlayerID, suits] of voidMap) {
    if (voidPlayerID === playerID || voidPlayerID === partnerID) continue; // ما يهمنا فراغ شريكنا أو فراغنا احنا
    for (const s of suits) risky.add(s);
  }
  const safePool = pool.filter((c) => !risky.has(c.suit));
  if (safePool.length > 0) pool = safePool; // نفضّل الآمن، إلا لو كل خياراتنا محفوفة بالمخاطر فعلاً

  const suitLengths = new Map();
  for (const c of fullHand) suitLengths.set(c.suit, (suitLengths.get(c.suit) ?? 0) + 1);

  const bestSuit = [...new Set(pool.map((c) => c.suit))].sort(
    (a, b) => (suitLengths.get(b) ?? 0) - (suitLengths.get(a) ?? 0)
  )[0];
  const candidatesInSuit = pool.filter((c) => c.suit === bestSuit);
  candidatesInSuit.sort((a, b) => strengthIndex(a, trumpSuit) - strengthIndex(b, trumpSuit));
  return candidatesInSuit[0]; // الأقوى من أطول لون آمن
}

function cheapestLegal(legal, trumpSuit) {
  const nonTrump = legal.filter((c) => c.suit !== trumpSuit);
  const pool = nonTrump.length > 0 ? nonTrump : legal; // يفضّل يضحّي بلون عادي رخيص بدل حكم لو ممكن
  pool.sort((a, b) => cardValue(a, trumpSuit) - cardValue(b, trumpSuit));
  return pool[0];
}

function currentWinnerCard(cardsPlayed, leadSuit, trumpSuit) {
  let best = null;
  for (const entry of cardsPlayed) {
    const isTrump = trumpSuit !== null && entry.card.suit === trumpSuit;
    const isLeadSuit = entry.card.suit === leadSuit;
    if (!isTrump && !isLeadSuit) continue;
    if (!best) { best = entry; continue; }
    const bestIsTrump = trumpSuit !== null && best.card.suit === trumpSuit;
    if (isTrump && !bestIsTrump) { best = entry; continue; }
    if (!isTrump && bestIsTrump) continue;
    if (strengthIndex(entry.card, trumpSuit) < strengthIndex(best.card, trumpSuit)) best = entry;
  }
  return best;
}

function wouldWinTrick(card, cardsPlayed, leadSuit, trumpSuit) {
  const hypothetical = [...cardsPlayed, { playerID: "__me__", card }];
  const winner = currentWinnerCard(hypothetical, leadSuit, trumpSuit);
  return winner?.playerID === "__me__";
}
