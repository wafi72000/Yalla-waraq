// cards.js — عرض صور الورق (SVG) - دوال نقية بالكامل، بدون أي اعتماد على حالة اللعبة (engine)

import { Suit, SUIT_SYMBOL, isRedSuit, rankDisplayName } from "./models.js";

const FACE_SUIT_NAME = {
  [Suit.HEARTS]: "heart",
  [Suit.DIAMONDS]: "diamond",
  [Suit.CLUBS]: "club",
  [Suit.SPADES]: "spade",
};
const RANK_FILE_NAME = { 11: "jack", 12: "queen", 13: "king", 14: "1" }; // الأص بترقيم المصدر = 1

export function cardImagePath(card) {
  if (card.isJoker) return "../shared/assets/faces/joker.svg";
  const rankPart = RANK_FILE_NAME[card.rank] ?? String(card.rank);
  return `../shared/assets/faces/${FACE_SUIT_NAME[card.suit]}_${rankPart}.svg`;
}

export function cardEl(card, { mini = false, selected = false } = {}) {
  const div = document.createElement("div");
  div.className = "card" + (mini ? " mini" : "");
  div.dataset.cardId = card.id;

  // صورة حقيقية لكل الورق (نفس مصدر الصور الاحترافي)، بحجم كامل أو مصغّر (mini) حسب السياق
  const img = document.createElement("img");
  img.src = cardImagePath(card);
  img.alt = card.isJoker ? "جوكر" : `${rankDisplayName(card.rank)} ${SUIT_SYMBOL[card.suit]}`;
  img.className = "face-card-img";
  img.draggable = false;
  div.appendChild(img);
  if (!card.isJoker && isRedSuit(card.suit)) div.classList.add("red");
  if (card.isJoker) div.classList.add("joker");

  if (selected) div.classList.add("selected");
  return div;
}
