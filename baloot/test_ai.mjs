import { aiDecideDouble, aiChooseCard } from "./js/ai.js";
import { makeCard, Suit, Rank } from "./js/models.js";

let pass = 0, fail = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "✅" : "❌"} ${name} → ${JSON.stringify(actual)} (متوقع: ${JSON.stringify(expected)})`);
  ok ? pass++ : fail++;
}

function partnerOf(id) {
  const map = { p1: "p3", p3: "p1", p2: "p4", p4: "p2" };
  return map[id];
}

// ===== الدبل: يد حكم ضعيفة - ما يطلب الدبل =====
{
  const weakHand = [makeCard(Suit.HEARTS, Rank.SEVEN), makeCard(Suit.SPADES, Rank.EIGHT)];
  check("يد ضعيفة - ما يطلب دبل", aiDecideDouble(weakHand, Suit.HEARTS, 0, "opponent"), false);
}

// ===== الدبل: يد حكم قوية جداً (4+ حكم بما فيها الولد) - يطلب دبل =====
{
  const strongHand = [
    makeCard(Suit.HEARTS, Rank.JACK), makeCard(Suit.HEARTS, Rank.NINE),
    makeCard(Suit.HEARTS, Rank.ACE), makeCard(Suit.HEARTS, Rank.TEN),
  ];
  check("يد حكم قوية جداً - يطلب دبل", aiDecideDouble(strongHand, Suit.HEARTS, 0, "opponent"), true);
}

// ===== الدبل: ما يتجاوز مستوى فور (3) - يتوقف بحد أقصى محافظ =====
{
  const strongHand = [
    makeCard(Suit.HEARTS, Rank.JACK), makeCard(Suit.HEARTS, Rank.NINE),
    makeCard(Suit.HEARTS, Rank.ACE), makeCard(Suit.HEARTS, Rank.TEN), makeCard(Suit.HEARTS, Rank.KING),
  ];
  check("ما يصعّد فوق مستوى 3 (فور)", aiDecideDouble(strongHand, Suit.HEARTS, 3, "buyer"), false);
}

// ===== اللعب: شريكي رابح - يرمي أرخص ورقة بدل يضحّي بالقوية =====
{
  const hand = [makeCard(Suit.SPADES, Rank.ACE), makeCard(Suit.SPADES, Rank.SEVEN)]; // آس وسبعة سبيت
  const cardsPlayed = [
    { playerID: "p2", card: makeCard(Suit.SPADES, Rank.QUEEN) },
    { playerID: "p3", card: makeCard(Suit.SPADES, Rank.KING) }, // شريك p1 (اللاعب الحالي)، وهو الأقوى حالياً
  ];
  const chosen = aiChooseCard(hand, cardsPlayed, null, partnerOf, "p1");
  check("شريكي رابح - يرمي السبعة (الأرخص) مش الآس", chosen.rank, Rank.SEVEN);
}

// ===== اللعب: خصمي رابح، أقدر آخذ الشوط - يحاول يفوز بأضعف ورقة كافية =====
{
  const hand = [makeCard(Suit.SPADES, Rank.ACE), makeCard(Suit.SPADES, Rank.KING)]; // آس وشايب سبيت
  const cardsPlayed = [
    { playerID: "p2", card: makeCard(Suit.SPADES, Rank.QUEEN) }, // خصم رابح حالياً بالبنت
  ];
  const chosen = aiChooseCard(hand, cardsPlayed, null, partnerOf, "p1");
  check("يفوز بأضعف ورقة كافية (الشايب يكفي، مش الآس)", chosen.rank, Rank.KING);
}

// ===== اللعب: فتح شوط جديد - يتجنّب لون يعرف إن خصمه (مو شريكه) فاضي منه =====
{
  // p4 (خصم p1) معروف فاضي من القلوب (من شوط سابق ما اتبع فيه رغم كونه لون القيادة)
  const completedTricks = [{
    plays: [
      { playerID: "p1", card: makeCard(Suit.HEARTS, Rank.SEVEN) }, // فتح بالقلوب
      { playerID: "p2", card: makeCard(Suit.HEARTS, Rank.EIGHT) },
      { playerID: "p3", card: makeCard(Suit.HEARTS, Rank.NINE) },
      { playerID: "p4", card: makeCard(Suit.SPADES, Rank.SEVEN) }, // p4 ما اتبع القلوب - فاضي منها
    ],
  }];
  const hand = [makeCard(Suit.HEARTS, Rank.ACE), makeCard(Suit.CLUBS, Rank.ACE)]; // آس قلوب وآس كلوب، بدون حكم
  const chosen = aiChooseCard(hand, [], Suit.DIAMONDS, partnerOf, "p1", completedTricks); // الحكم=ديناموند (لا علاقة له بالقلوب/الكلوب)
  check("يتجنّب فتح القلوب (خصمه p4 فاضي منها، يقدر يقطعها) - يفتح كلوب بدلها", chosen.suit, Suit.CLUBS);
}

console.log(`\n— النتيجة: ${pass} ناجح، ${fail} فاشل —`);
process.exit(fail > 0 ? 1 : 0);
