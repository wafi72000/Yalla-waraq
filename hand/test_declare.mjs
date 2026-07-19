import { HandEngine, DrawSource } from "./js/engine.js";
import "./js/declareEngine.js"; // يضيف الدوال على prototype
import { makeCard, makeJoker, Suit } from "./js/models.js";
import { MeldKind } from "./js/meld.js";

let pass = 0, fail = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "✅" : "❌"} ${name} → ${JSON.stringify(actual)} (متوقع: ${JSON.stringify(expected)})`);
  ok ? pass++ : fail++;
}
function checkThrows(name, fn) {
  let threw = false;
  try { fn(); } catch (e) { threw = true; }
  console.log(`${threw ? "✅" : "❌"} ${name} (يفترض يفشل)`);
  threw ? pass++ : fail++;
}

const players = [
  { id: "p1", name: "أنت", hand: [] },
  { id: "p2", name: "سالم", hand: [] },
  { id: "p3", name: "خالد", hand: [] },
  { id: "p4", name: "فهد", hand: [] },
];
const engine = new HandEngine(players);
const s = engine.state;

s.currentTurnIndex = 0; // دور p1
s.hasDrawnThisTurn = true; s.lastDrawSource = DrawSource.LEFT_DISCARD; // افترض سحب من النار (شرط النزول)

const p1 = s.player("p1");
const lowMeld = [makeCard(Suit.HEARTS, 13), makeCard(Suit.DIAMONDS, 13), makeCard(Suit.CLUBS, 13)];
p1.hand.push(...lowMeld);
checkThrows("نزول بأقل من 91 يفشل", () => engine.declareMelds("p1", [{ cards: lowMeld, kind: MeldKind.SET }]));
check("اليد لسه فيها الورق (لم يُحسم النزول الفاشل)", p1.hand.length, 3);

// نزول صحيح: تسلسل 10-J-Q-K حمرا (40) + مجموعة 3 سبعات (21) + مجموعة 3 أصوص (33) = 94
p1.hand = [];
const run3 = [makeCard(Suit.HEARTS, 10), makeCard(Suit.HEARTS, 11), makeCard(Suit.HEARTS, 12), makeCard(Suit.HEARTS, 13)];
const set1 = [makeCard(Suit.HEARTS, 7), makeCard(Suit.DIAMONDS, 7), makeCard(Suit.CLUBS, 7)];
const setAces = [makeCard(Suit.HEARTS, 14), makeCard(Suit.DIAMONDS, 14), makeCard(Suit.CLUBS, 14)];
p1.hand = [...run3, ...set1, ...setAces, makeCard(Suit.SPADES, 2)]; // +ورقة سايبة عشان تبقى ورقة بيده (قاعدة جديدة)
check("إجمالي 94 (أعلى من 91)", 40 + 21 + 33, 94);
engine.declareMelds("p1", [
  { cards: run3, kind: MeldKind.RUN }, { cards: set1, kind: MeldKind.SET }, { cards: setAces, kind: MeldKind.SET },
]);
check("p1 دخل السباق بـ94", s.declaration.declaredTotals.get("p1"), 94);
check("3 بيرات مكشوفة على الطاولة", s.exposedMelds.length, 3);
check("يد p1 صار فيها ورقة وحدة بس (الورقة السايبة - محجوزة للخالص)", p1.hand.length, 1);
check("التصعيد تجمّد بعد أول نزول", s.escalation.isFrozen, true);

// لاعب ثاني يحاول نزول بـ36 (أقل من عتبة 94) - يفشل
const p2 = s.player("p2");
s.currentTurnIndex = 1; s.hasDrawnThisTurn = true; s.lastDrawSource = DrawSource.LEFT_DISCARD;
const p2Set = [makeCard(Suit.HEARTS, 9), makeCard(Suit.DIAMONDS, 9), makeCard(Suit.CLUBS, 9), makeCard(Suit.SPADES, 9)];
p2.hand.push(...p2Set);
checkThrows("p2 نزول بـ36 يفشل (أقل من عتبة 94)", () => engine.declareMelds("p2", [{ cards: p2Set, kind: MeldKind.SET }]));

// تبديل جوكر بتسلسل مستقل
s.currentTurnIndex = 2; s.hasDrawnThisTurn = true; s.lastDrawSource = DrawSource.LEFT_DISCARD;
const p3 = s.player("p3");
const jokerRun = [
  makeCard(Suit.SPADES, 9), makeCard(Suit.SPADES, 10), makeJoker(),
  makeCard(Suit.SPADES, 12), makeCard(Suit.SPADES, 13), makeCard(Suit.SPADES, 14),
]; // 9 10 جوكر(=11) 12 13 14 = 9+10+10+10+10+10=59... نحتاج فوق 94
// نضيف مجموعة كمان لـp3 توصله فوق 94
const p3Set = [makeCard(Suit.DIAMONDS, 8), makeCard(Suit.CLUBS, 8), makeCard(Suit.HEARTS, 8)]; // 24
p3.hand.push(...jokerRun, ...p3Set, makeCard(Suit.HEARTS, 2)); // +ورقة سايبة عشان تبقى ورقة بيده وقت النزول النهائي
const jokerRunPoints = 9 + 10 + 10 + 10 + 10 + 10; // 59 (الجوكر بمكان الولد=11 يساوي 10)
check("نقاط jokerRun = 59", jokerRunPoints, 59);
check("إجمالي p3 = 59+24 = 83 (لسه أقل من 94)", jokerRunPoints + 24, 83);
checkThrows("p3 نزول بـ83 يفشل (أقل من 94)", () => engine.declareMelds("p3", [
  { cards: jokerRun, kind: MeldKind.RUN }, { cards: p3Set, kind: MeldKind.SET },
]));

// نزيد ورقة أخرى لـp3 (8♠ يمدد التسلسل من الأسفل: 8-9-10-جوكر-12-13-14 = 8+9+10+10+10+10+10=67)
const eightSpades = makeCard(Suit.SPADES, 8);
const jokerRunExtended = [eightSpades, ...jokerRun];
p3.hand.push(eightSpades);
const extendedPoints = 8 + 9 + 10 + 10 + 10 + 10 + 10;
check("نقاط jokerRunExtended = 67", extendedPoints, 67);
check("إجمالي p3 الجديد = 67+24=91 (يساوي العتبة الأساسية، لازم أعلى من 94!)", extendedPoints + 24, 91);
checkThrows("p3 نزول بـ91 يفشل (العتبة الحالية 94، لازم أعلى)", () => engine.declareMelds("p3", [
  { cards: jokerRunExtended, kind: MeldKind.RUN }, { cards: p3Set, kind: MeldKind.SET },
]));

// نزيد ورقة 7♠ بعد كذا لتوصل فوق 94: 7-8-9-10-جوكر-12-13-14 = 7+8+9+10+10+10+10+10=74 +24=98 (>94) ✅
const sevenSpades = makeCard(Suit.SPADES, 7);
p3.hand.push(sevenSpades);
const jokerRunFinal = [sevenSpades, ...jokerRunExtended];
const finalPoints = 7 + 8 + 9 + 10 + 10 + 10 + 10 + 10;
check("نقاط jokerRunFinal = 74", finalPoints, 74);
check("إجمالي نهائي p3 = 74+24=98 (>94) ✅", finalPoints + 24, 98);
engine.declareMelds("p3", [
  { cards: jokerRunFinal, kind: MeldKind.RUN }, { cards: p3Set, kind: MeldKind.SET },
]);
check("p3 دخل السباق بنجاح", s.declaration.isPlayerInRace("p3"), true);

// تبديل الجوكر: الجوكر بمكان index الأصلي (داخل jokerRunFinal) يمثل رتبة 11 (J)
const meldOnTable = s.exposedMelds.find((m) => m.declaredByPlayerID === "p3" && m.kind === MeldKind.RUN);
const jackSpades = makeCard(Suit.SPADES, 11);
p1.hand.push(jackSpades); // أي لاعب نازل غير صاحب البير يقدر يبدّل (p1 نازل بالسباق)
const extractedJoker = engine.swapJokerInRun("p1", meldOnTable.id, jackSpades);
check("الجوكر المستخرج هو جوكر فعلاً", extractedJoker.isJoker, true);
check("الجوكر صار بيد p1", p1.hand.some((c) => c.id === extractedJoker.id), true);
check("مكان الجوكر بالبير استُبدل بـJ♠", meldOnTable.cards.some((c) => c.suit === Suit.SPADES && c.rank === 11), true);

// --- اختبار انحدار: النزول بتسلسل تنازلي (K,Q,J) يجب يصير صحيح بنفس نقاط التصاعدي ---
{
  const players2 = [
    { id: "p1", name: "أنت", hand: [] },
    { id: "p2", name: "سالم", hand: [] },
    { id: "p3", name: "خالد", hand: [] },
    { id: "p4", name: "فهد", hand: [] },
  ];
  const engine2 = new HandEngine(players2);
  const s2 = engine2.state;
  s2.currentTurnIndex = 0;
  s2.hasDrawnThisTurn = true;
  s2.lastDrawSource = DrawSource.LEFT_DISCARD;
  const player2 = s2.player("p1");
  // تسلسل بستوني تنازلي: K,Q,J (30 نقطة) + مجموعة آصات (33) = 63 (أقل من العتبة، بس نتحقق من قبول البير نفسه فقط هنا)
  const descendingRun = [makeCard(Suit.SPADES, 13), makeCard(Suit.SPADES, 12), makeCard(Suit.SPADES, 11)];
  const acesSet = [makeCard(Suit.HEARTS, 14), makeCard(Suit.DIAMONDS, 14), makeCard(Suit.CLUBS, 14)];
  const sevenSet = [makeCard(Suit.HEARTS, 7), makeCard(Suit.DIAMONDS, 7), makeCard(Suit.CLUBS, 7)];
  player2.hand.push(...descendingRun, ...acesSet, ...sevenSet); // 30+33+21=84، نضيف بير زيادة لتعدّي 91
  const extraRun = [makeCard(Suit.HEARTS, 10), makeCard(Suit.HEARTS, 9), makeCard(Suit.HEARTS, 8)];
  player2.hand.push(...extraRun, makeCard(Suit.CLUBS, 2)); // +27 = 111 +ورقة سايبة
  engine2.declareMelds("p1", [
    { cards: descendingRun, kind: MeldKind.RUN },
    { cards: acesSet, kind: MeldKind.SET },
    { cards: sevenSet, kind: MeldKind.SET },
    { cards: extraRun, kind: MeldKind.RUN },
  ]);
  check("النزول بتسلسل تنازلي (K,Q,J) قُبل بنجاح", s2.declaration.isPlayerInRace("p1"), true);
  check("النزول بتسلسل تنازلي: الإجمالي صحيح (111)", s2.declaration.declaredTotals.get("p1"), 111);
}

console.log(`\n— النتيجة: ${pass} ناجح، ${fail} فاشل —`);
process.exit(fail > 0 ? 1 : 0);
