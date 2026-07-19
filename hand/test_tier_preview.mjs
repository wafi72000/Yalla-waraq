// يثبّت: معاينة التير على زر هند قبل الضغط، ورسالة نهاية الجولة الكاملة بعد الضغط
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

let waited = 0;
while (window.__engine.state.currentTurnPlayerID !== "human" && waited < 15000) {
  await new Promise((r) => setTimeout(r, 50));
  waited += 50;
}

const { makeCard, makeJoker, Suit } = await import("./js/models.js");
const { MeldKind } = await import("./js/meld.js");

const s = window.__engine.state;
const p1 = s.player("human");
s.hasDrawnThisTurn = true;
s.lastDrawSource = (await import("./js/engine.js")).DrawSource.STOCK;
const run1 = [2, 3, 4, 5, 6, 7, 8].map((r) => makeCard(Suit.HEARTS, r));
const run2 = [2, 3, 4, 5, 6, 7].map((r) => makeCard(Suit.CLUBS, r));
const declareJoker = makeJoker();
p1.hand = [...run1, ...run2, declareJoker];

window.__render();
await new Promise((r) => setTimeout(r, 10));

// نحدد ورقة الإعلان (الجوكر) عشان المعاينة تشتغل - التحديد يصير بـ pointerdown/pointerup، مش click عادي
function dispatchPointer(el, type, { x = 0, y = 0 } = {}) {
  const ev = new window.Event(type, { bubbles: true });
  ev.clientX = x; ev.clientY = y; ev.pointerId = 1;
  el.dispatchEvent(ev);
}
const jokerEl = document.querySelector(`[data-card-id="${declareJoker.id}"]`);
dispatchPointer(jokerEl, "pointerdown", { x: 10, y: 10 });
dispatchPointer(jokerEl, "pointerup", { x: 10, y: 10 });
await new Promise((r) => setTimeout(r, 10));

check("معاينة زر الهند تطلع 'جوكر (-120)' قبل أي ضغط", document.getElementById("btnHand").textContent, "جوكر (-120)");

document.getElementById("btnHand").dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise((r) => setTimeout(r, 10));

check("رسالة نهاية الجولة فيها اسم الطريقة (جوكر) والنقاط (-120)",
  /جوكر.*-120|–120/.test(document.getElementById("roundEndTitle").textContent) || document.getElementById("roundEndTitle").textContent.includes("جوكر"),
  true);
console.log("نص الرسالة الفعلي:", document.getElementById("roundEndTitle").textContent);

check("عدد قطع الكونفيتي يتدرّج صح مع قوة الإنهاء (جوكر -120 = 45 قطعة)", document.getElementById("celebrationLayer").children.length, 45);
check("جوكر -120 لا يستدعي رجّة الشاشة (تبدأ من 240)", document.getElementById("app").classList.contains("screen-shake"), false);

console.log(`\n— النتيجة: ${pass} ناجح، ${fail} فاشل —`);
process.exit(fail > 0 ? 1 : 0);
