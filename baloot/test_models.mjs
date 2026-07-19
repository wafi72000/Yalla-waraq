import { freshDeck, cardValue, strengthIndex, Suit, Rank, makeCard, NORMAL_SUIT_VALUES, TRUMP_SUIT_VALUES } from "./js/models.js";

let pass = 0, fail = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "✅" : "❌"} ${name} → ${JSON.stringify(actual)} (متوقع: ${JSON.stringify(expected)})`);
  ok ? pass++ : fail++;
}

// ===== الدستة 32 ورقة بالضبط، بدون تكرار =====
{
  const deck = freshDeck();
  check("الدستة 32 ورقة", deck.length, 32);
  const uniqueIds = new Set(deck.map((c) => c.id));
  check("كل الورق بمعرّف فريد", uniqueIds.size, 32);
  const pairs = new Set(deck.map((c) => `${c.suit}-${c.rank}`));
  check("لا يوجد تكرار (نوع+رتبة)", pairs.size, 32);
}

// ===== مجموع نقاط الصن = 120 (بدون آخر أكلة) =====
{
  let total = 0;
  const deck = freshDeck();
  for (const c of deck) total += cardValue(c, null); // null = صن
  check("مجموع نقاط الصن (بدون آخر أكلة) = 120", total, 120);
}

// ===== مجموع نقاط الحكم = 152 (بدون آخر أكلة) - 20+14+11+10+4+3+0+0=62 لكل لون حكم واحد، +90 للثلاث ألوان العادية (30*3) =====
{
  const deck = freshDeck();
  let total = 0;
  for (const c of deck) total += cardValue(c, Suit.HEARTS); // نفترض القلوب حكم
  // لون الحكم: 20+14+11+10+4+3+0+0 = 62
  // 3 ألوان عادية: كل وحدة 11+10+4+3+2+0+0+0=30 → 30*3=90
  // المجموع: 62+90=152
  check("مجموع نقاط الحكم (بدون آخر أكلة) = 152", total, 152);
}

// ===== ترتيب القوة بالحكم: الولد أقوى من التسعة أقوى من الآس =====
{
  const jack = makeCard(Suit.HEARTS, Rank.JACK);
  const nine = makeCard(Suit.HEARTS, Rank.NINE);
  const ace = makeCard(Suit.HEARTS, Rank.ACE);
  check("الولد أقوى ورقة بالحكم (index أصغر)", strengthIndex(jack, Suit.HEARTS) < strengthIndex(nine, Suit.HEARTS), true);
  check("التسعة أقوى من الآس بالحكم", strengthIndex(nine, Suit.HEARTS) < strengthIndex(ace, Suit.HEARTS), true);
}

// ===== ترتيب القوة بالصن (لون عادي): الآس أقوى شي =====
{
  const ace = makeCard(Suit.HEARTS, Rank.ACE);
  const ten = makeCard(Suit.HEARTS, Rank.TEN);
  check("الآس أقوى من العشرة بالصن (لون غير حكم)", strengthIndex(ace, null) < strengthIndex(ten, null), true);
}

// ===== قيمة الورقة تتغيّر حسب كونها لون الحكم أو لا =====
{
  const jackHearts = makeCard(Suit.HEARTS, Rank.JACK);
  check("قيمة الولد بلون الحكم = 20", cardValue(jackHearts, Suit.HEARTS), 20);
  check("قيمة الولد بلون عادي (مش حكم) = 2", cardValue(jackHearts, Suit.DIAMONDS), 2);
}

console.log(`\n— النتيجة: ${pass} ناجح، ${fail} فاشل —`);
process.exit(fail > 0 ? 1 : 0);
