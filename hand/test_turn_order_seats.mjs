// يثبّت إصلاح فصل "المقعد الثابت" عن "ترتيب الدور": سالم يسار وفهد يمين دايماً، وفهد يلعب أول بعدك
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
document.querySelector('.speed-btn[data-speed="fast"]').dispatchEvent(new window.Event("click", { bubbles: true }));
document.getElementById("startPlayBtn").dispatchEvent(new window.Event("click", { bubbles: true }));

function seatText(seat) {
  const el = document.getElementById(`opp${seat}`);
  const nameEl = el.querySelector(".opponent-name");
  return nameEl?.textContent ?? null;
}

check("سالم بمقعده الثابت (يسار) من أول تحميل", seatText("Left"), "سالم");
check("خالد بمقعده الثابت (فوق) من أول تحميل", seatText("Top"), "خالد");
check("فهد بمقعده الثابت (يمين) من أول تحميل", seatText("Right"), "فهد");

// الموزّع عشوائي كل جولة - ننتظر فعلياً دور اللاعب البشري قبل أي فحص (نفس نمط test_ui_smoke)
let waited = 0;
while (window.__engine.state.currentTurnPlayerID !== "human" && waited < 15000) {
  await new Promise((r) => setTimeout(r, 50));
  waited += 50;
}
check("وصلنا لدور اللاعب البشري فعلياً قبل الفحص", window.__engine.state.currentTurnPlayerID, "human");

function allHandCards() {
  return [
    ...document.getElementById("handRowTop").children,
    ...document.getElementById("handRowBottom").children,
  ];
}
function dispatchPointer(el, type, { x = 0, y = 0 } = {}) {
  const ev = new window.Event(type, { bubbles: true });
  ev.clientX = x;
  ev.clientY = y;
  ev.pointerId = 1;
  el.dispatchEvent(ev);
}

document.getElementById("stockPile").dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise((r) => setTimeout(r, 10));
const card = allHandCards()[0];
dispatchPointer(card, "pointerdown", { x: 10, y: 10 });
dispatchPointer(card, "pointerup", { x: 10, y: 10 }); // تاب أول = تحديد
dispatchPointer(card, "pointerdown", { x: 10, y: 10 });
dispatchPointer(card, "pointerup", { x: 10, y: 10 }); // تاب ثاني سريع = رمي
await new Promise((r) => setTimeout(r, 10)); // فوراً بعد الرمي - تحديث currentTurnPlayerID متزامن، قبل أي مؤقّت AI

// أول خصم يلعب بعدك لازم يكون "ai3" (فهد) - حسب طلب المستخدم بعكس اتجاه الدور
check("أول خصم يلعب بعدك هو فهد (ai3) - عكسنا الاتجاه كما طُلب", window.__engine.state.currentTurnPlayerID, "ai3");

console.log(`\n— النتيجة: ${pass} ناجح، ${fail} فاشل —`);
process.exit(fail > 0 ? 1 : 0);
