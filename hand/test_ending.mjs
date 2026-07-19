import { HandEngine, ExposedMeld, DrawSource } from "./js/engine.js";
import "./js/declareEngine.js";
import "./js/endingEngine.js";
import { EndingType } from "./js/escalation.js";
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

function freshEngine(drawSource = DrawSource.STOCK) {
  const players = [
    { id: "p1", name: "أنت", hand: [] },
    { id: "p2", name: "سالم", hand: [] },
    { id: "p3", name: "خالد", hand: [] },
    { id: "p4", name: "فهد", hand: [] },
  ];
  const engine = new HandEngine(players);
  engine.state.currentTurnIndex = 0;
  engine.state.hasDrawnThisTurn = true;
  engine.state.lastDrawSource = drawSource;
  return engine;
}

// --- 1: هند عادي (جوكر=0) → تير0: -60/200 ---
{
  const engine = freshEngine();
  const tier = engine.endRound("p1", EndingType.HAND, []);
  check("هند عادي: -60", tier.winnerScore, -60);
  check("هند عادي: السجل = -60", engine.state.cumulativeScores.get("p1"), -60);
  check("هند عادي: خصم لم ينزل = 200", engine.state.cumulativeScores.get("p2"), 200);
}

// --- 2: خالص → تير1: -30/100 ---
{
  const engine = freshEngine(DrawSource.LEFT_DISCARD);
  const tier = engine.endRound("p1", EndingType.KHALES, []);
  check("خالص: -30", tier.winnerScore, -30);
  check("خالص: خصم = 100", engine.state.cumulativeScores.get("p2"), 100);
}

// --- 3: هند + جوكر واحد انرمى بالنار هذي الجولة → تير2: -120/400 ---
{
  const engine = freshEngine();
  engine.state.escalation.registerJokerDiscarded(); // جوكر واحد انرمى بالنار هذي الجولة
  const player = engine.state.player("p1");
  const joker = makeJoker();
  player.hand.push(joker);
  const tier = engine.endRound("p1", EndingType.HAND, [joker]);
  check("هند+1جوكر بالجولة: -120", tier.winnerScore, -120);
  check("هند+1جوكر بالجولة: خصم = 400", engine.state.cumulativeScores.get("p2"), 400);
}

// --- ملاحظة: لا يوجد اختبار "هند+جوكرين بالجولة" - الهند تُمنع تماماً عند جوكرين بالجولة (تصعيد)،
// فهذا التير (index 3 لهند) غير قابل للوصول إليه فعلياً تحت قواعد التصعيد الحالية، وهذا متوقّع وصحيح.

// --- 5: رمية مزدوجة (جوكر+ورقة عادية) تفشل ---
{
  const engine = freshEngine();
  const player = engine.state.player("p1");
  const j1 = makeJoker(), normalCard = makeCard(Suit.HEARTS, 5);
  player.hand.push(j1, normalCard);
  checkThrows("رمية مزدوجة (جوكر+ورقة عادية) تفشل", () =>
    engine.endRound("p1", EndingType.HAND, [j1, normalCard])
  );
}

// --- 6: لون بيد مختلطة (أحمر+أسود) تفشل ---
{
  const engine = freshEngine();
  const player = engine.state.player("p1");
  const redRun = [makeCard(Suit.HEARTS, 3), makeCard(Suit.HEARTS, 4), makeCard(Suit.HEARTS, 5)];
  const blackCard = makeCard(Suit.SPADES, 6);
  player.hand.push(...redRun, blackCard);
  engine.state.escalation.registerJokerDiscarded();
  engine.state.escalation.registerJokerDiscarded();
  checkThrows("لون بيد مختلطة يفشل", () =>
    engine.endRound("p1", EndingType.COLOR, [blackCard], [{ cards: redRun, kind: MeldKind.RUN }])
  );
}

// --- 7: لون بقلوب+ديناري (لون واحد) ينجح → تير2 ---
{
  const engine = freshEngine();
  const player = engine.state.player("p1");
  const redRun = [makeCard(Suit.HEARTS, 3), makeCard(Suit.HEARTS, 4), makeCard(Suit.HEARTS, 5)];
  const diamond = makeCard(Suit.DIAMONDS, 6);
  player.hand.push(...redRun, diamond);
  const tier = engine.endRound("p1", EndingType.COLOR, [diamond], [{ cards: redRun, kind: MeldKind.RUN }]);
  check("لون بقلوب+ديناري ينجح: -120", tier.winnerScore, -120);
}

// --- 8: قرينق ببستوني فقط ينجح → تير3 ---
{
  const engine = freshEngine();
  const player = engine.state.player("p1");
  const spadeRun = [makeCard(Suit.SPADES, 3), makeCard(Suit.SPADES, 4), makeCard(Suit.SPADES, 5)];
  const spade1 = makeCard(Suit.SPADES, 6);
  player.hand.push(...spadeRun, spade1);
  const tier = engine.endRound("p1", EndingType.QARINQ, [spade1], [{ cards: spadeRun, kind: MeldKind.RUN }]);
  check("قرينق ببستوني فقط ينجح: -240", tier.winnerScore, -240);
}

// --- 9: هند ممنوع بعد جوكرين ---
{
  const engine = freshEngine();
  engine.state.escalation.registerJokerDiscarded();
  engine.state.escalation.registerJokerDiscarded();
  checkThrows("هند ممنوع بعد جوكرين", () => engine.endRound("p1", EndingType.HAND, []));
}

// --- 10: خصم نازل بـ91+ يُحسب بنقاط الورق المتبقي × المضاعف ---
{
  const engine = freshEngine();
  engine.state.currentTurnIndex = 1;
  engine.state.lastDrawSource = DrawSource.LEFT_DISCARD; // شرط نزول p2
  const p2 = engine.state.player("p2");
  const set1 = [makeCard(Suit.HEARTS, 12), makeCard(Suit.DIAMONDS, 12), makeCard(Suit.CLUBS, 12), makeCard(Suit.SPADES, 12)]; // 40
  const set2 = [makeCard(Suit.HEARTS, 13), makeCard(Suit.DIAMONDS, 13), makeCard(Suit.CLUBS, 13)]; // 30
  const set3 = [makeCard(Suit.HEARTS, 7), makeCard(Suit.DIAMONDS, 7), makeCard(Suit.CLUBS, 7)]; // 21
  p2.hand.push(...set1, ...set2, ...set3, makeCard(Suit.HEARTS, 5)); // 91 بالضبط + ورقة متبقية بيده، قيمتها 5
  engine.declareMelds("p2", [
    { cards: set1, kind: MeldKind.SET }, { cards: set2, kind: MeldKind.SET }, { cards: set3, kind: MeldKind.SET },
  ]);
  check("p2 دخل السباق بـ91", engine.state.declaration.declaredTotals.get("p2"), 91);

  engine.state.currentTurnIndex = 0;
  engine.state.lastDrawSource = DrawSource.STOCK; // شرط هند p1
  const tier = engine.endRound("p1", EndingType.HAND, []);
  check("هند عادي: مضاعف الناز = 2", tier.opponentLaidMultiplier, 2);
  check("نتيجة p2 (نازل): 5×2=10", engine.state.cumulativeScores.get("p2"), 10);
  check("نتيجة p3 (لم ينزل): 200 ثابتة", engine.state.cumulativeScores.get("p3"), 200);
}

// --- 11: (إصلاح خطأ) هند بدون اكتمال البيرات (ورق متبقي بدون نزول) يجب يفشل ---
{
  const engine = freshEngine();
  const player = engine.state.player("p1");
  player.hand.push(makeCard(Suit.HEARTS, 7), makeCard(Suit.HEARTS, 8), makeCard(Suit.HEARTS, 9));
  checkThrows("هند بورق غير منزّل يفشل (الخطأ المُصحَّح)", () =>
    engine.endRound("p1", EndingType.HAND, [])
  );
}

// --- 12: (قاعدة جديدة) هند يفشل لو اللاعب لمس بير مكشوف هذي الجولة (نزول سابق) ---
{
  const engine = freshEngine(DrawSource.LEFT_DISCARD);
  const player = engine.state.player("p1");
  const run1 = [makeCard(Suit.HEARTS, 10), makeCard(Suit.HEARTS, 11), makeCard(Suit.HEARTS, 12), makeCard(Suit.HEARTS, 13)]; // 40
  const acesSet = [makeCard(Suit.HEARTS, 14), makeCard(Suit.DIAMONDS, 14), makeCard(Suit.CLUBS, 14)]; // 33
  const sevenSet = [makeCard(Suit.HEARTS, 7), makeCard(Suit.DIAMONDS, 7), makeCard(Suit.CLUBS, 7)]; // 21
  player.hand.push(...run1, ...acesSet, ...sevenSet, makeCard(Suit.SPADES, 3)); // 94 + ورقة سايبة
  engine.declareMelds("p1", [
    { cards: run1, kind: MeldKind.RUN }, { cards: acesSet, kind: MeldKind.SET }, { cards: sevenSet, kind: MeldKind.SET },
  ]);
  check("p1 لمس المكشوف (نزل)", engine.state.exposedActionPlayers.has("p1"), true);

  engine.state.lastDrawSource = DrawSource.STOCK;
  const lastCard = makeCard(Suit.SPADES, 9);
  player.hand.push(lastCard);
  checkThrows("هند يفشل بعد لمس المكشوف بنفس الجولة (مسار مختلط)", () =>
    engine.endRound("p1", EndingType.HAND, [lastCard], [])
  );
}

// --- 13: (قاعدة جديدة) هند ينجح بمسار مخفي كامل (بدون أي لمس مكشوف، كشف اليد دفعة وحدة) ---
{
  const engine = freshEngine();
  const player = engine.state.player("p1");
  const run1 = [makeCard(Suit.CLUBS, 5), makeCard(Suit.CLUBS, 6), makeCard(Suit.CLUBS, 7)]; // 18
  const lastCard = makeCard(Suit.SPADES, 9);
  player.hand.push(...run1, lastCard);
  const tier = engine.endRound("p1", EndingType.HAND, [lastCard], [{ cards: run1, kind: MeldKind.RUN }]);
  check("هند مخفي (كشف دفعة وحدة) ينجح: -60", tier.winnerScore, -60);
}

console.log(`\n— النتيجة: ${pass} ناجح، ${fail} فاشل —`);
process.exit(fail > 0 ? 1 : 0);
