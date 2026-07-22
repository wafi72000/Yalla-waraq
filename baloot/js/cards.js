// cards.js — عرض وتحميل صور الورق (SVG) + بديل نصي موثوق لو فشل التحميل
// دوال نقية بالكامل: تاخذ card كمدخل وترجع/تعدّل عنصر DOM - بدون أي اعتماد على حالة المباراة (match)

import { Suit, rankDisplayName } from "./models.js";

export const SUIT_SYMBOL = { hearts: "♥", diamonds: "♦", clubs: "♣", spades: "♠" };

export function suitIsRed(suit) { return suit === Suit.HEARTS || suit === Suit.DIAMONDS; }

const FACE_SUIT_NAME = { hearts: "heart", diamonds: "diamond", clubs: "club", spades: "spade" };
const RANK_FILE_NAME = { 11: "jack", 12: "queen", 13: "king", 14: "1" }; // الأص بترقيم ملفات SVG المصدر = 1

function cardImagePath(card) {
  const rankPart = RANK_FILE_NAME[card.rank] ?? String(card.rank);
  return `assets/faces/${FACE_SUIT_NAME[card.suit]}_${rankPart}.svg`;
}

/// تحميل مسبق لكل صور الورق الـ32 فور تحميل الصفحة (قبل حتى ما يضغط "ابدأ") - يملأ كاش المتصفح
/// مبكراً فيقل احتمال ظهور ورقة فاضية بسبب بطء/انقطاع الشبكة وقت اللعب الفعلي نفسه
export function preloadCardImages() {
  for (const suit of Object.values(Suit)) {
    for (const rank of [7, 8, 9, 10, 11, 12, 13, 14]) {
      const img = document.createElement("img");
      img.src = cardImagePath({ suit, rank });
    }
  }
}

const RANK_SHORT_LABEL = { 7: "7", 8: "8", 9: "9", 10: "10", 11: "J", 12: "Q", 13: "K", 14: "A" };

/// بديل نصي موثوق 100% (بدون أي طلب شبكة) - يُستخدم بس لو صورة SVG فشلت تحميلها لأي سبب،
/// عشان الورقة ما تظهر فاضية أبداً بغض النظر عن حالة الشبكة
function buildFallbackCardFace(card, container) {
  container.classList.remove("card-image");
  container.classList.add("card-fallback");
  container.innerHTML = "";
  const isRed = suitIsRed(card.suit);
  const rankLabel = RANK_SHORT_LABEL[card.rank] ?? String(card.rank);
  const suitSymbol = SUIT_SYMBOL[card.suit];
  const color = isRed ? "#c0392b" : "#1a1a1a";
  const corner = (rot) => {
    const el = document.createElement("div");
    el.className = "fallback-corner";
    el.style.color = color;
    el.style.transform = rot ? "rotate(180deg)" : "";
    el.innerHTML = `<div>${rankLabel}</div><div>${suitSymbol}</div>`;
    return el;
  };
  const center = document.createElement("div");
  center.className = "fallback-center-suit";
  center.style.color = color;
  center.textContent = suitSymbol;
  container.appendChild(corner(false));
  container.appendChild(center);
  container.appendChild(corner(true));
}

export function cardDisplay(card) {
  const div = document.createElement("div");
  div.className = "card card-image"; // رسمة حقيقية بدل النص - تمييز أوضح بكثير من الأرقام والحروف
  div.dataset.cardId = card.id;
  const img = document.createElement("img");
  img.src = cardImagePath(card);
  img.alt = `${rankDisplayName(card.rank)} ${SUIT_SYMBOL[card.suit]}`;
  img.draggable = false;
  img.onerror = () => buildFallbackCardFace(card, div); // فشل تحميل الصورة (شبكة) - نبدّلها ببديل نصي فوراً
  div.appendChild(img);
  return div;
}
