// scoring.js — حساب اليد الكامل: نقاط الورق + المشاريع + الكابوت + التعادل/الخسران + الدبل
//
// المصطلحات (مؤكدة من وافي): "بنط" = نقاط خام (قبل التقريب). "نقطة" = النتيجة النهائية بعد كل الحسابات.
// الصن: 130 بنط إجمالي (120 ورق + 10 أرضية) → 13 نقطة قبل مضاعفة الصن، ×2 = 26 نقطة نهائية.
// الحكم: 162 بنط إجمالي (152 ورق + 10 أرضية) → 16 نقطة، بدون أي مضاعفة أصيلة.
// قاعدة التقريب (نفس الشي بالنظامين): آحاد 5 أو أقل ← ينزل، آحاد 6 أو أكثر ← يطلع.
// النجاح/الخسران/التعادل يُحسم بنقاط الورق فقط (بدون مشاريع) - المشاريع تُضاف/تُسرق بعد الحسم.
// الدبل (بالحكم: دبل/ثري/فور/قهوة) لا يقبل القسمة أبداً: لو فعّال ونتيجة حاسمة، كل شي لطرف واحد بس.
// دبل الصن (شرط رصيد 100+) مؤكّد من وافي إنه بدون أي أثر رقمي - سن دايماً يتقاسم عادي بغض النظر عنه.

import { cardValue } from "./models.js";

const LAST_TRICK_BONUS = 10; // نفس القيمة بالنظامين
const CAPOT_POINTS = { sun: 44, hukm: 25 };
const HALF_ABNAT = { sun: 6.5, hukm: 8 }; // نص المجموع قبل مضاعفة الصن - يحدد النجاح/الخسران
const FULL_ABNAT = { sun: 13, hukm: 16 }; // المجموع الكامل قبل مضاعفة الصن
const SUN_MULTIPLIER = 2; // مضاعفة الصن الأصيلة والثابتة - تُطبَّق دايماً، بغض النظر عن أي دبل صن

/// يقرّب بنط خام لنقطة واحدة: آحاد 5 أو أقل ينزل، 6 أو أكثر يطلع (مختلف عن Math.round عند آحاد=5 بالضبط)
function roundToAbnat(raw) {
  const remainder = raw % 10;
  return remainder <= 5 ? Math.floor(raw / 10) : Math.ceil(raw / 10);
}

/// tricksWon: [{ playerID, cards: [card,...] }] كل عنصر شوط أخذه لاعب معيّن
/// trumpSuit: لون الحكم أو null (صن). teamOfPlayer(playerID) ترجع "A" أو "B"
export function computeRawCardPoints(tricksWon, trumpSuit, teamOfPlayer) {
  const totals = { A: 0, B: 0 };
  for (const trick of tricksWon) {
    const team = teamOfPlayer(trick.playerID);
    for (const card of trick.cards) {
      totals[team] += cardValue(card, trumpSuit);
    }
  }
  return totals;
}

/// isCapot: هل فريق واحد أخذ كل الأشواط الثمانية (capotTeam = "A"|"B"|null)
/// doubleMultiplier: معامل دبل الحكم فقط (1/2/3/4/5) - يُمرَّر 1 دايماً بالصن (دبل الصن بدون أي أثر رقمي مؤكَّد)
export function scoreHand({
  tricksWon, trumpSuit, isHukm, lastTrickWinnerTeam, capotTeam, teamOfPlayer,
  buyerTeam, projectPointsByTeam, doubleMultiplier = 1, balootPointsByTeam = { A: 0, B: 0 },
}) {
  const system = isHukm ? "hukm" : "sun";
  const opponentTeam = buyerTeam === "A" ? "B" : "A";
  const sysMultiplier = isHukm ? 1 : SUN_MULTIPLIER;
  const allProjects = (projectPointsByTeam.A ?? 0) + (projectPointsByTeam.B ?? 0);

  const cardTotalsRaw = computeRawCardPoints(tricksWon, trumpSuit, teamOfPlayer);
  const breakdownBase = {
    cardPointsRaw: { ...cardTotalsRaw },
    lastTrickTeam: lastTrickWinnerTeam,
    lastTrickBonus: LAST_TRICK_BONUS,
    projectPointsByTeam: { ...projectPointsByTeam },
    balootPointsByTeam: { ...balootPointsByTeam },
    doubleMultiplier,
  };

  const finalize = (finalPoints, extra) => {
    finalPoints.A = (finalPoints.A ?? 0) + (balootPointsByTeam.A ?? 0);
    finalPoints.B = (finalPoints.B ?? 0) + (balootPointsByTeam.B ?? 0);
    return { A: finalPoints.A, B: finalPoints.B, breakdown: { ...breakdownBase, ...extra } };
  };

  // ===== كابوت: يستبدل كل الحساب - نقاط ثابتة + مشاريع الفريق نفسه، مضروبة بمعامل الدبل =====
  if (capotTeam) {
    const loserTeam = capotTeam === "A" ? "B" : "A";
    const base = CAPOT_POINTS[system];
    const withProjects = base + (projectPointsByTeam[capotTeam] ?? 0);
    const finalPoints = { [capotTeam]: withProjects * doubleMultiplier, [loserTeam]: 0 };
    return {
      ...finalize(finalPoints, { capotTeam, capotBasePoints: base }),
      isCapot: true, isPending: false, isDefeat: false,
    };
  }

  // ===== تحديد النتيجة بنقاط الورق فقط (بدون مشاريع) =====
  const cardTotals = { ...cardTotalsRaw };
  cardTotals[lastTrickWinnerTeam] += LAST_TRICK_BONUS;

  const buyerAbnat = roundToAbnat(cardTotals[buyerTeam]);
  const opponentAbnat = roundToAbnat(cardTotals[opponentTeam]);
  const half = HALF_ABNAT[system];
  const full = FULL_ABNAT[system];
  const breakdown = { ...breakdownBase, buyerAbnat, opponentAbnat };

  // ===== تعادل تام =====
  if (buyerAbnat === opponentAbnat) {
    if (doubleMultiplier > 1) {
      // تعادل + دبل فعّال = خسران فوري على المشتري، بدون تعليق
      const finalPoints = { [buyerTeam]: 0, [opponentTeam]: (full * sysMultiplier + allProjects) * doubleMultiplier };
      return { ...finalize(finalPoints, breakdown), isCapot: false, isPending: false, isDefeat: true };
    }
    // تعادل عادي بدون دبل - نقاط الخصم فوراً، نقاط المشتري معلّقة لليد الجاية
    const opponentPoints = opponentAbnat * sysMultiplier + (projectPointsByTeam[opponentTeam] ?? 0);
    const pendingPoints = buyerAbnat * sysMultiplier + (projectPointsByTeam[buyerTeam] ?? 0);
    const finalPoints = { [opponentTeam]: opponentPoints, [buyerTeam]: 0 };
    return {
      ...finalize(finalPoints, breakdown),
      isCapot: false, isPending: true, pendingTeam: buyerTeam, pendingAmount: pendingPoints, isDefeat: false,
    };
  }

  // ===== نتيجة حاسمة =====
  const buyerSucceeded = buyerAbnat > half;

  if (!buyerSucceeded) {
    // خسران - كل نقاط اليد (المجموع الكامل) + كل المشاريع (الفريقين) تروح للخصم بالكامل
    const finalPoints = { [buyerTeam]: 0, [opponentTeam]: (full * sysMultiplier + allProjects) * doubleMultiplier };
    return { ...finalize(finalPoints, breakdown), isCapot: false, isPending: false, isDefeat: true };
  }

  // نجاح: لو دبل حكم فعّال (doubleMultiplier>1، حكم فقط) - كل الأبناط + كل المشاريع لطرف واحد (المشتري)، بدون تقاسم
  // غير كذا (بدون دبل حكم فعّال، أو صن دايماً): كل فريق ياخذ نصيبه + مشروعه الخاص
  let finalPoints;
  if (isHukm && doubleMultiplier > 1) {
    finalPoints = { [buyerTeam]: (full + allProjects) * doubleMultiplier, [opponentTeam]: 0 };
  } else {
    finalPoints = {
      [buyerTeam]: buyerAbnat * sysMultiplier + (projectPointsByTeam[buyerTeam] ?? 0),
      [opponentTeam]: opponentAbnat * sysMultiplier + (projectPointsByTeam[opponentTeam] ?? 0),
    };
  }
  return { ...finalize(finalPoints, breakdown), isCapot: false, isPending: false, isDefeat: false };
}

/// يدير الحصالة المعلّقة عبر عدة أيدي - كائن بسيط بمبلغ فقط (مين ياخذه يحدده الكود المستدعي حسب فريق الفوز الفعلي)
export class PendingPot {
  constructor() {
    this.amount = 0;
  }

  /// يُستدعى بعد كل يد بنتيجتها. لو pending، يتراكم المبلغ. لو حاسمة، يُطلق المتراكم (يرجّعه، ويصفّر الحصالة)
  applyHandResult(handResult) {
    if (handResult.isPending) {
      this.amount += handResult.pendingAmount;
      return 0;
    }
    const released = this.amount;
    this.amount = 0;
    return released;
  }
}
