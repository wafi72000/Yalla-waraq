import { SunDoublingState } from "./js/doubling.js";

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

// ===== شرط الفتح: المشتري ≥100 والخصم <100 (عكس اتجاه دبل الحكم تماماً) =====
{
  const s1 = new SunDoublingState("A", "B", 100, 50);
  check("المشتري=100، الخصم=50 → يُعرض دبل الصن", s1.canOffer(), true);

  const s2 = new SunDoublingState("A", "B", 99, 50);
  check("المشتري=99 (أقل من 100) → ما يُعرض", s2.canOffer(), false);

  const s3 = new SunDoublingState("A", "B", 100, 100);
  check("الخصم=100 أيضاً (مو أقل من 100) → ما يُعرض", s3.canOffer(), false);
}

// ===== معامل ثابت ×2 فقط (بدون سلسلة) =====
{
  const s = new SunDoublingState("A", "B", 120, 40);
  check("المعامل قبل القرار = 1", s.multiplier, 1);
  s.decide("B", true); // الخصم يدبل
  check("المعامل بعد دبل الصن = 2 بالضبط", s.multiplier, 2);
}

// ===== الخصم يختار "لعب عادي" - المعامل يبقى 1 =====
{
  const s = new SunDoublingState("A", "B", 120, 40);
  s.decide("B", false);
  check("لعب عادي - المعامل يبقى 1", s.multiplier, 1);
}

// ===== قرار وحيد نهائي - ما يصير يتكرر =====
{
  const s = new SunDoublingState("A", "B", 120, 40);
  s.decide("B", true);
  checkThrows("محاولة قرار ثاني تُرفض - فرصة وحيدة لا تتكرر", () => s.decide("B", false));
}

// ===== القرار يخص الخصم بس، مو المشتري =====
{
  const s = new SunDoublingState("A", "B", 120, 40);
  checkThrows("المشتري يحاول يقرر بدل الخصم - يُرفض", () => s.decide("A", true));
}

// ===== محاولة قرار بدون تحقق الشرط أصلاً تُرفض =====
{
  const s = new SunDoublingState("A", "B", 50, 40); // المشتري تحت 100
  checkThrows("دبل الصن غير متاح أصلاً (الشرط غير محقق) - القرار يُرفض", () => s.decide("B", true));
}

console.log(`\n— النتيجة: ${pass} ناجح، ${fail} فاشل —`);
process.exit(fail > 0 ? 1 : 0);
