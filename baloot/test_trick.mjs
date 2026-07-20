import { validatePlay, determineTrickWinner } from "./js/trick.js";
import { makeCard, Suit, Rank } from "./js/models.js";

let pass = 0, fail = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "✅" : "❌"} ${name} → ${JSON.stringify(actual)} (متوقع: ${JSON.stringify(expected)})`);
  ok ? pass++ : fail++;
}
function checkThrows(name, fn) {
  try { fn(); console.log(`❌ ${name} (يفترض يفشل)`); fail++; }
  catch (e) { console.log(`✅ ${name} (يفترض يفشل) - ${e.message}`); pass++; }
}
function checkOk(name, fn) {
  try { fn(); console.log(`✅ ${name} (يفترض ينجح)`); pass++; }
  catch (e) { console.log(`❌ ${name} (يفترض ينجح) - ${e.message}`); fail++; }
}

function partnerOf(id) {
  const map = { p1: "p3", p3: "p1", p2: "p4", p4: "p2" };
  return map[id];
}

// ===== أول رمية بالشوط - أي ورقة تصير =====
{
  const hand = [makeCard(Suit.HEARTS, Rank.SEVEN), makeCard(Suit.SPADES, Rank.NINE)];
  checkOk("أول رمية بالشوط حرة تماماً", () =>
    validatePlay({ hand, card: hand[1], cardsPlayed: [], trumpSuit: null, partnerOfID: partnerOf, playerID: "p1" })
  );
}

// ===== اتباع اللون إلزامي (لو معك) =====
{
  const hand = [makeCard(Suit.HEARTS, Rank.SEVEN), makeCard(Suit.SPADES, Rank.NINE)];
  const cardsPlayed = [{ playerID: "p2", card: makeCard(Suit.HEARTS, Rank.KING) }];
  checkThrows("رمي لون مختلف رغم امتلاك لون القيادة يُرفض", () =>
    validatePlay({ hand, card: hand[1], cardsPlayed, trumpSuit: null, partnerOfID: partnerOf, playerID: "p1" })
  );
  checkOk("رمي نفس لون القيادة ينجح", () =>
    validatePlay({ hand, card: hand[0], cardsPlayed, trumpSuit: null, partnerOfID: partnerOf, playerID: "p1" })
  );
}

// ===== بالصن: ما معك لون القيادة → حرية تامة =====
{
  const hand = [makeCard(Suit.SPADES, Rank.NINE), makeCard(Suit.CLUBS, Rank.SEVEN)];
  const cardsPlayed = [{ playerID: "p2", card: makeCard(Suit.HEARTS, Rank.KING) }];
  checkOk("بالصن، ما معك لون القيادة - أي ورقة تصير", () =>
    validatePlay({ hand, card: hand[0], cardsPlayed, trumpSuit: null, partnerOfID: partnerOf, playerID: "p1" })
  );
}

// ===== بالحكم: ما معك لون القيادة، لازم تقطع (قاطوع) لو معك حكم =====
{
  const hand = [makeCard(Suit.SPADES, Rank.SEVEN), makeCard(Suit.CLUBS, Rank.NINE)]; // كلوب = الحكم هنا
  const cardsPlayed = [{ playerID: "p2", card: makeCard(Suit.HEARTS, Rank.KING) }];
  checkThrows("بالحكم، ما معك لون القيادة، لازم تقطع لو معك حكم", () =>
    validatePlay({ hand, card: hand[0], cardsPlayed, trumpSuit: Suit.CLUBS, partnerOfID: partnerOf, playerID: "p1" })
  );
  checkOk("رمي الحكم (القطع) ينجح", () =>
    validatePlay({ hand, card: hand[1], cardsPlayed, trumpSuit: Suit.CLUBS, partnerOfID: partnerOf, playerID: "p1" })
  );
}

// ===== تغسيل: زميلك صاحب أقوى ورقة - تقدر ترمي أي لون بدون قطع =====
{
  const hand = [makeCard(Suit.SPADES, Rank.SEVEN), makeCard(Suit.CLUBS, Rank.NINE)];
  // p3 هو زميل p1 (partnerOf) وهو صاحب أقوى ورقة (KING بلون القيادة، ولا أحد قطع بعد)
  const cardsPlayed = [
    { playerID: "p2", card: makeCard(Suit.HEARTS, Rank.QUEEN) },
    { playerID: "p3", card: makeCard(Suit.HEARTS, Rank.KING) }, // زميل p1، وهو الأقوى حالياً
  ];
  checkOk("زميلك صاحب أقوى ورقة - التغسيل مسموح بدون قطع", () =>
    validatePlay({ hand, card: hand[0], cardsPlayed, trumpSuit: Suit.CLUBS, partnerOfID: partnerOf, playerID: "p1" })
  );
}

// ===== الالتزام بالحكم الأعلى: لو حكم مطروح ومعك أعلى منه، لازم ترميه =====
{
  const hand = [makeCard(Suit.CLUBS, Rank.ACE), makeCard(Suit.CLUBS, Rank.JACK)]; // كلوب=حكم؛ الولد أقوى من الآس بالحكم
  const cardsPlayed = [
    { playerID: "p2", card: makeCard(Suit.HEARTS, Rank.SEVEN) },
    { playerID: "p4", card: makeCard(Suit.CLUBS, Rank.NINE) }, // حكم مطروح (التسعة قوية) - p4 مش زميل p1
  ];
  checkThrows("معك حكم أعلى من المطروح - لازم ترميه", () =>
    validatePlay({ hand, card: hand[0], cardsPlayed, trumpSuit: Suit.CLUBS, partnerOfID: partnerOf, playerID: "p1" })
  );
  checkOk("رمي الولد (الأعلى) ينجح", () =>
    validatePlay({ hand, card: hand[1], cardsPlayed, trumpSuit: Suit.CLUBS, partnerOfID: partnerOf, playerID: "p1" })
  );
}

// ===== تحديد الفائز بالشوط: أعلى ورقة بلون القيادة تفوز لو ما فيه حكم =====
{
  const cardsPlayed = [
    { playerID: "p1", card: makeCard(Suit.HEARTS, Rank.KING) },
    { playerID: "p2", card: makeCard(Suit.HEARTS, Rank.ACE) }, // أعلى
    { playerID: "p3", card: makeCard(Suit.SPADES, Rank.ACE) }, // لون مختلف - تغسيل، ما ينافس
    { playerID: "p4", card: makeCard(Suit.HEARTS, Rank.TEN) },
  ];
  check("الآس بلون القيادة يفوز بالشوط", determineTrickWinner(cardsPlayed, null), "p2");
}

// ===== تحديد الفائز: أي حكم يغلب أعلى ورقة بلون القيادة =====
{
  const cardsPlayed = [
    { playerID: "p1", card: makeCard(Suit.HEARTS, Rank.ACE) },
    { playerID: "p2", card: makeCard(Suit.CLUBS, Rank.SEVEN) }, // حكم ضعيف، بس حكم
    { playerID: "p3", card: makeCard(Suit.HEARTS, Rank.KING) },
    { playerID: "p4", card: makeCard(Suit.SPADES, Rank.ACE) },
  ];
  check("أضعف حكم يغلب أقوى ورقة عادية", determineTrickWinner(cardsPlayed, Suit.CLUBS), "p2");
}

// ===== تحديد الفائز: أقوى حكم بين حكمين =====
{
  const cardsPlayed = [
    { playerID: "p1", card: makeCard(Suit.CLUBS, Rank.SEVEN) },
    { playerID: "p2", card: makeCard(Suit.CLUBS, Rank.JACK) }, // أقوى حكم
    { playerID: "p3", card: makeCard(Suit.CLUBS, Rank.NINE) },
    { playerID: "p4", card: makeCard(Suit.HEARTS, Rank.ACE) },
  ];
  check("الولد (أقوى حكم) يفوز", determineTrickWinner(cardsPlayed, Suit.CLUBS), "p2");
}

// ===== الترفيع عند الدق: مقطوع ومجبور يقطع، وخصمه سبق قطع بنفس الشوط - لازم يرفّع (يرمي أقوى حكم عنده) =====
{
  const hand = [makeCard(Suit.CLUBS, Rank.SEVEN), makeCard(Suit.CLUBS, Rank.JACK)];
  const cardsPlayed = [
    { playerID: "p1", card: makeCard(Suit.SPADES, Rank.ACE) },
    { playerID: "p2", card: makeCard(Suit.CLUBS, Rank.NINE) }, // خصم p3 قطع بالتسعة
  ];
  checkThrows("مقطوع ومجبور يقطع، وخصمه قطع قبله - لازم يرفّع بأقوى حكم عنده", () =>
    validatePlay({ hand, card: hand[0], cardsPlayed, trumpSuit: Suit.CLUBS, partnerOfID: partnerOf, playerID: "p3" })
  );
  checkOk("رمي الأقوى (الولد) بنفس الموقف ينجح", () =>
    validatePlay({ hand, card: hand[1], cardsPlayed, trumpSuit: Suit.CLUBS, partnerOfID: partnerOf, playerID: "p3" })
  );
}

// ===== لو ما عنده حكم أقوى من المطروح، يُسمح يقطع بالأضعف اللي عنده (بدون إجبار مستحيل) =====
{
  const hand = [makeCard(Suit.CLUBS, Rank.SEVEN)];
  const cardsPlayed = [
    { playerID: "p1", card: makeCard(Suit.SPADES, Rank.ACE) },
    { playerID: "p2", card: makeCard(Suit.CLUBS, Rank.NINE) },
  ];
  checkOk("ما عنده حكم أقوى من المطروح - يُسمح يقطع بأضعف حكم عنده", () =>
    validatePlay({ hand, card: hand[0], cardsPlayed, trumpSuit: Suit.CLUBS, partnerOfID: partnerOf, playerID: "p3" })
  );
}

console.log(`\n— النتيجة: ${pass} ناجح، ${fail} فاشل —`);
process.exit(fail > 0 ? 1 : 0);
