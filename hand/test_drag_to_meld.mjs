// يثبّت إصلاح: السحب والإفلات لإضافة ورقة من يدك على بير مكشوف على الطاولة - كان غير مُطبّق إطلاقاً
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

// نجهّز يدوياً: بير مكشوف على الطاولة (مجموعة 7) + ورقة بيد اللاعب تكمّل المجموعة (7 من نوع رابع)
const { MeldKind } = await import("./js/meld.js");
const { ExposedMeld } = await import("./js/engine.js");
const { makeCard, makeJoker, Suit } = await import("./js/models.js");

const s = window.__engine.state;
const setMeld = [makeCard(Suit.SPADES, 7), makeCard(Suit.HEARTS, 7), makeCard(Suit.CLUBS, 7)];
const meld = new ExposedMeld(setMeld, MeldKind.SET, "ai1"); // بير سالم (مجموعة 7 - بستوني/قلوب/ورق)
s.exposedMelds.push(meld);
s.declaration.declaredTotals.set("ai1", 50);
s.declaration.declaredTotals.set("human", 0); // لازم يكون بالسباق عشان يقدر يضيف على بير أي لاعب (قاعدة جديدة)

const human = s.player("human");
const fittingCard = makeCard(Suit.DIAMONDS, 7); // 7 ديناري - يكمّل المجموعة (النوع الرابع المتبقي)
human.hand.push(fittingCard);
s.hasDrawnThisTurn = true; // نتأكد الدور جاهز للتفاعل

window.__render();
await new Promise((r) => setTimeout(r, 10));

const meldCardEl = document.querySelector(`[data-meld-id="${meld.id}"]`);
check("بير سالم انرسم على الطاولة (meldsLeft) ويحمل data-meld-id", !!meldCardEl, true);

const handCardEl = document.querySelector(`[data-card-id="${fittingCard.id}"]`);
check("الورقة المكمّلة (7♦) موجودة بيد اللاعب بالواجهة", !!handCardEl, true);

// نموّه document.elementFromPoint عشان jsdom ما يسوي layout/hit-test حقيقي - نرجّع عنصر البير مباشرة وقت الإفلات
const originalEFP = document.elementFromPoint;
document.elementFromPoint = () => meldCardEl;

function dispatchPointer(el, type, { x = 0, y = 0 } = {}) {
  const ev = new window.Event(type, { bubbles: true });
  ev.clientX = x; ev.clientY = y; ev.pointerId = 1;
  el.dispatchEvent(ev);
}

const handCountBefore = human.hand.length;
dispatchPointer(handCardEl, "pointerdown", { x: 10, y: 10 });
dispatchPointer(handCardEl, "pointermove", { x: 10, y: 200 }); // حركة كبيرة تكفي لتفعيل السحب (فوق منطقة الطاولة)
dispatchPointer(handCardEl, "pointerup", { x: 10, y: 200 });

document.elementFromPoint = originalEFP;

check("بعد السحب والإفلات فوق البير: الورقة انضافت للبير (4 ورق الآن)", meld.cards.length, 4);
check("الورقة المضافة هي 7♦ بالضبط", meld.cards.some((c) => c.id === fittingCard.id), true);
check("يد اللاعب قلّت ورقة وحدة (الورقة المضافة طلعت من يده)", human.hand.length, handCountBefore - 1);
check("الورقة المضافة ما عادت بيده", human.hand.some((c) => c.id === fittingCard.id), false);

// ===== الحالة المهمة: ورقة لا تطابق شروط البير - يفترض ترفض تماماً، اليد والبير ما يتغيّرون =====
const wrongCard = makeCard(Suit.SPADES, 9); // 9 بستوني - ما يطابق رتبة المجموعة (7) ولا نوعها مكرر بالفعل
human.hand.push(wrongCard);
window.__render();
await new Promise((r) => setTimeout(r, 10));

const meldCardElAfter = document.querySelector(`[data-meld-id="${meld.id}"]`);
const wrongCardEl = document.querySelector(`[data-card-id="${wrongCard.id}"]`);
document.elementFromPoint = () => meldCardElAfter;

const meldCountBefore = meld.cards.length;
const handCountBeforeWrong = human.hand.length;
dispatchPointer(wrongCardEl, "pointerdown", { x: 10, y: 10 });
dispatchPointer(wrongCardEl, "pointermove", { x: 10, y: 200 });
dispatchPointer(wrongCardEl, "pointerup", { x: 10, y: 200 });
document.elementFromPoint = originalEFP;

check("ورقة لا تطابق شروط البير (9♠) تُرفض - البير ما تغيّر", meld.cards.length, meldCountBefore);
check("ورقة لا تطابق شروط البير: اليد ما تغيّرت (الورقة رجعت/بقت بيده)", human.hand.length, handCountBeforeWrong);
check("الورقة المرفوضة لسه موجودة بيد اللاعب بالضبط", human.hand.some((c) => c.id === wrongCard.id), true);

// ===== تبديل الجوكر بالسحب: ورقة تطابق مكان الجوكر بالضبط (مش تمديد من طرف) يفترض تبدّل الجوكر، مش ترفض =====
{
  const swapRun = [makeCard(Suit.DIAMONDS, 9), makeCard(Suit.DIAMONDS, 10), makeJoker(), makeCard(Suit.DIAMONDS, 12), makeCard(Suit.DIAMONDS, 13)]; // 9,10,جوكر(=J),Q,K (تخزين تصاعدي)
  const swapMeld = new ExposedMeld(swapRun, MeldKind.RUN, "ai1");
  s.exposedMelds.push(swapMeld);
  s.declaration.declaredTotals.set("human", 0); // عشان يقدر يبدّل لازم يكون بالسباق
  const replacementJ = makeCard(Suit.DIAMONDS, 11); // J ديناري - تطابق مكان الجوكر بالضبط
  human.hand.push(replacementJ);
  window.__render();
  await new Promise((r) => setTimeout(r, 10));

  document.elementFromPoint = () => document.querySelector(`[data-meld-id="${swapMeld.id}"]`);
  const replEl = document.querySelector(`[data-card-id="${replacementJ.id}"]`);
  dispatchPointer(replEl, "pointerdown", { x: 10, y: 10 });
  dispatchPointer(replEl, "pointermove", { x: 10, y: 200 });
  dispatchPointer(replEl, "pointerup", { x: 10, y: 200 });
  document.elementFromPoint = originalEFP;

  check("تبديل الجوكر بالسحب نجح - J ديناري دخلت مكان الجوكر بالضبط", swapMeld.cards.some((c) => !c.isJoker && c.rank === 11 && c.suit === "diamonds"), true);
  check("الجوكر المستبدل رجع ليد اللاعب", human.hand.some((c) => c.isJoker), true);
}

console.log(`\n— النتيجة: ${pass} ناجح، ${fail} فاشل —`);
process.exit(fail > 0 ? 1 : 0);
