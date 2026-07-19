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

// ===== القاعدة الجديدة: حكم بالجولة الأولى لا يقفل المزايدة فوراً - يصير معلّق =====
{
  const b = new BiddingState(seatOrder, Suit.HEARTS);
  const r = b.submitBid("right", BidChoice.HUKM);
  check("حكم بالجولة الأولى لا يرجّع نتيجة نهائية فوراً (null)", r, null);
  check("لا يوجد result نهائي بعد", b.result, null);
  check("فيه حكم معلّق مسجّل بشكل صحيح", b.pendingHukm, { buyerID: "right", trumpSuit: Suit.HEARTS });
  check("الدور انتقل للاعب التالي (شريك الموزّع)", b.currentPlayerID, "partner");
}

// ===== لو الكل مرّر بعد حكم معلّق، الحكم المعلّق يصير المشتري النهائي =====
{
  const b = new BiddingState(seatOrder, Suit.HEARTS);
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
  const b = new BiddingState(seatOrder, Suit.HEARTS);
  b.submitBid("right", BidChoice.HUKM); // right يشتري حكم أول - يصير معلّق
  const r = b.submitBid("partner", BidChoice.SUN); // partner يرفعها لصن
  check("الصن يقفل المزايدة فوراً حتى بوجود حكم معلّق", r.buyerID, "partner");
  check("نوع الشراء تحوّل لصن", r.choice, BidChoice.SUN);
  check("لا يوجد لون حكم (صن)", r.trumpSuit, null);
  check("الحكم المعلّق أُلغي (pendingHukm صفر)", b.pendingHukm, null);
}

// ===== حكم ثاني (لاعب لاحق) يستبدل الحكم المعلّق الأول =====
{
  const b = new BiddingState(seatOrder, Suit.HEARTS);
  b.submitBid("right", BidChoice.HUKM); // right معلّق
  b.submitBid("partner", BidChoice.HUKM); // partner يشتري حكم كمان - يستبدل المعلّق
  check("الحكم المعلّق تحدّث لآخر لاعب اشترى", b.pendingHukm.buyerID, "partner");
  b.submitBid("left", BidChoice.PASS);
  const r = b.submitBid("dealer", BidChoice.PASS);
  check("انتهت الجولة والمشتري النهائي هو آخر حكم معلّق (partner)", r.buyerID, "partner");
}

// ===== اشكل (من آخر لاعبين) يلغي حكم معلّق ويقفل فوراً =====
{
  const b = new BiddingState(seatOrder, Suit.HEARTS);
  b.submitBid("right", BidChoice.HUKM); // معلّق
  b.submitBid("partner", BidChoice.PASS);
  const r = b.submitBid("left", BidChoice.ASHKAL); // يسار الموزّع يرفعها بإشكال
  check("الإشكال يقفل المزايدة فوراً ويلغي الحكم المعلّق", r.buyerID, "left");
  check("isAshkal = true", r.isAshkal, true);
  check("trumpSuit = null (زي الصن)", r.trumpSuit, null);
}

// ===== حكم ثاني: لازم إعلان صريح، ولازم يكون غير لون المفروشة (سلوك الجولة الثانية بدون تغيير) =====
{
  const b = new BiddingState(seatOrder, Suit.HEARTS);
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
  const b = new BiddingState(seatOrder, Suit.HEARTS);
  for (const id of seatOrder) b.submitBid(id, BidChoice.PASS); // جولة أولى - صفر حكم معلّق
  for (const id of seatOrder) b.submitBid(id, BidChoice.PASS); // جولة ثانية
  check("صكّة ميتة بعد مرور الجولتين بدون شراء", b.isDead, true);
  check("لا يوجد نتيجة شراء", b.result, null);
  checkThrows("المزايدة على صكّة ميتة تُرفض", () => b.submitBid("right", BidChoice.PASS));
}

// ===== اشكل ما يصير بالجولة الثانية (حصري للجولة الأولى) =====
{
  const b = new BiddingState(seatOrder, Suit.HEARTS);
  for (const id of seatOrder) b.submitBid(id, BidChoice.PASS); // جولة أولى بدون شراء
  checkThrows("اشكل بالجولة الثانية يُرفض حتى ليسار الموزّع", () => b.submitBid("right", BidChoice.ASHKAL));
}

console.log(`\n— النتيجة: ${pass} ناجح، ${fail} فاشل —`);
process.exit(fail > 0 ? 1 : 0);
