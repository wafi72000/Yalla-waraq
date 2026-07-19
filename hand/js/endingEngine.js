// endingEngine.js — جدول النقاط النهائي ومنطق إنهاء الجولة بكل طرقها
//
// 4 طرق إنهاء، تتفرّع لـ11 حالة بسبب الجوكر:
// - هند / لون / قرينق: مسار مخفي بالكامل - صفر لمس لبير مكشوف طول الجولة، كشف اليد الـ14 ورقة
//   دفعة وحدة وقت الإعلان، سحب من الدِّستة (مو النار). لون = ورق لون واحد. قرينق = ورق نوع واحد بالضبط.
// - خالص (نوعين، نفس الشروط الأساسية: سحب من النار هذا الدور، نقاطها ثابتة -30 دايماً):
//   • خالص بعد النزول: نزّل بيراته على مراحل سابقة (لمس بير مكشوف)، يدّه فاضية غير ورق الإعلان الأخير
//   • خالص مباشر: صفر لمس لأي بير مكشوف طول الجولة - يكشف يدّه كاملة دفعة وحدة (بيرات+ورق إعلان)
//
// "جوكر"/"جوكرين" مو طريقة مستقلة - هي هند (أو لون/قرينق) نفسها، بس ورقة/ورقتي الإعلان (finalDiscards،
// المحجوزة عمداً برّا كل البيرات) لازم تكون جوكر - وهذا يضاعف نقاط الفايز والخصوم. الخالص معفى من هذا تماماً.
//
// تنبيه مهم: "تصعيد الجوكر" (escalation.js، jokersDiscardedCount) مفهوم منفصل تماماً عن جوكر/جوكرين هنا -
// الأول قيد دخول فقط (أي جوكر يترمى بالنار يمنع طرق إنهاء أسهل لاحقاً)، والثاني مرتبط بورقة الإعلان نفسها فقط.

import { HandEngine, ExposedMeld, HandRuleError, DrawSource } from "./engine.js";
import { EndingType } from "./escalation.js";
import { totalLoosePoints } from "./scoring.js";
import { isRedSuit } from "./models.js";
import { isValidSet, isValidRun, canonicalRunOrder, MeldKind } from "./meld.js";

export const HandScoreTable = [
  { winnerScore: -60, opponentFlatScore: 200, opponentLaidMultiplier: 2 },  // 0: هند عادي
  { winnerScore: -30, opponentFlatScore: 100, opponentLaidMultiplier: 1 },  // 1: خالص
  { winnerScore: -120, opponentFlatScore: 400, opponentLaidMultiplier: 4 }, // 2: جوكر واحد بالنهاية / لون
  { winnerScore: -240, opponentFlatScore: 800, opponentLaidMultiplier: 8 }, // 3: جوكرين بالنهاية / لون+جوكر / قرينق
  { winnerScore: -480, opponentFlatScore: 1600, opponentLaidMultiplier: 16 }, // 4: لون+جوكرين / قرينق+جوكر
  { winnerScore: -960, opponentFlatScore: 3200, opponentLaidMultiplier: 32 }, // 5: قرينق+جوكرين
];

export function tierIndex(endingType, finalJokerCount) {
  switch (endingType) {
    case EndingType.KHALES:
      return 1; // الخالص لا يتحالف مع جوكر (يُمنع بعد أول جوكر أصلاً)
    case EndingType.HAND:
      return finalJokerCount === 0 ? 0 : finalJokerCount === 1 ? 2 : 3;
    case EndingType.COLOR:
      return finalJokerCount === 0 ? 2 : finalJokerCount === 1 ? 3 : 4;
    case EndingType.QARINQ:
      return finalJokerCount === 0 ? 3 : finalJokerCount === 1 ? 4 : 5;
    default:
      return 0;
  }
}

export function scoreTier(endingType, finalJokerCount) {
  return HandScoreTable[tierIndex(endingType, finalJokerCount)];
}

/// اسم الطريقة بالعربي حسب نوع الإعلان وعدد الجواكر بورقة الإعلان نفسها - يُستخدم بالمعاينة قبل الإعلان وبرسالة نهاية الجولة
export function tierLabel(endingType, finalJokerCount) {
  const jokerSuffix = finalJokerCount === 1 ? " وجوكر" : finalJokerCount === 2 ? " وجوكرين" : "";
  switch (endingType) {
    case EndingType.KHALES:
      return "خالص";
    case EndingType.HAND:
      return finalJokerCount === 0 ? "هند" : finalJokerCount === 1 ? "جوكر" : "جوكرين";
    case EndingType.COLOR:
      return "لون" + jokerSuffix;
    case EndingType.QARINQ:
      return "قرينق" + jokerSuffix;
    default:
      return "";
  }
}

function requireTurnAndDraw(engine, playerID) {
  const s = engine.state;
  if (s.currentTurnPlayerID !== playerID) throw new HandRuleError("ليس دورك الآن");
  if (!s.hasDrawnThisTurn) throw new HandRuleError("يجب السحب أولاً قبل أي إجراء آخر");
}

/// يتحقق إن البيرات المعلنة + الرمية الأخيرة تغطي يد اللاعب بالكامل، بدون نقص أو تكرار،
/// وإن كل بير منها صحيح (Set/Run) - يُستخدم بمسار الكشف الكامل (هند/لون/قرينق)
function validateConcealedFullHand(player, melds, finalDiscards) {
  for (const m of melds) {
    const valid = m.kind === MeldKind.SET ? isValidSet(m.cards) : isValidRun(m.cards);
    if (!valid) throw new HandRuleError("أحد البيرات المُعلنة غير صحيح");
  }
  const meldCardIds = melds.flatMap((m) => m.cards.map((c) => c.id));
  const finalIds = finalDiscards.map((c) => c.id);
  const allUsedIds = [...meldCardIds, ...finalIds];
  const handIds = player.hand.map((c) => c.id);

  if (allUsedIds.length !== handIds.length) {
    throw new HandRuleError("عدد الورق المُعلن ما يطابق عدد ورق يدك بالكامل (14 ورقة)");
  }
  const handIdSet = new Set(handIds);
  const usedIdSet = new Set();
  for (const id of allUsedIds) {
    if (!handIdSet.has(id)) throw new HandRuleError("ورقة مُعلنة ليست بيدك");
    if (usedIdSet.has(id)) throw new HandRuleError("ورقة مكررة بالإعلان");
    usedIdSet.add(id);
  }
}

HandEngine.prototype.endRound = function (playerID, endingType, finalDiscards, melds = []) {
  const s = this.state;
  requireTurnAndDraw(this, playerID);

  if (!s.escalation.isEndingAllowed(endingType)) {
    throw new HandRuleError("هذي الطريقة ممنوعة الآن بسبب تصعيد الجوكر");
  }
  if (endingType === EndingType.KHALES && s.lastDrawSource !== DrawSource.LEFT_DISCARD) {
    // استثناء: لو بيدك ورقة وحدة (الخالص الأخير بعد نزول كامل على مراحل) → مصدر السحب مش مهم
    const player0 = s.player(playerID);
    const isLastCard = player0 && player0.hand.length === 1 && s.exposedActionPlayers.has(playerID);
    if (!isLastCard) {
      throw new HandRuleError("الخالص لا يصير إلا إذا أخذت ورقة النار (يسارك) هذا الدور - إلا إذا بيدك ورقة وحدة بعد نزول كامل");
    }
  }
  if (endingType === EndingType.HAND && s.lastDrawSource !== DrawSource.STOCK) {
    throw new HandRuleError("الهند لا يصير إلا بالسحب من الدِّستة هذا الدور");
  }
  if (finalDiscards.length > 2) throw new HandRuleError("ما يجوز رمي أكثر من ورقتين بالنهاية");
  if (finalDiscards.length === 2 && !finalDiscards.every((c) => c.isJoker)) {
    throw new HandRuleError("الرمية المزدوجة مسموحة فقط لو الورقتين جوكر");
  }
  const player = s.player(playerID);
  if (!player) throw new HandRuleError("لاعب غير موجود");
  for (const c of finalDiscards) {
    if (!player.hand.some((h) => h.id === c.id)) throw new HandRuleError("هذه الورقة ليست بيد اللاعب");
  }

  const isConcealedPath =
    endingType === EndingType.HAND || endingType === EndingType.COLOR || endingType === EndingType.QARINQ;

  if (isConcealedPath) {
    if (s.exposedActionPlayers.has(playerID)) {
      throw new HandRuleError(
        "ما يصير هند/لون/قرينق - سبق ولمست بير مكشوف هذي الجولة (نزول أو إضافة)، المسار المخفي ما يصير بعدها"
      );
    }
    validateConcealedFullHand(player, melds, finalDiscards);
  } else if (s.exposedActionPlayers.has(playerID)) {
    // خالص بعد النزول: نزّلت بيراتك على مراحل قبل، يدّك لازم تكون فاضية تماماً غير ورق الإعلان الأخير
    if (player.hand.length !== finalDiscards.length) {
      throw new HandRuleError("ما يجوز الخالص - يدّك لسه فيها ورق غير منزّل ببيرات");
    }
  } else {
    // خالص مباشر: صفر لمس لأي بير مكشوف طول الجولة - تكشف يدّك كاملة دفعة وحدة (بيرات + ورق إعلان) بسحب النار
    validateConcealedFullHand(player, melds, finalDiscards);
  }

  if (endingType === EndingType.COLOR) {
    const allCards = [...melds.flatMap((m) => m.cards), ...finalDiscards].filter((c) => !c.isJoker);
    const allRed = allCards.every((c) => isRedSuit(c.suit));
    const allBlack = allCards.every((c) => !isRedSuit(c.suit));
    if (!(allRed || allBlack)) throw new HandRuleError("اليد لازم تكون لون واحد بالكامل لإنهاء بـ'لون'");
  }
  if (endingType === EndingType.QARINQ) {
    const allCards = [...melds.flatMap((m) => m.cards), ...finalDiscards].filter((c) => !c.isJoker);
    const firstSuit = allCards[0]?.suit;
    if (!firstSuit || !allCards.every((c) => c.suit === firstSuit)) {
      throw new HandRuleError("اليد لازم تكون نوع واحد بالكامل لإنهاء بـ'قرينق'");
    }
  }

  if (isConcealedPath || melds.length > 0) {
    // كشف اليد بالكامل دفعة وحدة (هند/لون/قرينق، أو خالص مباشر) - تُسجّل كبيرات مكشوفة للعرض فقط (الجولة خلصت أصلاً)
    for (const m of melds) {
      const storedCards = m.kind === MeldKind.RUN ? canonicalRunOrder(m.cards) : m.cards;
      s.exposedMelds.push(new ExposedMeld(storedCards, m.kind, playerID));
    }
    player.hand = [];
  } else {
    // خالص بعد النزول: بيراته سبق وانضافت بنزولات سابقة - هنا بس نشيل ورق الإعلان الأخير
    for (const c of finalDiscards) {
      const idx = player.hand.findIndex((h) => h.id === c.id);
      player.hand.splice(idx, 1);
    }
  }

  // عدد الجواكر يُحسب من ورق الإعلان نفسه (الورق المحجوز عمداً برّا كل البيرات) - مش من عداد النار العام
  // (التصعيد وحساب نقاط الجوكر مفهومين منفصلين تماماً)
  const jokerCount = finalDiscards.filter((c) => c.isJoker).length;
  const tier = scoreTier(endingType, jokerCount);
  applyRoundScores(s, playerID, tier);
  s.roundEndedReason = `${player.name} فاز بـ ${tierLabel(endingType, jokerCount)} (${tier.winnerScore})`;
  s.lastEndingTier = tier; // عشان الواجهة تقدر تدرّج تأثير الاحتفال حسب قوة الإنهاء
  return tier;
};

function applyRoundScores(s, winnerID, tier) {
  s.cumulativeScores.set(winnerID, (s.cumulativeScores.get(winnerID) ?? 0) + tier.winnerScore);
  for (const opponent of s.players) {
    if (opponent.id === winnerID) continue;
    if (s.declaration.isPlayerInRace(opponent.id)) {
      const remaining = totalLoosePoints(opponent.hand);
      s.cumulativeScores.set(opponent.id, (s.cumulativeScores.get(opponent.id) ?? 0) + remaining * tier.opponentLaidMultiplier);
    } else {
      s.cumulativeScores.set(opponent.id, (s.cumulativeScores.get(opponent.id) ?? 0) + tier.opponentFlatScore);
    }
  }
}
