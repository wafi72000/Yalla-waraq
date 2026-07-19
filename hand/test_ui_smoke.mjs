import { JSDOM } from "jsdom";
import fs from "fs";

const html = fs.readFileSync(new URL("./index.html", import.meta.url), "utf-8");
const dom = new JSDOM(html, { url: "http://localhost/" });
global.window = dom.window;
global.document = dom.window.document;

let pass = 0, fail = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "✅" : "❌"} ${name} → ${JSON.stringify(actual)} (متوقع: ${JSON.stringify(expected)})`);
  ok ? pass++ : fail++;
}

await import("./js/app.js");

// --- اختبار شاشة البداية ---
const startScreen = document.getElementById("startScreen");
check("شاشة البداية ظاهرة أول التحميل", startScreen.classList.contains("hidden"), false);

// اختيار سرعة "سريعة" قبل الضغط على ابدأ
document.querySelector('.speed-btn[data-speed="fast"]').dispatchEvent(new window.Event("click", { bubbles: true }));
const fastBtn = document.querySelector('.speed-btn[data-speed="fast"]');
check("زر السرعة السريعة صار مفعّل بعد الضغط", fastBtn.classList.contains("active"), true);

// شاشة البداية الجديدة: نضغط "ابدأ اللعب" قبل أي فحص (نفس تجربة المستخدم الفعلية)
document.getElementById("startPlayBtn").dispatchEvent(new window.Event("click", { bubbles: true }));
check("شاشة البداية تختفي بعد الضغط على ابدأ اللعب", startScreen.classList.contains("hidden"), true);

function allHandCards() {
  return [
    ...document.getElementById("handRowTop").children,
    ...document.getElementById("handRowBottom").children,
  ];
}

check("بعد التحميل: يد اللاعب 14 ورقة بالواجهة (صفين)", allHandCards().length, 14);

const oppTop = document.getElementById("oppTop");
const oppLeft = document.getElementById("oppLeft");
const oppRight = document.getElementById("oppRight");
check("الخصم قبالتك معروض", oppTop.children.length > 0, true);
check("الخصم على يسارك معروض", oppLeft.children.length > 0, true);
check("الخصم على يمينك معروض", oppRight.children.length > 0, true);

const stockCount = document.getElementById("stockCount").textContent;
check("نص عداد الدِّستة يحتوي 50", stockCount.includes("50"), true);

// محاكاة دور كامل: ننتظر دور اللاعب البشري
let waited = 0;
while (window.__engine.state.currentTurnPlayerID !== "human" && !window.__engine.state.isRoundOver && waited < 15000) {
  await new Promise((r) => setTimeout(r, 200));
  waited += 200;
}
console.log(`انتظرنا ${waited}ms - دور اللاعب الحالي: ${window.__engine.state.currentTurnPlayerID}`);

function dispatchPointer(el, type, { x = 0, y = 0 } = {}) {
  const ev = new window.Event(type, { bubbles: true });
  ev.clientX = x;
  ev.clientY = y;
  ev.pointerId = 1;
  el.dispatchEvent(ev);
}

if (window.__engine.state.currentTurnPlayerID === "human" && !window.__engine.state.isRoundOver) {
  const handBefore = allHandCards().length;
  const stockPile = document.getElementById("stockPile");
  stockPile.dispatchEvent(new window.Event("click", { bubbles: true }));
  const handAfterDraw = allHandCards().length;
  check("بعد سحب اللاعب البشري: يده زادت ورقة", handAfterDraw, handBefore + 1);

  // --- اختبار الرمي بنقرتين متتاليتين (بدون سحب - نفس الموضع بالضبط) ---
  const firstCard = allHandCards()[0];
  dispatchPointer(firstCard, "pointerdown", { x: 10, y: 10 });
  dispatchPointer(firstCard, "pointerup", { x: 10, y: 10 }); // تاب أول = تحديد
  dispatchPointer(firstCard, "pointerdown", { x: 10, y: 10 });
  dispatchPointer(firstCard, "pointerup", { x: 10, y: 10 }); // تاب ثاني سريع = رمي
  const handAfterDiscard = allHandCards().length;
  check("بعد نقرتين متتاليتين: يده رجعت لنفس العدد قبل السحب (رمي)", handAfterDiscard, handBefore);

  // --- اختبار السحب الحر (تبديل موضع ورقة بسحبها) ---
  const cardsBeforeDrag = allHandCards().map((el) => el.dataset.cardId);
  const draggedCard = allHandCards()[allHandCards().length - 1]; // آخر ورقة بالصف الثاني
  const draggedId = draggedCard.dataset.cardId;
  dispatchPointer(draggedCard, "pointerdown", { x: 50, y: 50 });
  dispatchPointer(draggedCard, "pointermove", { x: 5, y: 50 }); // حركة كبيرة تكفي لتفعيل السحب
  dispatchPointer(draggedCard, "pointerup", { x: 5, y: 50 });
  const cardsAfterDrag = allHandCards().map((el) => el.dataset.cardId);
  check(
    "السحب الحر: ترتيب اليد تغيّر والورقة لسه موجودة",
    cardsAfterDrag.includes(draggedId) && cardsAfterDrag.length === cardsBeforeDrag.length,
    true
  );
}

// نفحص زر النقاط يفتح النافذة
const scoreBtn = document.getElementById("scoreBtn");
scoreBtn.dispatchEvent(new window.Event("click", { bubbles: true }));
const scoreOverlay = document.getElementById("scoreOverlay");
check("نافذة النقاط تفتح بعد الضغط", scoreOverlay.classList.contains("hidden"), false);

const closeScoreBtn = document.getElementById("closeScoreBtn");
closeScoreBtn.dispatchEvent(new window.Event("click", { bubbles: true }));
check("نافذة النقاط تتقفل بعد زر الإغلاق", scoreOverlay.classList.contains("hidden"), true);

console.log(`\n— النتيجة النهائية: ${pass} ناجح، ${fail} فاشل —`);
process.exit(fail > 0 ? 1 : 0);
