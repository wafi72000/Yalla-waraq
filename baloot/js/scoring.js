// scoring.js — حساب اليد الكامل: نقاط الورق + المشاريع + الكابوت + الخسران + الدبل
//
// المصطلحات (مؤكدة من وافي): "بنط" = نقاط خام (قبل التقريب). "نقطة" = النتيجة النهائية بعد كل الحسابات.
// الصن: 130 بنط إجمالي (120 ورق + 10 أرضية) → 13 نقطة قبل مضاعفة الصن، ×2 = 26 نقطة نهائية.
// الحكم: 162 بنط إجمالي (152 ورق + 10 أرضية) → 16 نقطة، بدون أي مضاعفة أصيلة.
// قاعدة التقريب (نفس الشي بالنظامين): آحاد 5 أو أقل ← ينزل، آحاد 6 أو أكثر ← يطلع.
//
// بدون دبل فعّال: الأبناط تحدد الفائز مباشرة (المشتري أقل من الخصم = خسران كامل للخصم؛ غير كذا
// (المشتري أكثر، أو تعادل تام) = كل فريق ياخذ نصيبه + مشروعه الخاص - بدون أي تأجيل أو تعليق مهما كانت الحالة).
//
// مع دبل فعّال (دبل الحكم بمستوياته، أو دبل الصن المشروط): المقارنة تصير شاملة من البداية (بنط الورق
// المضاعف بمضاعف النظام + مشروع كل فريق) - المشروع ممكن يقلب النتيجة. الأعلى مجموعاً ياخذ كل شي
// (المجموع الكامل + كل المشاريع) مضروباً بمعامل الدبل؛ تعادل المجموع الشامل = خسران فوري على المشتري.

import { cardValue } from "./models.js";

const LAST_TRICK_BONUS = 10; // نفس القيمة بالنظامين
const CAPOT_POINTS = { sun: 44, hukm: 25 };
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
/// doubleMultiplier: معامل الدبل الفعّال (2/3/4/5 لدبل الحكم، 2 لدبل الصن لو فعّال، 1 غير كذا)
export function scoreHand({
  tricksWon, trumpSuit, isHukm, lastTrickWinnerTeam, capotTeam, teamOfPlayer,
  buyerTeam, projectPointsByTeam, doubleMultiplier = 1, balootPointsByTeam = { A: 0, B: 0 },
}) {
  const system = isHukm ? "hukm" : "sun";
  const opponentTeam = buyerTeam === "A" ? "B" : "A";
  const sysMultiplier = isHukm ? 1 : SUN_MULTIPLIER;
  // projectPointsByTeam بمقياس "الأبناط الأساسي" (زي البلوت: 2/5/10/40) - نضربه بمضاعف النظام
  // (×2 بالصن، مضاعفة أصيلة تلقائية تماماً زي نقاط الورق - ×1 بالحكم بدون تغيير)
  const buyerProjects = (projectPointsByTeam[buyerTeam] ?? 0) * sysMultiplier;
  const opponentProjects = (projectPointsByTeam[opponentTeam] ?? 0) * sysMultiplier;
  const allProjects = buyerProjects + opponentProjects;

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

  // ===== كابوت: يستبدل كل الحساب - نقاط ثابتة + مشاريع الفريق نفسه (مضروبة بمضاعف النظام)، مضروبة بمعامل الدبل =====
  if (capotTeam) {
    const loserTeam = capotTeam === "A" ? "B" : "A";
    const base = CAPOT_POINTS[system];
    const withProjects = base + (projectPointsByTeam[capotTeam] ?? 0) * sysMultiplier;
    const finalPoints = { [capotTeam]: withProjects * doubleMultiplier, [loserTeam]: 0 };
    return {
      ...finalize(finalPoints, { capotTeam, capotBasePoints: base }),
      isCapot: true, isDefeat: false,
    };
  }

  // ===== نقاط الورق (بما فيها الأرضية) =====
  const cardTotals = { ...cardTotalsRaw };
  cardTotals[lastTrickWinnerTeam] += LAST_TRICK_BONUS;

  const buyerAbnat = roundToAbnat(cardTotals[buyerTeam]);
  const opponentAbnat = roundToAbnat(cardTotals[opponentTeam]);
  const full = FULL_ABNAT[system];
  const breakdown = { ...breakdownBase, buyerAbnat, opponentAbnat };

  if (doubleMultiplier > 1) {
    // ===== دبل فعّال: مقارنة شاملة (بنط الورق × مضاعف النظام + مشروع كل فريق) - المشروع ممكن يقلب النتيجة =====
    const buyerTotal = buyerAbnat * sysMultiplier + buyerProjects;
    const opponentTotal = opponentAbnat * sysMultiplier + opponentProjects;
    const pot = (full * sysMultiplier + allProjects) * doubleMultiplier;
    const buyerWins = buyerTotal > opponentTotal; // تعادل المجموع الشامل يُعامَل كخسران فوري على المشتري
    const finalPoints = buyerWins ? { [buyerTeam]: pot, [opponentTeam]: 0 } : { [buyerTeam]: 0, [opponentTeam]: pot };
    return { ...finalize(finalPoints, breakdown), isCapot: false, isDefeat: !buyerWins };
  }

  // ===== بدون دبل: الأبناط وحدها تحدد الفائز - بدون أي تأجيل أو تعليق =====
  if (buyerAbnat < opponentAbnat) {
    // خسران - كل نقاط اليد (المجموع الكامل) + كل المشاريع (الفريقين) تروح للخصم بالكامل
    const finalPoints = { [buyerTeam]: 0, [opponentTeam]: full * sysMultiplier + allProjects };
    return { ...finalize(finalPoints, breakdown), isCapot: false, isDefeat: true };
  }

  // نجاح أو تعادل تام - كل فريق ياخذ نصيبه + مشروعه الخاص فوراً (بالتعادل يتساويان تلقائياً)
  const finalPoints = {
    [buyerTeam]: buyerAbnat * sysMultiplier + buyerProjects,
    [opponentTeam]: opponentAbnat * sysMultiplier + opponentProjects,
  };
  return { ...finalize(finalPoints, breakdown), isCapot: false, isDefeat: false };
}
