// scoring.js — حساب نقاط البيرات بقواعد الهند الخاصة (الأص حسب موضعه، الجوكر حسب ما يمثله)

import { MeldKind, resolveRunSequence } from "./meld.js";

export const LOOSE_JOKER_VALUE = 11;

function faceValue(rank) {
  if (rank === 11 || rank === 12 || rank === 13) return 10; // J, Q, K
  if (rank === 14) return 11; // الأص خارج سياق بير (احتياطي)
  return rank; // 2-10
}

function setPoints(cards) {
  const realCard = cards.find((c) => !c.isJoker);
  if (!realCard) return 0;
  const rank = realCard.rank;
  const valuePerCard = rank === 14 ? 11 : faceValue(rank);
  return valuePerCard * cards.length;
}

function runPoints(cards) {
  const seq = resolveRunSequence(cards);
  if (!seq) return 0;
  let total = 0;
  for (let v = seq.min; v <= seq.max; v++) {
    if (v === 1) total += 1; // أص بأسفل التسلسل
    else if (v >= 11 && v <= 14) total += 10; // ولد/بنت/شايب، أو أص بأعلى التسلسل
    else total += v; // عدد عادي 2-10
  }
  return total;
}

export function totalPoints(cards, kind) {
  return kind === MeldKind.SET ? setPoints(cards) : runPoints(cards);
}

// قيمة ورقة لقطة (بدون بير) - تُستخدم لحساب عقوبة النازل بنهاية الجولة
export function looseCardValue(card) {
  if (card.isJoker) return LOOSE_JOKER_VALUE;
  return faceValue(card.rank);
}

export function totalLoosePoints(cards) {
  return cards.reduce((sum, c) => sum + looseCardValue(c), 0);
}
