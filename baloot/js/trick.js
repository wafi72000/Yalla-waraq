// trick.js — منطق أخذ الأشواط: اتباع اللون، القطع/التغسيل، الالتزام بالحكم الأعلى، تحديد الفائز

import { HandRuleError } from "./deal.js";
import { strengthIndex } from "./models.js";

/// يحسب مين صاحب أقوى ورقة حالياً على الأرض بشوط جارٍ (cardsPlayed: [{playerID, card}])
/// leadSuit = لون أول ورقة انطرحت، trumpSuit = لون الحكم (null لو صن)
function currentWinner(cardsPlayed, leadSuit, trumpSuit) {
  let best = null;
  for (const entry of cardsPlayed) {
    const isTrump = trumpSuit !== null && entry.card.suit === trumpSuit;
    const isLeadSuit = entry.card.suit === leadSuit;
    if (!isTrump && !isLeadSuit) continue; // ورقة "تغسيل" ما تنافس على الشوط إطلاقاً

    if (!best) { best = entry; continue; }
    const bestIsTrump = trumpSuit !== null && best.card.suit === trumpSuit;
    if (isTrump && !bestIsTrump) { best = entry; continue; } // أي حكم يغلب أي لون عادي
    if (!isTrump && bestIsTrump) continue;
    // نفس الفئة (كلاهما حكم أو كلاهما لون القيادة) - يقارن القوة داخل نفس اللون
    if (strengthIndex(entry.card, trumpSuit) < strengthIndex(best.card, trumpSuit)) best = entry;
  }
  return best;
}

/// partnerOfID(playerID) ترجع معرّف شريك اللاعب
/// يتحقق هل رمية معينة "قانونية" حسب حالة الشوط الجارية، ويرمي HandRuleError لو لا
export function validatePlay({ hand, card, cardsPlayed, trumpSuit, partnerOfID, playerID }) {
  if (!hand.some((c) => c.id === card.id)) {
    throw new HandRuleError("هذي الورقة مو بيدك");
  }
  if (cardsPlayed.length === 0) {
    return; // أول رمية بالشوط - أي ورقة تصير
  }

  const leadSuit = cardsPlayed[0].card.suit;
  const hasLeadSuit = hand.some((c) => c.suit === leadSuit);
  const isTrumpSystem = trumpSuit !== null;

  if (hasLeadSuit) {
    if (card.suit !== leadSuit) {
      throw new HandRuleError("لازم تتبع اللون المطروح");
    }
    // لو لون القيادة نفسه لون الحكم، يطبّق قيد "الحكم الأعلى" أيضاً (يُغطّى بالفرع تحت لأن leadSuit===trumpSuit)
  } else if (isTrumpSystem) {
    // ما معك لون القيادة، وباللعب حكم - لازم تقطع بحكم إلا لو زميلك صاحب أقوى ورقة حالياً
    const hasTrump = hand.some((c) => c.suit === trumpSuit);
    const winner = currentWinner(cardsPlayed, leadSuit, trumpSuit);
    const partnerIsWinning = winner && partnerOfID(playerID) === winner.playerID;
    if (hasTrump && !partnerIsWinning && card.suit !== trumpSuit) {
      throw new HandRuleError("لازم تقطع بالحكم (قاطوع) - ما معك لون القيادة وزميلك مو صاحب الورقة الأقوى");
    }
    // partnerIsWinning => التغسيل مسموح بأي لون - ما فيه قيد إضافي
  }
  // بالصن، لو ما معك لون القيادة: حرية تامة (يُغطّى ضمنياً بعدم رمي أي خطأ هنا)

  // الالتزام بالحكم الأعلى: لو معك حكم ولون القيادة نفسه الحكم (أو أنت تقطع بحكم)، ولُعب حكم على الأرض بالفعل
  if (isTrumpSystem && card.suit === trumpSuit) {
    const trumpsOnTable = cardsPlayed.filter((e) => e.card.suit === trumpSuit);
    if (trumpsOnTable.length > 0) {
      const winner = currentWinner(cardsPlayed, leadSuit, trumpSuit);
      const partnerIsWinning = winner && partnerOfID(playerID) === winner.playerID;
      if (!partnerIsWinning) {
        const highestTrumpOnTable = trumpsOnTable.reduce((a, b) =>
          strengthIndex(a.card, trumpSuit) < strengthIndex(b.card, trumpSuit) ? a : b
        );
        const higherTrumpsInHand = hand.filter(
          (c) => c.suit === trumpSuit && strengthIndex(c, trumpSuit) < strengthIndex(highestTrumpOnTable.card, trumpSuit)
        );
        if (higherTrumpsInHand.length > 0 && strengthIndex(card, trumpSuit) >= strengthIndex(highestTrumpOnTable.card, trumpSuit)) {
          throw new HandRuleError("لازم ترمي حكم أعلى من المطروح - معك حكم أقوى");
        }
      }
    }
  }
}

/// يحدد الفائز بشوط مكتمل (4 رميات) - يرجّع playerID
export function determineTrickWinner(cardsPlayed, trumpSuit) {
  if (cardsPlayed.length !== 4) throw new HandRuleError("الشوط لازم يكون فيه 4 رميات بالضبط");
  const leadSuit = cardsPlayed[0].card.suit;
  const winner = currentWinner(cardsPlayed, leadSuit, trumpSuit);
  return winner.playerID;
}
