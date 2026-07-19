// models.js — الورقة الأساسية بلعبة البلوت: 32 ورقة (7 إلى الآس)، بدون جوكر

export const Suit = {
  HEARTS: "hearts",
  DIAMONDS: "diamonds",
  CLUBS: "clubs",
  SPADES: "spades",
};

export const ALL_SUITS = [Suit.HEARTS, Suit.DIAMONDS, Suit.CLUBS, Suit.SPADES];

// الرتب المستخدمة فقط (بدون 2-6) - نفس ترميز رقمي يسهل المقارنة (الأص أعلى قيمة رمزياً هنا، القيم الفعلية بجداول منفصلة تحت)
export const Rank = {
  SEVEN: 7,
  EIGHT: 8,
  NINE: 9,
  TEN: 10,
  JACK: 11,
  QUEEN: 12,
  KING: 13,
  ACE: 14,
};

export const ALL_RANKS = [
  Rank.SEVEN, Rank.EIGHT, Rank.NINE, Rank.TEN,
  Rank.JACK, Rank.QUEEN, Rank.KING, Rank.ACE,
];

/// قيمة كل رتبة بالألوان العادية (الصن، أو أي لون غير لون الحكم) - نفس الترتيب بالنظامين
export const NORMAL_SUIT_VALUES = {
  [Rank.ACE]: 11,
  [Rank.TEN]: 10,
  [Rank.KING]: 4,
  [Rank.QUEEN]: 3,
  [Rank.JACK]: 2,
  [Rank.NINE]: 0,
  [Rank.EIGHT]: 0,
  [Rank.SEVEN]: 0,
};

/// قيمة كل رتبة بلون الحكم (الطرنيب) فقط - ترتيب مختلف تماماً، الولد والتسعة أقوى شي
export const TRUMP_SUIT_VALUES = {
  [Rank.JACK]: 20,
  [Rank.NINE]: 14,
  [Rank.ACE]: 11,
  [Rank.TEN]: 10,
  [Rank.KING]: 4,
  [Rank.QUEEN]: 3,
  [Rank.EIGHT]: 0,
  [Rank.SEVEN]: 0,
};

/// ترتيب القوة بالألوان العادية (تحديد "مين ورقته أقوى" وقت أخذ الشوط) - نفس ترتيب القيمة هنا بالمصادفة، بس منفصل منطقياً
export const NORMAL_SUIT_STRENGTH_ORDER = [
  Rank.ACE, Rank.TEN, Rank.KING, Rank.QUEEN, Rank.JACK, Rank.NINE, Rank.EIGHT, Rank.SEVEN,
];

/// ترتيب القوة بلون الحكم - الولد أقوى شي، بعده التسعة
export const TRUMP_SUIT_STRENGTH_ORDER = [
  Rank.JACK, Rank.NINE, Rank.ACE, Rank.TEN, Rank.KING, Rank.QUEEN, Rank.EIGHT, Rank.SEVEN,
];

/// ترتيب القوة لفض تعادل المشاريع (منفصل تماماً عن قوة اللعب - دايماً A>K>Q>J>10>9>8>7 بغض النظر عن حكم/صن)
export const PROJECT_TIEBREAK_ORDER = [
  Rank.ACE, Rank.KING, Rank.QUEEN, Rank.JACK, Rank.TEN, Rank.NINE, Rank.EIGHT, Rank.SEVEN,
];

let cardIdCounter = 0;

export function makeCard(suit, rank) {
  cardIdCounter += 1;
  return { id: `c${cardIdCounter}-${suit}-${rank}`, suit, rank };
}

export function freshDeck() {
  const deck = [];
  for (const suit of ALL_SUITS) {
    for (const rank of ALL_RANKS) {
      deck.push(makeCard(suit, rank));
    }
  }
  return deck;
}

export function shuffle(deck) {
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/// قيمة ورقة معينة حسب نوع اللعب الحالي (trumpSuit = null يعني صن، وإلا الحكم بذاك اللون)
export function cardValue(card, trumpSuit) {
  const isTrump = trumpSuit !== null && card.suit === trumpSuit;
  return isTrump ? TRUMP_SUIT_VALUES[card.rank] : NORMAL_SUIT_VALUES[card.rank];
}

/// رقم قوة ورقة معينة داخل لونها (للمقارنة وقت أخذ الشوط) - أصغر = أقوى (index 0 بالمصفوفة)
export function strengthIndex(card, trumpSuit) {
  const isTrump = trumpSuit !== null && card.suit === trumpSuit;
  const order = isTrump ? TRUMP_SUIT_STRENGTH_ORDER : NORMAL_SUIT_STRENGTH_ORDER;
  return order.indexOf(card.rank);
}

export function rankDisplayName(rank) {
  switch (rank) {
    case Rank.ACE: return "آس";
    case Rank.KING: return "شايب";
    case Rank.QUEEN: return "بنت";
    case Rank.JACK: return "ولد";
    default: return String(rank === 10 ? 10 : rank);
  }
}
