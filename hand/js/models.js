// models.js — الورقة، النوع، الرتبة، الدِّستة

export const Suit = Object.freeze({
  HEARTS: "hearts",
  DIAMONDS: "diamonds",
  CLUBS: "clubs",
  SPADES: "spades",
});

export const SUIT_SYMBOL = {
  [Suit.HEARTS]: "♥",
  [Suit.DIAMONDS]: "♦",
  [Suit.CLUBS]: "♣",
  [Suit.SPADES]: "♠",
};

export function isRedSuit(suit) {
  return suit === Suit.HEARTS || suit === Suit.DIAMONDS;
}

// الرتبة: rawValue رقمي من 2 إلى 14 (الأص = 14 بالخام، يُعالج بسياق خاص بكل بير)
export const Rank = Object.freeze({
  TWO: 2, THREE: 3, FOUR: 4, FIVE: 5, SIX: 6, SEVEN: 7, EIGHT: 8,
  NINE: 9, TEN: 10, JACK: 11, QUEEN: 12, KING: 13, ACE: 14,
});

export const ALL_RANKS = [
  Rank.TWO, Rank.THREE, Rank.FOUR, Rank.FIVE, Rank.SIX, Rank.SEVEN, Rank.EIGHT,
  Rank.NINE, Rank.TEN, Rank.JACK, Rank.QUEEN, Rank.KING, Rank.ACE,
];

// رتب البلوت فقط (7 إلى الأص - 32 ورقة) - للمستقبل
export const BALOOT_RANKS = [
  Rank.SEVEN, Rank.EIGHT, Rank.NINE, Rank.TEN, Rank.JACK, Rank.QUEEN, Rank.KING, Rank.ACE,
];

export function rankDisplayName(rank) {
  switch (rank) {
    case Rank.JACK: return "J";
    case Rank.QUEEN: return "Q";
    case Rank.KING: return "K";
    case Rank.ACE: return "A";
    default: return String(rank);
  }
}

let _cardIdCounter = 0;
function nextId() {
  _cardIdCounter += 1;
  return `c${_cardIdCounter}`;
}

export function makeCard(suit, rank) {
  return { id: nextId(), suit, rank, isJoker: false };
}

export function makeJoker() {
  return { id: nextId(), suit: null, rank: null, isJoker: true };
}

// MARK: - الدِّستة

export class Deck {
  constructor(cards) {
    this.cards = cards; // آخر عنصر بالمصفوفة = فوق الدِّستة
  }

  static handDeck() {
    const cards = [];
    for (let d = 0; d < 2; d++) {
      for (const suit of Object.values(Suit)) {
        for (const rank of ALL_RANKS) {
          cards.push(makeCard(suit, rank));
        }
      }
    }
    cards.push(makeJoker());
    cards.push(makeJoker());
    return new Deck(cards);
  }

  static balootDeck() {
    const cards = [];
    for (const suit of Object.values(Suit)) {
      for (const rank of BALOOT_RANKS) {
        cards.push(makeCard(suit, rank));
      }
    }
    return new Deck(cards);
  }

  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  drawOne() {
    return this.cards.pop() ?? null;
  }

  deal(cardsPerPlayer, playersCount) {
    const needed = cardsPerPlayer * playersCount;
    if (needed > this.cards.length) {
      throw new Error("لا يوجد ورق كافٍ للتوزيع");
    }
    const hands = Array.from({ length: playersCount }, () => []);
    for (let i = 0; i < needed; i++) {
      const playerIndex = i % playersCount;
      hands[playerIndex].push(this.cards.pop());
    }
    return hands;
  }

  renew(discardPile) {
    this.cards = [...discardPile];
    this.shuffle();
  }

  get isEmpty() { return this.cards.length === 0; }
  get count() { return this.cards.length; }
}
