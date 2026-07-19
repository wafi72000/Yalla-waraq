// يثبّت الفهم الصحيح المُتفق عليه: جوكر/جوكرين = ورقة/ورقتي الإعلان نفسها (محجوزة برّا البيرات)، مش عداد النار العام.
// وخالص مباشر: صفر لمس لبير مكشوف، كشف دفعة وحدة بسحب النار، نقاطها -30 ثابتة حتى لو ورقة الإعلان جوكر.
import { HandEngine, DrawSource } from "./js/engine.js";
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

function freshEngine() {
  const players = [
    { id: "p1", name: "أنت", hand: [] }, { id: "p2", name: "سالم", hand: [] },
    { id: "p3", name: "خالد", hand: [] }, { id: "p4", name: "فهد", hand: [] },
  ];
  const engine = new HandEngine(players);
  engine.startNewRound();
  const s = engine.state;
  s.currentTurnIndex = 0;
  return { engine, s, p1: s.player("p1") };
}

function thirteenCards() {
  const run1 = [2, 3, 4, 5, 6, 7, 8].map((r) => makeCard(Suit.HEARTS, r)); // 7
  const run2 = [2, 3, 4, 5, 6, 7].map((r) => makeCard(Suit.CLUBS, r)); // 6
  return [run1, run2];
}

// ===== هند بدون ورقة إعلان جوكر = -60 =====
{
  const { engine, s, p1 } = freshEngine();
  s.hasDrawnThisTurn = true;
  s.lastDrawSource = DrawSource.STOCK;
  const [run1, run2] = thirteenCards();
  const declareCard = makeCard(Suit.SPADES, 9);
  p1.hand = [...run1, ...run2, declareCard];
  const tier = engine.endRound("p1", EndingType.HAND, [declareCard], [
    { cards: run1, kind: MeldKind.RUN }, { cards: run2, kind: MeldKind.RUN },
  ]);
  check("هند، ورقة الإعلان عادية = -60", tier.winnerScore, -60);
}

// ===== هند وورقة الإعلان جوكر = -120 (تير "جوكر") =====
{
  const { engine, s, p1 } = freshEngine();
  s.hasDrawnThisTurn = true;
  s.lastDrawSource = DrawSource.STOCK;
  const [run1, run2] = thirteenCards();
  const declareJoker = makeJoker();
  p1.hand = [...run1, ...run2, declareJoker];
  const tier = engine.endRound("p1", EndingType.HAND, [declareJoker], [
    { cards: run1, kind: MeldKind.RUN }, { cards: run2, kind: MeldKind.RUN },
  ]);
  check("هند وورقة الإعلان جوكر = -120 (جوكر)", tier.winnerScore, -120);
}

// ===== هند وورقتي الإعلان جوكرين = -240 (تير "جوكرين") =====
{
  const { engine, s, p1 } = freshEngine();
  s.hasDrawnThisTurn = true;
  s.lastDrawSource = DrawSource.STOCK;
  const run1 = [4, 5, 6, 7, 8].map((r) => makeCard(Suit.HEARTS, r)); // 5
  const run2 = [2, 3, 4, 5].map((r) => makeCard(Suit.CLUBS, r)); // 4
  const setX = [makeCard(Suit.SPADES, 9), makeCard(Suit.DIAMONDS, 9), makeCard(Suit.CLUBS, 9)]; // 3
  const j1 = makeJoker(), j2 = makeJoker(); // 2  -> 5+4+3+2=14
  p1.hand = [...run1, ...run2, ...setX, j1, j2];
  const tier = engine.endRound("p1", EndingType.HAND, [j1, j2], [
    { cards: run1, kind: MeldKind.RUN }, { cards: run2, kind: MeldKind.RUN }, { cards: setX, kind: MeldKind.SET },
  ]);
  check("هند وورقتي الإعلان جوكرين = -240 (جوكرين)", tier.winnerScore, -240);
}

// ===== جوكر داخل بير (يكمّل تسلسل) - مش ورقة إعلان - ما يرفع التير =====
{
  const { engine, s, p1 } = freshEngine();
  s.hasDrawnThisTurn = true;
  s.lastDrawSource = DrawSource.STOCK;
  const jokerInMeld = makeJoker();
  const realRun = [makeCard(Suit.HEARTS, 2), makeCard(Suit.HEARTS, 3), jokerInMeld, makeCard(Suit.HEARTS, 5)]; // 4
  const run2 = [2, 3, 4, 5, 6, 7, 8, 9, 10].map((r) => makeCard(Suit.CLUBS, r)); // 9
  const declareCard = makeCard(Suit.SPADES, 9); // 1 - عادية
  p1.hand = [...realRun, ...run2, declareCard]; // 4+9+1=14
  const tier = engine.endRound("p1", EndingType.HAND, [declareCard], [
    { cards: realRun, kind: MeldKind.RUN }, { cards: run2, kind: MeldKind.RUN },
  ]);
  check("جوكر داخل بير (مش ورقة إعلان) ما يرفع التير - يبقى -60", tier.winnerScore, -60);
}

// ===== خالص مباشر: صفر لمس، كشف دفعة وحدة بسحب النار، نقاطها -30 حتى لو ورقة الإعلان جوكر =====
{
  const { engine, s, p1 } = freshEngine();
  s.hasDrawnThisTurn = true;
  s.lastDrawSource = DrawSource.LEFT_DISCARD;
  const [run1, run2] = thirteenCards();
  const declareJoker = makeJoker();
  p1.hand = [...run1, ...run2, declareJoker];
  check("ما سبق ولمس بير مكشوف (شرط خالص مباشر)", s.exposedActionPlayers.has("p1"), false);
  const tier = engine.endRound("p1", EndingType.KHALES, [declareJoker], [
    { cards: run1, kind: MeldKind.RUN }, { cards: run2, kind: MeldKind.RUN },
  ]);
  check("خالص مباشر بورقة إعلان جوكر = -30 ثابتة (الخالص لا يتأثر بالجوكر)", tier.winnerScore, -30);
  check("يد p1 فاضية تماماً بعد خالص مباشر", p1.hand.length, 0);
  check("البيرات المُعلنة انضافت كمكشوفة على الطاولة", s.exposedMelds.length, 2);
}

// ===== خالص مباشر يفشل لو سبق ولمس بير مكشوف (يتحوّل لمسار خالص بعد النزول) =====
{
  const { engine, s, p1 } = freshEngine();
  s.hasDrawnThisTurn = true;
  s.lastDrawSource = DrawSource.LEFT_DISCARD;
  const setAces = [makeCard(Suit.SPADES, 14), makeCard(Suit.CLUBS, 14), makeCard(Suit.DIAMONDS, 14)];
  const [run1, run2] = thirteenCards();
  const declareCard = makeCard(Suit.SPADES, 9);
  s.declaration.declaredTotals.set("p1", 0);
  p1.hand = [...setAces, ...run1, ...run2, declareCard];
  engine.declareMelds("p1", [{ cards: setAces, kind: MeldKind.SET }]);
  check("بعد النزول: سبق ولمس بير مكشوف", s.exposedActionPlayers.has("p1"), true);

  s.hasDrawnThisTurn = true;
  s.lastDrawSource = DrawSource.LEFT_DISCARD;
  let errMsg = "";
  try {
    engine.endRound("p1", EndingType.KHALES, [declareCard], [
      { cards: run1, kind: MeldKind.RUN }, { cards: run2, kind: MeldKind.RUN },
    ]);
  } catch (e) {
    errMsg = e.message;
  }
  check("خالص بعد لمس مكشوف يرفض إرسال بيرات جديدة - رسالة 'ورق غير منزّل'", errMsg.includes("منزّل"), true);
}

console.log(`\n— النتيجة: ${pass} ناجح، ${fail} فاشل —`);
process.exit(fail > 0 ? 1 : 0);
