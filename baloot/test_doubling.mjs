import { DoublingState, DoubleLevel } from "./js/doubling.js";

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

// ===== الدبل ما يصير بالصن إطلاقاً =====
{
  const d = new DoublingState("teamA", "teamB", false, 50); // isHukm=false (صن)
  checkThrows("طلب دبل بنظام الصن يُرفض", () => d.requestNextLevel("teamB"));
}

// ===== شرط الـ100: المشتري لازم أقل من 100 =====
{
  const d = new DoublingState("teamA", "teamB", true, 100);
  checkThrows("رصيد المشتري 100+ يمنع فتح الدبل", () => d.requestNextLevel("teamB"));
}
{
  const d = new DoublingState("teamA", "teamB", true, 99);
  check("رصيد المشتري 99 يسمح بفتح الدبل", d.canOpenDouble(), true);
}

// ===== سلسلة كاملة: دبل(خصم) → ثري(مشتري) → فور(خصم) → خمسة(مشتري) =====
{
  const d = new DoublingState("teamA", "teamB", true, 50); // teamA=مشتري، teamB=خصم
  const l1 = d.requestNextLevel("teamB");
  check("دبل يطلبه الخصم، المستوى=1", l1, DoubleLevel.DOUBLE);
  check("المعامل بعد الدبل = 2", d.multiplier, 2);

  checkThrows("الخصم ما يقدر يطلب مرتين على التوالي", () => d.requestNextLevel("teamB"));

  const l2 = d.requestNextLevel("teamA");
  check("ثري يرد بيه المشتري، المستوى=2", l2, DoubleLevel.THREE);
  check("المعامل بعد الثري = 3", d.multiplier, 3);

  const l3 = d.requestNextLevel("teamB");
  check("فور يرد بيه الخصم، المستوى=3", l3, DoubleLevel.FOUR);
  check("المعامل بعد الفور = 4", d.multiplier, 4);

  check("لسه مو نهاية مباراة", d.isMatchEndingKahwa, false);
  const l4 = d.requestNextLevel("teamA");
  check("خمسة (قهوة) يرد بيها المشتري، المستوى=4", l4, DoubleLevel.KAHWA);
  check("قهوة تُفعّل علم نهاية المباراة الفورية", d.isMatchEndingKahwa, true);

  checkThrows("ما فيه تصعيد بعد قهوة", () => d.requestNextLevel("teamB"));
}

// ===== الفريق الخطأ يطلب المستوى - يُرفض =====
{
  const d = new DoublingState("teamA", "teamB", true, 50);
  checkThrows("المشتري ما يقدر يبدأ الدبل (الخصم هو اللي يبدأ)", () => d.requestNextLevel("teamA"));
}

console.log(`\n— النتيجة: ${pass} ناجح، ${fail} فاشل —`);
process.exit(fail > 0 ? 1 : 0);
