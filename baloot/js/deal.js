// deal.js — منطق التوزيع: 3+2 أولاً، ورقة مفروشة، ثم إكمال التوزيع بعد الشراء (بما فيها حالة الإشكال)

import { freshDeck, shuffle } from "./models.js";

export class HandRuleError extends Error {}

/// يوزّع 3 ثم 2 ورقة لكل لاعب بالترتيب (يبدأ من seatOrder[0])، ويفرش ورقة وحدة
/// seatOrder: مصفوفة player IDs بترتيب التوزيع (يبدأ من يمين الموزّع)
/// يرجّع { hands: Map<playerID, card[]>, flippedCard, remainingDeck }
export function dealInitial(seatOrder) {
  const deck = shuffle(freshDeck());
  const hands = new Map(seatOrder.map((id) => [id, []]));
  let cursor = 0;

  for (const count of [3, 2]) {
    for (const playerID of seatOrder) {
      for (let i = 0; i < count; i++) {
        hands.get(playerID).push(deck[cursor]);
        cursor++;
      }
    }
  }

  const flippedCard = deck[cursor];
  cursor++;

  return { hands, flippedCard, remainingDeck: deck.slice(cursor) };
}

/// يكمّل التوزيع بعد الشراء. buyerID = مين اشترى. isAshkal = هل اختار "اشكل" (الورقة تروح لزميله بدل المشتري)
/// partnerOfID(playerID) دالة ترجع معرّف شريك أي لاعب
/// يعدّل hands و remainingDeck في مكانهم (mutation) ويرجّع الحالة النهائية
export function completeDealAfterPurchase({ hands, remainingDeck, flippedCard }, seatOrder, buyerID, isAshkal, partnerOfID) {
  let cursor = 0;
  const recipientOfFlipped = isAshkal ? partnerOfID(buyerID) : buyerID;

  for (const playerID of seatOrder) {
    const isRecipient = playerID === recipientOfFlipped;
    const isBuyer = playerID === buyerID;
    // المستلم (سواء المشتري العادي أو زميل المشتري بالإشكال) ياخذ ورقتين تكميل (لأنه استلم المفروشة أصلاً)
    // الباقي (بما فيهم المشتري نفسه لو اشكل) ياخذ 3
    const count = isRecipient ? 2 : 3;
    for (let i = 0; i < count; i++) {
      hands.get(playerID).push(remainingDeck[cursor]);
      cursor++;
    }
  }

  hands.get(recipientOfFlipped).push(flippedCard);

  return { hands, remainingDeck: remainingDeck.slice(cursor) };
}
