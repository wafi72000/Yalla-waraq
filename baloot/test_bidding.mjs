import { BiddingState, BidChoice } from "./js/bidding.js";
import { Suit } from "./js/models.js";
import { HandRuleError } from "./js/deal.js";

let pass = 0, fail = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "✅" : "❌"} ${name} → ${JSON.stringify(actual)} (متوقع: ${JSON.stringify(expected)})`);
  ok ? pass++ : fail++;
}
function checkThrows(name, fn) {
  try { fn(); console.log(`❌ ${name} (يفترض يفشل)`); fail++; }
  catch (e) { console.log(`✅ ${name} (يفترض يفشل)`); pass++; }
}

const seatOrder = ["right", "partner", "left", "dealer"];

// ===== ترتيب الدور صحيح: يمين، شريك، يسار، الموزّع =====
{
  const b = new BiddingState(seatOrder, Suit.HEARTS);
  check("الدور يبدأ بيمين الموزّع", b.currentPlayerID, "right");
}

// ===== يمين وشريك الموزّع ما لهم خيار اشكل =====
{
  const b = new BiddingState(seatOrder, Suit.HEARTS);
  check("يمين الموزّع ما عنده خيار اشكل", b.availableChoices().includes(BidChoice.ASHKAL), false);
  b.submitBid("right", BidChoice.PASS);
  check("شريك الموزّع ما عنده خيار اشكل", b.availableChoices().includes(BidChoice.ASHKAL), false);
}

// ===== يسار الموزّع والموزّع نفسه عندهم خيار اشكل بالجولة الأولى =====
{
  const b = new BiddingState(seatOrder, Suit.HEARTS);
  b.submitBid("right", BidChoice.PASS);
  b.submitBid("partner", BidChoice.PASS);
  check("يسار الموزّع عنده خيار اشكل", b.availableChoices().includes(BidChoice.ASHKAL), true);
  b.submitBid("left", BidChoice.PASS);
  check("الموزّع نفسه عنده خيار اشكل", b.availableChoices().includes(BidChoice.ASHKAL), true);
}

// ===== مو دورك يرفض =====
{
  const b = new BiddingState(seatOrder, Suit.HEARTS);
  checkThrows("لاعب يحاول يزايد بغير دوره يُرفض", () => b.submitBid("partner", BidChoice.PASS));
}

// ===== حكم أول = نفس لون المفروشة تلقائياً =====
{
  const b = new BiddingState(seatOrder, Suit.HEARTS);
  const result = b.submitBid("right", BidChoice.HUKM);
  check("حكم أول = لون المفروشة (قلوب)", result.trumpSuit, Suit.HEARTS);
  check("buyerID صحيح", result.buyerID, "right");
}

// ===== صن: trumpSuit تبقى null =====
{
  const b = new BiddingState(seatOrder, Suit.HEARTS);
  const result = b.submitBid("right", BidChoice.SUN);
  check("الصن: trumpSuit = null", result.trumpSuit, null);
}

// ===== اشكل: نفس الصن + isAshkal=true =====
{
  const b = new BiddingState(seatOrder, Suit.HEARTS);
  b.submitBid("right", BidChoice.PASS);
  b.submitBid("partner", BidChoice.PASS);
  const result = b.submitBid("left", BidChoice.ASHKAL);
  check("الإشكال: trumpSuit = null (زي الصن)", result.trumpSuit, null);
  check("الإشكال: isAshkal = true", result.isAshkal, true);
}

// ===== حكم ثاني: لازم إعلان صريح، ولازم يكون غير لون المفروشة =====
{
  const b = new BiddingState(seatOrder, Suit.HEARTS);
  b.submitBid("right", BidChoice.PASS);
  b.submitBid("partner", BidChoice.PASS);
  b.submitBid("left", BidChoice.PASS);
  b.submitBid("dealer", BidChoice.PASS);
  check("انتقلنا للجولة الثانية", b.round, 2);
  check("الدور رجع ليمين الموزّع بالجولة الثانية", b.currentPlayerID, "right");

  checkThrows("حكم ثاني بدون إعلان لون يُرفض", () => b.submitBid("right", BidChoice.HUKM));
  checkThrows("حكم ثاني بنفس لون المفروشة يُرفض", () => b.submitBid("right", BidChoice.HUKM, Suit.HEARTS));
  const result = b.submitBid("right", BidChoice.HUKM, Suit.SPADES);
  check("حكم ثاني بلون مختلف ينجح", result.trumpSuit, Suit.SPADES);
}

// ===== الصكّة الميتة: كل الأربعة "بس" بالجولتين =====
{
  const b = new BiddingState(seatOrder, Suit.HEARTS);
  for (let round = 0; round < 2; round++) {
    for (const id of seatOrder) b.submitBid(id, BidChoice.PASS);
  }
  check("صكّة ميتة بعد مرور الجولتين بدون شراء", b.isDead, true);
  check("لا يوجد نتيجة شراء", b.result, null);
  checkThrows("المزايدة على صكّة ميتة تُرفض", () => b.submitBid("right", BidChoice.PASS));
}

// ===== اشكل ما يصير بالجولة الثانية (حصري للجولة الأولى) =====
{
  const b = new BiddingState(seatOrder, Suit.HEARTS);
  b.submitBid("right", BidChoice.PASS);
  b.submitBid("partner", BidChoice.PASS);
  b.submitBid("left", BidChoice.PASS);
  b.submitBid("dealer", BidChoice.PASS); // انتقلنا للجولة الثانية
  checkThrows("اشكل بالجولة الثانية يُرفض حتى ليسار الموزّع", () => b.submitBid("right", BidChoice.ASHKAL));
}

console.log(`\n— النتيجة: ${pass} ناجح، ${fail} فاشل —`);
process.exit(fail > 0 ? 1 : 0);
