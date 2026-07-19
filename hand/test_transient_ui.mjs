// يثبّت سلوك الإخفاء/الإظهار الجديد: الأزرار تختفي بدور الخصم، وصندوق المجموع يختفي بدون تحديد
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

check("بدورك: شريط الأزرار ظاهر (visibility)", document.getElementById("actionBar").style.visibility, "visible");
check("بدون تحديد: صندوق المجموع بدون كلاس show", document.getElementById("totalPointsBar").classList.contains("show"), false);
check("بدون سحب: زر نزول مخفي (ما سحبت بعد)", document.getElementById("btnDeclare").style.display, "none");
check("بدون سحب: زر هند مخفي", document.getElementById("btnHand").style.display, "none");

// ندوّر الدور للخصم فعلياً (سحب + رمي) - شريط الأزرار يصير مخفي بصرياً بس يبقى محجوز مساحته (visibility لا display)
function allHandCards() {
  return [...document.getElementById("handRowTop").children, ...document.getElementById("handRowBottom").children];
}
function dispatchPointer(el, type, { x = 0, y = 0 } = {}) {
  const ev = new window.Event(type, { bubbles: true });
  ev.clientX = x; ev.clientY = y; ev.pointerId = 1;
  el.dispatchEvent(ev);
}
document.getElementById("stockPile").dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise((r) => setTimeout(r, 10));
const card = allHandCards()[0];
dispatchPointer(card, "pointerdown", { x: 10, y: 10 });
dispatchPointer(card, "pointerup", { x: 10, y: 10 });
dispatchPointer(card, "pointerdown", { x: 10, y: 10 });
dispatchPointer(card, "pointerup", { x: 10, y: 10 });
await new Promise((r) => setTimeout(r, 10));

check("بدور الخصم: شريط الأزرار غير ظاهر بصرياً (visibility hidden)، مش display none", document.getElementById("actionBar").style.visibility, "hidden");
check("بدور الخصم: شريط الأزرار لسه محجوز مساحته بالتخطيط (display مش none)", document.getElementById("actionBar").style.display !== "none", true);

console.log(`\n— النتيجة: ${pass} ناجح، ${fail} فاشل —`);
process.exit(fail > 0 ? 1 : 0);
