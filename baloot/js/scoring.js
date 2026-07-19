// scoring.js — حساب اليد الكامل: نقاط الورق + المشاريع + الكابوت + التعادل/المعلّقة + الدبل

import { cardValue } from "./models.js";

const LAST_TRICK_BONUS = { sun: 25, hukm: 10 };
const CAPOT_POINTS = { sun: 44, hukm: 25 };
const ROUNDED_NET_TOTAL = { sun: 26, hukm: 16 }; // المجموع الصافي بعد التقريب (يشمل آخر أكلة) - يُستخدم لتحديد نقاط الخسف الكاملة ونصف النقطة

/// tricksWon: [{ playerID, cards: [card,...] }] كل عنصر شوط أخذه لاعب معيّن (نمرّر مين اللاعب لتحديد فريقه لاحقاً بره الدالة)
/// trumpSuit: لون الحكم أو null (صن). lastTrickWinnerTeam: أي فريق أخذ آخر أكلة ("A"|"B")
/// teamOfPlayer(playerID) ترجع "A" أو "B"
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
export function scoreHand({
  tricksWon,          // [{ playerID, cards }]
  trumpSuit,          // لون الحكم أو null
  isHukm,             // نظام حكم أو صن
  lastTrickWinnerTeam, // "A" | "B"
  capotTeam,          // "A" | "B" | null
  teamOfPlayer,
  buyerTeam,          // "A" | "B" - مين اشترى
  projectPointsByTeam, // { A: number, B: number } - بعد حسم الأولوية (الخاسر بالمقارنة = 0)
  doubleMultiplier = 1, // معامل الدبل (1 لو ما فيه دبل، أو بالصن دايماً)
  balootPointsByTeam = { A: 0, B: 0 }, // مستقل تماماً - يُضاف دايماً بغض النظر عن الكابوت/الخسف
}) {
  const system = isHukm ? "hukm" : "sun";

  if (capotTeam) {
    const loserTeam = capotTeam === "A" ? "B" : "A";
    const base = CAPOT_POINTS[system];
    const withProjects = base + (projectPointsByTeam[capotTeam] ?? 0);
    const finalPoints = { [capotTeam]: withProjects * doubleMultiplier, [loserTeam]: 0 };
    // البلوت محمي دايماً حتى لو الفريق الخاسر هو صاحبه
    finalPoints.A = (finalPoints.A ?? 0) + (balootPointsByTeam.A ?? 0);
    finalPoints.B = (finalPoints.B ?? 0) + (balootPointsByTeam.B ?? 0);
    return { A: finalPoints.A, B: finalPoints.B, isCapot: true, isPending: false, isDefeat: false };
  }

  const cardTotals = computeRawCardPoints(tricksWon, trumpSuit, teamOfPlayer);
  cardTotals[lastTrickWinnerTeam] += LAST_TRICK_BONUS[system];

  const rawA = cardTotals.A + (projectPointsByTeam.A ?? 0);
  const rawB = cardTotals.B + (projectPointsByTeam.B ?? 0);

  const roundedA = Math.round(rawA / 10);
  const roundedB = Math.round(rawB / 10);

  const opponentTeam = buyerTeam === "A" ? "B" : "A";
  const buyerRounded = buyerTeam === "A" ? roundedA : roundedB;
  const opponentRounded = buyerTeam === "A" ? roundedB : roundedA;

  const rawTotalRounded = ROUNDED_NET_TOTAL[system];
  const halfPoint = rawTotalRounded / 2;

  // حالة الحكم الخاصة: 8-8 بالضبط (نصف المجموع الصافي 16) = خسف مباشر، مش تعادل معلّق
  const isExactHalfSplitHukm = isHukm && roundedA === roundedB && roundedA === halfPoint;

  if (roundedA === roundedB) {
    if (isExactHalfSplitHukm) {
      // خسف مباشر - كل النقاط تذهب للخصم
      const finalPoints = { [buyerTeam]: 0, [opponentTeam]: rawTotalRounded * doubleMultiplier };
      finalPoints.A = (finalPoints.A ?? 0) + (balootPointsByTeam.A ?? 0);
      finalPoints.B = (finalPoints.B ?? 0) + (balootPointsByTeam.B ?? 0);
      return { A: finalPoints.A, B: finalPoints.B, isCapot: false, isPending: false, isDefeat: true };
    }
    // تعادل عادي (13-13 بالصن مثلاً) - نقاط الخصم فوراً، نقاط المشتري معلّقة
    const finalPoints = { [opponentTeam]: opponentRounded * doubleMultiplier, [buyerTeam]: 0 };
    const pendingPoints = buyerRounded * doubleMultiplier;
    finalPoints.A = (finalPoints.A ?? 0) + (balootPointsByTeam.A ?? 0);
    finalPoints.B = (finalPoints.B ?? 0) + (balootPointsByTeam.B ?? 0);
    return { A: finalPoints.A, B: finalPoints.B, isCapot: false, isPending: true, pendingTeam: buyerTeam, pendingAmount: pendingPoints, isDefeat: false };
  }

  // نتيجة حاسمة - نتحقق هل المشتري حقق الأغلبية (أكثر من النصف)
  const buyerSucceeded = buyerRounded > halfPoint;
  let finalPoints;
  let isDefeat = false;
  if (buyerSucceeded) {
    finalPoints = { [buyerTeam]: buyerRounded * doubleMultiplier, [opponentTeam]: opponentRounded * doubleMultiplier };
  } else {
    // خسف: كل نقاط اليد تذهب للخصم
    finalPoints = { [buyerTeam]: 0, [opponentTeam]: rawTotalRounded * doubleMultiplier };
    isDefeat = true;
  }
  finalPoints.A = (finalPoints.A ?? 0) + (balootPointsByTeam.A ?? 0);
  finalPoints.B = (finalPoints.B ?? 0) + (balootPointsByTeam.B ?? 0);
  return { A: finalPoints.A, B: finalPoints.B, isCapot: false, isPending: false, isDefeat };
}

/// يدير الحصالة المعلّقة عبر عدة أيدي - كائن بسيط بمبلغ فقط (مين ياخذه يحدده الكود المستدعي حسب فريق الفوز الفعلي)
export class PendingPot {
  constructor() {
    this.amount = 0;
  }

  /// يُستدعى بعد كل يد بنتيجتها. لو pending، يتراكم المبلغ. لو حاسمة، يُطلق المتراكم (يرجّعه، ويصفّر الحصالة)
  /// التطبيق الفعلي (لمين تُضاف الحصالة المُطلقة) مسؤولية الكود الخارجي - هو يعرف مين فاز فعلياً بهذي اليد الحاسمة
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
