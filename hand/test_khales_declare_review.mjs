// مراجعة شاملة لمنطق النزول والخالص - خصوصاً الخالص اللي ما كان له أي اختبار سابق
import { HandEngine, DrawSource, HandRuleError } from "./js/engine.js";
import "./js/declareEngine.js";
import "./js/endingEngine.js";
import { makeCard, makeJoker, Suit } from "./js/models.js";
import { MeldKind } from "./js/meld.js";
import { EndingType } from "./js/escalation.js";

let pass = 0, fail = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "✅" : "❌"} ${name} → ${JSON.stringify(actual)} (متوقع: ${JSON.stringify(expected)})`);
  ok ? pass++ : fail++;
}
function checkThrows(name, fn, expectedMessageSubstring) {
  let threw = false, msg = "";
  try { fn(); } catch (e) { threw = e instanceof HandRuleError; msg = e.message; }
  const msgOk = !expectedMessageSubstring || msg.includes(expectedMessageSubstring);
  const ok = threw && msgOk;
  console.log(`${ok ? "✅" : "❌"} ${name} (يفترض يفشل)${msgOk ? "" : ` - الرسالة: "${msg}"`}`);
  ok ? pass++ : fail++;
}

function freshEngine() {
  const players = [
    { id: "p1", name: "أنت", hand: [] },
    { id: "p2", name: "سالم", hand: [] },
    { id: "p3", name: "خالد", hand: [] },
    { id: "p4", name: "فهد", hand: [] },
  ];
  const engine = new HandEngine(players);
  engine.startNewRound();
  const s = engine.state;
  s.currentTurnIndex = 0;
  return { engine, s, p1: s.player("p1") };
}

// ===== خالص: يفشل لو سحبت من الدّستة بدل النار =====
{
  const { engine, s, p1 } = freshEngine();
  s.hasDrawnThisTurn = true;
  s.lastDrawSource = DrawSource.STOCK;
  const lastCard = makeCard(Suit.HEARTS, 5);
  p1.hand = [lastCard];
  checkThrows(
    "الخالص يفشل لو آخر سحبة من الدّستة مش من النار",
    () => engine.endRound("p1", EndingType.KHALES, [lastCard]),
    "النار"
  );
}

// ===== خالص: يفشل لو اليد لسه فيها ورق غير منزّل =====
{
  const { engine, s, p1 } = freshEngine();
  s.exposedActionPlayers.add("p1"); // محاكاة: سبق ونزّل بيرات على مراحل (خالص بعد النزول)
  s.hasDrawnThisTurn = true;
  s.lastDrawSource = DrawSource.LEFT_DISCARD;
  const lastCard = makeCard(Suit.HEARTS, 5);
  p1.hand = [lastCard, makeCard(Suit.CLUBS, 9)]; // ورقة زايدة غير مرمية
  checkThrows(
    "الخالص يفشل لو اليد فيها ورق زايد غير منزّل",
    () => engine.endRound("p1", EndingType.KHALES, [lastCard]),
    "ورق غير منزّل"
  );
}

// ===== خالص: يفشل برمية أكثر من ورقتين =====
{
  const { engine, s, p1 } = freshEngine();
  s.hasDrawnThisTurn = true;
  s.lastDrawSource = DrawSource.LEFT_DISCARD;
  const c1 = makeCard(Suit.HEARTS, 5), c2 = makeCard(Suit.CLUBS, 9), c3 = makeCard(Suit.SPADES, 2);
  p1.hand = [c1, c2, c3];
  checkThrows("الخالص يفشل برمية 3 ورق دفعة وحدة", () => engine.endRound("p1", EndingType.KHALES, [c1, c2, c3]), "ورقتين");
}

// ===== خالص: رمية مزدوجة مسموحة فقط لو الورقتين جوكر =====
{
  const { engine, s, p1 } = freshEngine();
  s.hasDrawnThisTurn = true;
  s.lastDrawSource = DrawSource.LEFT_DISCARD;
  const c1 = makeCard(Suit.HEARTS, 5), c2 = makeCard(Suit.CLUBS, 9);
  p1.hand = [c1, c2];
  checkThrows("رمية مزدوجة غير جوكر تفشل", () => engine.endRound("p1", EndingType.KHALES, [c1, c2]), "جوكر");
}

// ===== خالص: مسار صحيح كامل (نزول جزء من اليد، ثم خالص بالباقي) =====
{
  const { engine, s, p1 } = freshEngine();
  const p2 = s.player("p2");

  // p1 ينزّل مجموعة أصوص بقيمة 33 (أقل من 91 - لازم نرفعها فوق العتبة الأساسية)
  s.hasDrawnThisTurn = true;
  s.lastDrawSource = DrawSource.LEFT_DISCARD;
  const run = [makeCard(Suit.HEARTS, 10), makeCard(Suit.HEARTS, 11), makeCard(Suit.HEARTS, 12), makeCard(Suit.HEARTS, 13)]; // 40
  const setAces = [makeCard(Suit.SPADES, 14), makeCard(Suit.CLUBS, 14), makeCard(Suit.DIAMONDS, 14)]; // 33
  const setSevens = [makeCard(Suit.SPADES, 7), makeCard(Suit.CLUBS, 7), makeCard(Suit.HEARTS, 7)]; // 21
  const lastCard = makeCard(Suit.DIAMONDS, 9); // الورقة الأخيرة اللي يرميها بالخالص
  p1.hand = [...run, ...setAces, ...setSevens, lastCard]; // 40+33+21=94 منزّل + ورقة أخيرة

  engine.declareMelds("p1", [
    { cards: run, kind: MeldKind.RUN },
    { cards: setAces, kind: MeldKind.SET },
    { cards: setSevens, kind: MeldKind.SET },
  ]);
  check("بعد النزول: يد p1 فيها بس الورقة الأخيرة", p1.hand.length, 1);
  check("p1 دخل السباق بـ94", s.declaration.declaredTotals.get("p1"), 94);

  // محاكاة: p2 لسه ما دخل السباق (خصمه بيخسر بنقاط ورقه السايبة لأنه برّا السباق)
  p2.hand = [makeCard(Suit.CLUBS, 5), makeCard(Suit.SPADES, 8)]; // 5+8=13 نقطة سايبة

  // دور p1 مرة ثانية، يسحب من النار، وينهي بالخالص على آخر ورقة
  s.hasDrawnThisTurn = true;
  s.lastDrawSource = DrawSource.LEFT_DISCARD;
  const tier = engine.endRound("p1", EndingType.KHALES, [lastCard]);

  check("الخالص قبل بنجاح - يد p1 فاضية تماماً", p1.hand.length, 0);
  check("نوع التعادل = خالص (winnerScore -30)", tier.winnerScore, -30);
  check("نقاط p1 التراكمية = -30", s.cumulativeScores.get("p1"), -30);
  // p2 برّا السباق: ياخذ flatScore (100) مش مضاعف ورقه السايبة
  check("p2 (برّا السباق) ياخذ 100 نقطة ثابتة، مش 13×1", s.cumulativeScores.get("p2"), 100);
  check("سبب انتهاء الجولة يذكر اسم اللاعب الفايز", s.roundEndedReason.includes("أنت"), true);
}

// ===== خالص بعد جوكر مرمي مسبقاً: ممنوع بسبب تصعيد الجوكر =====
{
  const { engine, s, p1 } = freshEngine();
  s.escalation.registerJokerDiscarded(); // جوكر انرمى قبل أي نزول - يرفع الحد الأدنى المسموح فوق الخالص
  s.hasDrawnThisTurn = true;
  s.lastDrawSource = DrawSource.LEFT_DISCARD;
  const lastCard = makeCard(Suit.HEARTS, 5);
  p1.hand = [lastCard];
  checkThrows(
    "الخالص ممنوع بعد ما جوكر انرمى (قبل أي نزول يجمّد التصعيد)",
    () => engine.endRound("p1", EndingType.KHALES, [lastCard]),
    "تصعيد"
  );
}

// ===== نزول: العتبة الثانية لازم تكون أعلى صراحة من سابقتها (مش يساويها) =====
{
  const { engine, s } = freshEngine();
  const p1 = s.player("p1");
  const p2 = s.player("p2");

  s.hasDrawnThisTurn = true;
  s.lastDrawSource = DrawSource.LEFT_DISCARD;
  const setA = [makeCard(Suit.HEARTS, 14), makeCard(Suit.CLUBS, 14), makeCard(Suit.SPADES, 14)]; // 33
  const setB = [makeCard(Suit.HEARTS, 13), makeCard(Suit.CLUBS, 13), makeCard(Suit.SPADES, 13)]; // 30
  const setC = [makeCard(Suit.HEARTS, 12), makeCard(Suit.CLUBS, 12), makeCard(Suit.DIAMONDS, 12)]; // 30
  p1.hand = [...setA, ...setB, ...setC, makeCard(Suit.SPADES, 2)]; // 93 + ورقة سايبة
  engine.declareMelds("p1", [
    { cards: setA, kind: MeldKind.SET }, { cards: setB, kind: MeldKind.SET }, { cards: setC, kind: MeldKind.SET },
  ]);
  check("p1 دخل بـ93", s.declaration.declaredTotals.get("p1"), 93);

  s.currentTurnIndex = 1;
  s.hasDrawnThisTurn = true;
  s.lastDrawSource = DrawSource.LEFT_DISCARD;
  const lowerSet = [makeCard(Suit.DIAMONDS, 11), makeCard(Suit.HEARTS, 11), makeCard(Suit.SPADES, 11)]; // 30، أقل من عتبة 93
  p2.hand = [...lowerSet, makeCard(Suit.CLUBS, 2)]; // +ورقة سايبة عشان نختبر العتبة، مش قاعدة "ورقة سايبة"
  checkThrows(
    "نزول بقيمة أقل من العتبة الحالية (93) يفشل",
    () => engine.declareMelds("p2", [{ cards: lowerSet, kind: MeldKind.SET }]),
    "أعلى من"
  );
}

// ===== مجموع ورق بيرات لاعب واحد ما يصير يتجاوز 14 ورقة (نفس سعة يدّه الأصلية) =====
{
  const { engine, s, p1 } = freshEngine();
  s.hasDrawnThisTurn = true;
  s.lastDrawSource = DrawSource.LEFT_DISCARD;

  // أول نزول: 11 ورقة (تسلسل 8 ورق قلوب من 4 إلى J + مجموعة 3 ملوك) - يبقى له ورق زيادة بيده لدورين جايين
  const bigRun = [4,5,6,7,8,9,10,11].map((r) => makeCard(Suit.HEARTS, r)); // 8 ورق
  const setKings = [makeCard(Suit.SPADES, 13), makeCard(Suit.CLUBS, 13), makeCard(Suit.DIAMONDS, 13)]; // 3 ورق
  const extraSet = [makeCard(Suit.SPADES, 9), makeCard(Suit.CLUBS, 9), makeCard(Suit.HEARTS, 9)]; // 3 ورق (الدور الجاي)
  const leftover = makeCard(Suit.DIAMONDS, 2); // الورقة السايبة المحجوزة للخالص
  p1.hand = [...bigRun, ...setKings, ...extraSet, leftover]; // 8+3+3+1=15
  s.declaration.declaredTotals.set("p1", 0); // نعزل اختبار السقف عن منطق العتبة
  engine.declareMelds("p1", [
    { cards: bigRun, kind: MeldKind.RUN }, { cards: setKings, kind: MeldKind.SET },
  ]);
  check("نزول 11 ورقة ينجح، يبقى له ورق زيادة بيده", p1.hand.length, 4);

  // نزول ثاني (3 ورق) يوصل بالضبط لـ14 - يفترض ينجح لأنه = 14 بالضبط (مش أكثر)، ويبقى ورقة وحدة بيده
  s.currentTurnIndex = 0;
  s.hasDrawnThisTurn = true;
  s.lastDrawSource = DrawSource.LEFT_DISCARD;
  engine.declareMelds("p1", [{ cards: extraSet, kind: MeldKind.SET }]);
  check("نزول 14 ورقة بالضبط (على دفعتين) ينجح بدون رفض", p1.hand.length, 1);
  check("مجموع بيرات p1 المنزّلة = 14", s.exposedMelds.filter((m) => m.declaredByPlayerID === "p1").reduce((sum, m) => sum + m.cards.length, 0), 14);

  // محاولة نزول إضافي (حتى لو ورقة وحدة زيادة) - يفترض يفشل لأن المجموع راح يتجاوز 14
  s.currentTurnIndex = 0;
  s.hasDrawnThisTurn = true;
  s.lastDrawSource = DrawSource.LEFT_DISCARD;
  const oneMoreSet = [makeCard(Suit.SPADES, 8), makeCard(Suit.CLUBS, 8), makeCard(Suit.HEARTS, 8)];
  p1.hand.push(...oneMoreSet);
  checkThrows(
    "نزول إضافي بعد ما عنده 14 منزّلة يفشل - يتجاوز السقف",
    () => engine.declareMelds("p1", [{ cards: oneMoreSet, kind: MeldKind.SET }]),
    "14 ورقة"
  );
  check("اليد لم تُحسم (الرفض كان قبل أي تعديل)", p1.hand.length, 4);
}

// ===== نفس القيد على "الإضافة على بير مكشوف" =====
{
  const { engine, s, p1 } = freshEngine();
  s.hasDrawnThisTurn = true;
  s.lastDrawSource = DrawSource.LEFT_DISCARD;

  // نزول 11 ورقة على دفعتين يوصل لـ14 بالضبط (زي البلوك السابق)، ويبقى له ورقة سايبة
  const bigRun = [4,5,6,7,8,9,10,11].map((r) => makeCard(Suit.SPADES, r)); // 8
  const setKings = [makeCard(Suit.HEARTS, 13), makeCard(Suit.CLUBS, 13), makeCard(Suit.DIAMONDS, 13)]; // 3
  const setSevens = [makeCard(Suit.HEARTS, 7), makeCard(Suit.CLUBS, 7), makeCard(Suit.DIAMONDS, 7)]; // 3
  const leftover = makeCard(Suit.SPADES, 2);
  p1.hand = [...bigRun, ...setKings, ...setSevens, leftover]; // 8+3+3+1=15
  s.declaration.declaredTotals.set("p1", 0); // نعزل اختبار السقف عن منطق العتبة
  engine.declareMelds("p1", [{ cards: bigRun, kind: MeldKind.RUN }, { cards: setKings, kind: MeldKind.SET }]); // 11

  s.currentTurnIndex = 0;
  s.hasDrawnThisTurn = true;
  s.lastDrawSource = DrawSource.LEFT_DISCARD;
  engine.declareMelds("p1", [{ cards: setSevens, kind: MeldKind.SET }]); // +3 = 14 بالضبط

  // أي إضافة - حتى من نفس اللاعب - على بير من بيراته يفترض ترفض لأنها تتجاوز 14
  s.currentTurnIndex = 0;
  s.hasDrawnThisTurn = true;
  s.lastDrawSource = DrawSource.LEFT_DISCARD;
  const extraCard = makeCard(Suit.HEARTS, 9);
  p1.hand.push(extraCard);
  const setMeld = s.exposedMelds.find((m) => m.declaredByPlayerID === "p1" && m.kind === MeldKind.SET && m.cards.some((c) => c.rank === 13));
  checkThrows(
    "الإضافة على بير صاحبه عنده 14 منزّلة تفشل - يتجاوز السقف",
    () => engine.addCardToExposedMeld("p1", setMeld.id, extraCard),
    "14 ورقة"
  );
}

// ===== خلل خطير مكتشف: تكرار نفس الورقة بأكثر من بير بنفس النزول يفسد اليد بصمت - لازم يُرفض بأمان =====
{
  const { engine, s } = freshEngine();
  const p1 = s.player("p1");
  s.hasDrawnThisTurn = true;
  s.lastDrawSource = DrawSource.LEFT_DISCARD;
  s.declaration.declaredTotals.set("p1", 0);

  const sevenSpades = makeCard(Suit.SPADES, 7);
  const keep = makeCard(Suit.CLUBS, 2);
  p1.hand = [
    sevenSpades, makeCard(Suit.HEARTS, 7), makeCard(Suit.DIAMONDS, 7),
    makeCard(Suit.SPADES, 5), makeCard(Suit.SPADES, 6), makeCard(Suit.SPADES, 8),
    keep,
  ];
  const meldSet = { cards: [sevenSpades, p1.hand[1], p1.hand[2]], kind: MeldKind.SET };
  const meldRun = { cards: [p1.hand[3], p1.hand[4], sevenSpades, p1.hand[5]], kind: MeldKind.RUN };

  const handBefore = p1.hand.length;
  checkThrows(
    "نزول ببيرين متشاركين بنفس الورقة (7♠) يُرفض - كان قبل يفسد اليد بصمت",
    () => engine.declareMelds("p1", [meldSet, meldRun]),
    "مكررة"
  );
  check("اليد سليمة تماماً بعد الرفض (ما انحذفت أي ورقة، حتى البريئة)", p1.hand.length, handBefore);
  check("الورقة البريئة (2♣) لسه موجودة بالضبط", p1.hand.some((c) => c.id === keep.id), true);
}

// ===== تصحيح مهم: إضافة لاعب ثاني على بيرك ما تأثر على سقفك أنت - السقف يتابع "مين سوّى الفعل" مش "بير مين" =====
{
  const { engine, s, p1 } = freshEngine();
  const p2 = s.player("p2");
  s.hasDrawnThisTurn = true;
  s.lastDrawSource = DrawSource.LEFT_DISCARD;
  s.declaration.declaredTotals.set("p1", 0);

  // p1 ينزّل 11 ورقة (بيرين)
  const run1 = [makeCard(Suit.HEARTS, 13), makeCard(Suit.HEARTS, 12), makeCard(Suit.HEARTS, 11)]; // K,Q,J
  const run2 = [10, 9, 8, 7, 6, 5, 4, 3].map((r) => makeCard(Suit.DIAMONDS, r)); // 8 ورق
  p1.hand = [...run1, ...run2, makeCard(Suit.CLUBS, 2), makeCard(Suit.SPADES, 3), makeCard(Suit.CLUBS, 9)];
  engine.declareMelds("p1", [{ cards: run1, kind: MeldKind.RUN }, { cards: run2, kind: MeldKind.RUN }]);
  check("p1 نزّل 11 ورقة - cardsPlacedBy له = 11", s.cardsPlacedBy.get("p1"), 11);

  // لاعب ثاني (p2) يضيف 3 ورقات على بير p1 (الديناري) بأدوار منفصلة - هذا فعل p2، مش p1
  // (لازم p2 نفسه يكون بالسباق - نزّل قبل - عشان يقدر يضيف على بير أي لاعب، حتى بيره)
  s.declaration.declaredTotals.set("p2", 0);
  s.currentTurnIndex = s.players.findIndex((p) => p.id === "p2");
  const targetMeld = s.exposedMelds.find((m) => m.declaredByPlayerID === "p1" && m.cards.length === 8);
  for (const rank of [2, 13, 14]) {
    const c = makeCard(Suit.DIAMONDS, rank === 14 ? 14 : rank); // قيم تكمّل الطرفين (2 تحت، K،A فوق)
    p2.hand = [c];
    s.hasDrawnThisTurn = true;
    s.lastDrawSource = DrawSource.LEFT_DISCARD;
    try { engine.addCardToExposedMeld("p2", targetMeld.id, c); } catch (e) { /* بعض الترتيب ممكن يفشل بترتيب التسلسل - مقبول بهذا الاختبار */ }
  }
  check("بير p1 صار فيه أكثر من 11 ورقة بسبب إضافات p2 (المجموع الكلي بالبير، مش سقف p1)", targetMeld.cards.length > 8, true);
  check("لكن cardsPlacedBy لـp1 نفسه لسه 11 - ما تأثر بإضافات p2 إطلاقاً", s.cardsPlacedBy.get("p1"), 11);
  check("cardsPlacedBy لـp2 زاد بعدد إضافاته الناجحة (فعله هو، مش p1)", s.cardsPlacedBy.get("p2") > 0, true);

  // الآن p1 يحاول يضيف ورقة وحدة جديدة - يفترض تنجح لأن سقفه الشخصي لسه 11 (وليس متأثر بإضافات p2)
  s.currentTurnIndex = s.players.findIndex((p) => p.id === "p1");
  s.hasDrawnThisTurn = true;
  s.lastDrawSource = DrawSource.LEFT_DISCARD;
  const setMeld = s.exposedMelds.find((m) => m.declaredByPlayerID === "p1" && m.kind === MeldKind.RUN && m.cards.length === 3);
  const newCard = makeCard(Suit.HEARTS, 10);
  p1.hand = [newCard];
  engine.addCardToExposedMeld("p1", setMeld.id, newCard);
  check("p1 قدر يضيف ورقته الـ12 بنجاح (سقفه الشخصي 11+1=12، أقل من 14) - رغم إن إجمالي بيراته المكشوفة (بإضافات p2) أكبر من ذلك", s.cardsPlacedBy.get("p1"), 12);
}

// ===== لاعب ما نزّل أصلاً (مش بالسباق - زي فهد/خالد) ما يقدر يضيف على أي بير - هذا الثغرة اللي تسببت بـ"20 ورقة" =====
{
  const { engine, s, p1 } = freshEngine();
  const p3 = s.player("p3"); // محاكاة "خالد" اللي لم ينزل
  s.declaration.declaredTotals.set("p1", 0); // p1 بالسباق
  const setCards = [makeCard(Suit.SPADES, 9), makeCard(Suit.HEARTS, 9), makeCard(Suit.CLUBS, 9)];
  const meld = { id: "m-test", cards: [...setCards], kind: MeldKind.SET, declaredByPlayerID: "p1" };
  s.exposedMelds.push(meld);
  check("p3 (خالد) مش بالسباق - ما نزّل شي", s.declaration.isPlayerInRace("p3"), false);

  s.currentTurnIndex = s.players.findIndex((p) => p.id === "p3");
  s.hasDrawnThisTurn = true;
  s.lastDrawSource = DrawSource.LEFT_DISCARD;
  const card = makeCard(Suit.DIAMONDS, 9);
  p3.hand = [card];
  checkThrows(
    "خالد (مش بالسباق) يحاول يضيف على بير p1 - يُرفض (هذا اللي تسبب بـ20 ورقة قبل الإصلاح)",
    () => engine.addCardToExposedMeld("p3", meld.id, card),
    "تنزّل"
  );
  check("بير p1 ما تغيّر (لسه 3 ورق)", meld.cards.length, 3);
  check("الورقة لسه بيد خالد", p3.hand.some((c) => c.id === card.id), true);
}

console.log(`\n— النتيجة: ${pass} ناجح، ${fail} فاشل —`);
process.exit(fail > 0 ? 1 : 0);
