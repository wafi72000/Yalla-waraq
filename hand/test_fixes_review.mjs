// اختبارات سريعة للإصلاحات المطلوبة بعد مراجعة الصورة
import { HandEngine, DrawSource, HandRuleError } from "./js/engine.js";
import "./js/declareEngine.js"; // يضيف declareMelds على prototype
import { MeldKind } from "./js/meld.js";
import { totalPoints } from "./js/scoring.js";

let pass = 0, fail = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "✅" : "❌"} ${label} → ${JSON.stringify(actual)} (متوقع: ${JSON.stringify(expected)})`);
  ok ? pass++ : fail++;
}

function makeCard(rank, suit, id) { return { rank, suit, isJoker: false, id: id ?? `${rank}${suit}` }; }

// ===== اختبار #1: النزول بأكثر من بير واحد بنفس الوقت يجمع كل النقاط =====
{
  const engine = new HandEngine([
    { id: "p1", name: "p1", hand: [] }, { id: "p2", name: "p2", hand: [] },
    { id: "p3", name: "p3", hand: [] }, { id: "p4", name: "p4", hand: [] },
  ]);
  engine.startNewRound();
  const s = engine.state;
  s.currentTurnIndex = s.players.findIndex((p) => p.id === "p1");
  s.totalDrawsThisRound = 16; // فتح ورقة النار
  const setJ = [makeCard(11, "clubs", "Jc"), makeCard(11, "spades", "Js"), makeCard(11, "diamonds", "Jd")];
  const setQ = [makeCard(12, "clubs", "Qc"), makeCard(12, "spades", "Qs"), makeCard(12, "diamonds", "Qd")];
  s.player("p1").hand = [...setJ, ...setQ, makeCard(2, "hearts", "leftover1")];
  s.discardPile.push(makeCard(2, "hearts", "discardTop"));
  s.hasDrawnThisTurn = true;
  s.lastDrawSource = DrawSource.LEFT_DISCARD;
  s.lastDrawnCardID = null;
  s.declaration.declaredTotals.set("p1", 0); // اللاعب بالفعل بالسباق - نعزل اختبار جمع النقاط عن منطق العتبة (مغطّى باختبار آخر)

  const expectedTotal = totalPoints(setJ, MeldKind.SET) + totalPoints(setQ, MeldKind.SET);
  engine.declareMelds("p1", [{ cards: setJ, kind: MeldKind.SET }, { cards: setQ, kind: MeldKind.SET }]);
  check("نزول ببيرين بنفس الوقت يسجّل إجمالي الاثنين معاً", s.declaration.declaredTotals.get("p1"), expectedTotal);
  check("البيرين المنزّلين انضافوا للطاولة (2 exposedMelds)", s.exposedMelds.length, 2);
  check("يد p1 صار فيها ورقة سايبة وحدة بعد نزول البيرين", s.player("p1").hand.length, 1);
}

// ===== اختبار #2: إرجاع ورقة النار يرجّع نفس الورقة بالضبط، حتى لو رتّب يده بعدها =====
{
  const engine = new HandEngine([
    { id: "p1", name: "p1", hand: [] }, { id: "p2", name: "p2", hand: [] },
    { id: "p3", name: "p3", hand: [] }, { id: "p4", name: "p4", hand: [] },
  ]);
  engine.startNewRound();
  const s = engine.state;
  s.currentTurnIndex = s.players.findIndex((p) => p.id === "p1");
  s.totalDrawsThisRound = 16;
  const fireCard = makeCard(9, "hearts", "FIRE9h");
  s.discardPile.push(fireCard);
  const human = s.player("p1");
  human.hand = [makeCard(3, "clubs", "keep1"), makeCard(4, "clubs", "keep2")];

  engine.drawCard("p1", DrawSource.LEFT_DISCARD);
  check("الورقة المسحوبة من النار انضافت لليد", human.hand.some((c) => c.id === "FIRE9h"), true);

  // المستخدم يرتّب يده بالسحب الحر - يحرّك ورقة النار لأول اليد بدل آخرها
  const idx = human.hand.findIndex((c) => c.id === "FIRE9h");
  const [card] = human.hand.splice(idx, 1);
  human.hand.unshift(card);
  check("بعد إعادة الترتيب: ورقة النار بأول اليد الآن (مش آخرها)", human.hand[0].id, "FIRE9h");

  engine.undoLeftDiscardDraw("p1");
  check("الإرجاع شال ورقة النار نفسها (FIRE9h) رغم تغيّر موضعها", human.hand.some((c) => c.id === "FIRE9h"), false);
  check("باقي الورق الأصلي لليد سليم (keep1, keep2)", human.hand.map((c) => c.id).sort(), ["keep1", "keep2"]);
  check("ورقة النار رجعت لقمة كومة النار", s.discardPile[s.discardPile.length - 1].id, "FIRE9h");
}

// ===== اختبار #3: محاولة إرجاع ورقة بعد ما تحركت/اختفت (حالة دفاعية) ما تكسر اللعبة =====
{
  const engine = new HandEngine([
    { id: "p1", name: "p1", hand: [] }, { id: "p2", name: "p2", hand: [] },
    { id: "p3", name: "p3", hand: [] }, { id: "p4", name: "p4", hand: [] },
  ]);
  engine.startNewRound();
  const s = engine.state;
  s.currentTurnIndex = s.players.findIndex((p) => p.id === "p1");
  s.totalDrawsThisRound = 16;
  s.discardPile.push(makeCard(7, "spades", "FIRE7s"));
  engine.drawCard("p1", DrawSource.LEFT_DISCARD);
  // محاكاة حالة غير متوقعة: الورقة اختفت من اليد (مثلاً نزّلت ببير ثم حاول أحد يرجعها بالغلط)
  const human = s.player("p1");
  human.hand = human.hand.filter((c) => c.id !== "FIRE7s");
  let threw = false;
  try { engine.undoLeftDiscardDraw("p1"); } catch (e) { threw = e instanceof HandRuleError; }
  check("الإرجاع يفشل بأمان برسالة خطأ لو الورقة مش موجودة (بدل يشيل ورقة غلط)", threw, true);
}

console.log(`\n— النتيجة: ${pass} ناجح، ${fail} فاشل —`);
process.exit(fail > 0 ? 1 : 0);
