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
// تمثيل فرق منطقي للاختبار (مقاعد متقابلة فعلياً بترتيب الجلوس الحقيقي): right+left فريق A، partner+dealer فريق B
// ملاحظة: بترتيب المزايدة [يمين، شريك، يسار، الموزع]، الفرق الفعلية بالجلوس تتقابل (0+2) و(1+3)
const testTeamOfPlayer = (id) => (id === "right" || id === "left") ? "A" : "B";

// ===== ترتيب الدور صحيح: يمين، شريك، يسار، الموزّع =====
{
  const b = new BiddingState(seatOrder, Suit.HEARTS, testTeamOfPlayer);
  check("الدور يبدأ بيمين الموزّع", b.currentPlayerID, "right");
}

// ===== يمين وشريك الموزّع ما لهم خيار اشكل =====
{
  const b = new BiddingState(seatOrder, Suit.HEARTS, testTeamOfPlayer);
  check("يمين الموزّع ما عنده خيار اشكل", b.availableChoices().includes(BidChoice.ASHKAL), false);
  b.submitBid("right", BidChoice.PASS);
  check("شريك الموزّع ما عنده خيار اشكل", b.availableChoices().includes(BidChoice.ASHKAL), false);
}

// ===== يسار الموزّع والموزّع نفسه عندهم خيار اشكل بالجولة الأولى =====
{
  const b = new BiddingState(seatOrder, Suit.HEARTS, testTeamOfPlayer);
  b.submitBid("right", BidChoice.PASS);
  b.submitBid("partner", BidChoice.PASS);
  check("يسار الموزّع عنده خيار اشكل", b.availableChoices().includes(BidChoice.ASHKAL), true);
  b.submitBid("left", BidChoice.PASS);
  check("الموزّع نفسه عنده خيار اشكل", b.availableChoices().includes(BidChoice.ASHKAL), true);
}

// ===== مو دورك يرفض =====
{
  const b = new BiddingState(seatOrder, Suit.HEARTS, testTeamOfPlayer);
  checkThrows("لاعب يحاول يزايد بغير دوره يُرفض", () => b.submitBid("partner", BidChoice.PASS));
}

// ===== القاعدة الجديدة: حكم بالجولة الأولى لا يقفل المزايدة فوراً - يصير معلّق =====
{
  const b = new BiddingState(seatOrder, Suit.HEARTS, testTeamOfPlayer);
  const r = b.submitBid("right", BidChoice.HUKM);
  check("حكم بالجولة الأولى لا يرجّع نتيجة نهائية فوراً (null)", r, null);
  check("لا يوجد result نهائي بعد", b.result, null);
  check("فيه حكم معلّق مسجّل بشكل صحيح", b.pendingHukm, { buyerID: "right", trumpSuit: Suit.HEARTS });
  check("الدور انتقل للاعب التالي (شريك الموزّع)", b.currentPlayerID, "partner");
}

// ===== لو الكل مرّر بعد حكم معلّق، الحكم المعلّق يصير المشتري النهائي =====
{
  const b = new BiddingState(seatOrder, Suit.HEARTS, testTeamOfPlayer);
  b.submitBid("right", BidChoice.HUKM); // معلّق
  b.submitBid("partner", BidChoice.PASS);
  b.submitBid("left", BidChoice.PASS);
  const r = b.submitBid("dealer", BidChoice.PASS); // آخر لاعب بالجولة - يفترض يُنهي المزايدة بالحكم المعلّق
  check("انتهت الجولة الأولى والحكم المعلّق أصبح النتيجة النهائية", r.buyerID, "right");
  check("نوع الشراء = حكم", r.choice, BidChoice.HUKM);
  check("لون الحكم = لون المفروشة", r.trumpSuit, Suit.HEARTS);
  check("ما انتقلنا لجولة ثانية", b.round, 1);
}

// ===== الصن يلغي الحكم المعلّق ويقفل فوراً (السيناريو 4) =====
{
  const b = new BiddingState(seatOrder, Suit.HEARTS, testTeamOfPlayer);
  b.submitBid("right", BidChoice.HUKM); // right يشتري حكم أول - يصير معلّق
  const r = b.submitBid("partner", BidChoice.SUN); // partner يرفعها لصن
  check("الصن يقفل المزايدة فوراً حتى بوجود حكم معلّق", r.buyerID, "partner");
  check("نوع الشراء تحوّل لصن", r.choice, BidChoice.SUN);
  check("لا يوجد لون حكم (صن)", r.trumpSuit, null);
  check("الحكم المعلّق أُلغي (pendingHukm صفر)", b.pendingHukm, null);
}

// ===== حكم ثاني (لاعب لاحق) يستبدل الحكم المعلّق الأول =====
{
  const b = new BiddingState(seatOrder, Suit.HEARTS, testTeamOfPlayer);
  b.submitBid("right", BidChoice.HUKM); // right معلّق
  b.submitBid("partner", BidChoice.HUKM); // partner يشتري حكم كمان - يستبدل المعلّق
  check("الحكم المعلّق تحدّث لآخر لاعب اشترى", b.pendingHukm.buyerID, "partner");
  b.submitBid("left", BidChoice.PASS);
  const r = b.submitBid("dealer", BidChoice.PASS);
  check("انتهت الجولة والمشتري النهائي هو آخر حكم معلّق (partner)", r.buyerID, "partner");
}

// ===== اشكل (من خصم صاحب الحكم المعلّق) يلغيه ويقفل فوراً =====
{
  const b = new BiddingState(seatOrder, Suit.HEARTS, testTeamOfPlayer);
  b.submitBid("right", BidChoice.HUKM); // معلّق - right فريق A
  b.submitBid("partner", BidChoice.PASS);
  b.submitBid("left", BidChoice.PASS); // left زميل right (نفس فريق A) - ما عنده إشكال أصلاً هنا (خيارات زميل فقط)
  const r = b.submitBid("dealer", BidChoice.ASHKAL); // dealer خصم (فريق B) ومؤهّل للإشكال - يرفعها
  check("الإشكال (من خصم) يقفل المزايدة فوراً ويلغي الحكم المعلّق", r.buyerID, "dealer");
  check("isAshkal = true", r.isAshkal, true);
  check("trumpSuit = null (زي الصن)", r.trumpSuit, null);
}

// ===== حكم ثاني: لازم إعلان صريح، ولازم يكون غير لون المفروشة (سلوك الجولة الثانية بدون تغيير) =====
{
  const b = new BiddingState(seatOrder, Suit.HEARTS, testTeamOfPlayer);
  b.submitBid("right", BidChoice.PASS);
  b.submitBid("partner", BidChoice.PASS);
  b.submitBid("left", BidChoice.PASS);
  b.submitBid("dealer", BidChoice.PASS);
  check("انتقلنا للجولة الثانية (كل الأربعة مرّروا)", b.round, 2);
  check("الدور رجع ليمين الموزّع بالجولة الثانية", b.currentPlayerID, "right");

  checkThrows("حكم ثاني بدون إعلان لون يُرفض", () => b.submitBid("right", BidChoice.HUKM));
  checkThrows("حكم ثاني بنفس لون المفروشة يُرفض", () => b.submitBid("right", BidChoice.HUKM, Suit.HEARTS));
  const result = b.submitBid("right", BidChoice.HUKM, Suit.SPADES);
  check("حكم ثاني بلون مختلف يقفل فوراً (سلوك الجولة الثانية لم يتغيّر)", result.trumpSuit, Suit.SPADES);
}

// ===== الصكّة الميتة: كل الأربعة "بس"/"ولا" بالجولتين =====
{
  const b = new BiddingState(seatOrder, Suit.HEARTS, testTeamOfPlayer);
  for (const id of seatOrder) b.submitBid(id, BidChoice.PASS); // جولة أولى - صفر حكم معلّق
  for (const id of seatOrder) b.submitBid(id, BidChoice.PASS); // جولة ثانية
  check("صكّة ميتة بعد مرور الجولتين بدون شراء", b.isDead, true);
  check("لا يوجد نتيجة شراء", b.result, null);
  checkThrows("المزايدة على صكّة ميتة تُرفض", () => b.submitBid("right", BidChoice.PASS));
}

// ===== اشكل ما يصير بالجولة الثانية (حصري للجولة الأولى) =====
{
  const b = new BiddingState(seatOrder, Suit.HEARTS, testTeamOfPlayer);
  for (const id of seatOrder) b.submitBid(id, BidChoice.PASS); // جولة أولى بدون شراء
  checkThrows("اشكل بالجولة الثانية يُرفض حتى ليسار الموزّع", () => b.submitBid("right", BidChoice.ASHKAL));
}

// ===== تصفية الأزرار: زميل صاحب الحكم المعلّق يشوف بس [صن، بس] - بدون حكم ولا اشكل =====
{
  const b = new BiddingState(seatOrder, Suit.HEARTS, testTeamOfPlayer);
  b.submitBid("right", BidChoice.HUKM); // right (فريق A) معلّق
  const partnerChoices = b.availableChoices(); // partner فريق B... انتظر partner دوره الآن
  // partner هو الدور الحالي، لكنه فريق B (خصم right) - نتحقق من اختياراته أولاً
  check("partner (خصم right) يشوف صن+حكم+بس", partnerChoices.sort(), [BidChoice.SUN, BidChoice.HUKM, BidChoice.PASS].sort());
  b.submitBid("partner", BidChoice.PASS);
  // الآن دور left - وهو زميل right (فريق A) لأن الفرق تتقابل
  const leftChoices = b.availableChoices();
  check("left (زميل right - نفس فريق A) يشوف صن+بس بس - بدون حكم ولا اشكل رغم موقعه المؤهّل أصلاً", leftChoices.sort(), [BidChoice.SUN, BidChoice.PASS].sort());
}

console.log(`\n— النتيجة: ${pass} ناجح، ${fail} فاشل —`);
process.exit(fail > 0 ? 1 : 0);
