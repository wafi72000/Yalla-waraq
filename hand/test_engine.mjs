import { HandEngine, DrawSource } from "./js/engine.js";

let pass = 0, fail = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "✅" : "❌"} ${name} → ${JSON.stringify(actual)} (متوقع: ${JSON.stringify(expected)})`);
  ok ? pass++ : fail++;
}

const players = [
  { id: "p1", name: "أنت", hand: [] },
  { id: "p2", name: "سالم", hand: [] },
  { id: "p3", name: "خالد", hand: [] },
  { id: "p4", name: "فهد", hand: [] },
];

const engine = new HandEngine(players);
engine.state.dealerIndex = 0; // نثبّته بالاختبار فقط، رغم إنه عشوائي بالواقع
engine.startNewRound();

check("كل لاعب عنده 14 ورقة", players.every((p) => p.hand.length === 14), true);
check("الدِّستة فيها 50 ورقة (106-56)", engine.state.drawPile.count, 50);
check("يبدأ اللاعب يمين الموزع (index 1)", engine.state.currentTurnIndex, 1);

const firstPlayerID = engine.state.currentTurnPlayerID;
check("أول لاعب = p2", firstPlayerID, "p2");

// محاولة رمي بدون سحب - يفشل
let threw = false;
try {
  engine.discardCard(firstPlayerID, players[1].hand[0]);
} catch (e) { threw = true; }
check("الرمي بدون سحب يفشل", threw, true);

// سحب من الدِّستة
const drawn = engine.drawCard(firstPlayerID, DrawSource.STOCK);
check("بعد السحب يده 15 ورقة", players[1].hand.length, 15);
check("الدِّستة نقصت لـ49", engine.state.drawPile.count, 49);

// رمي
engine.discardCard(firstPlayerID, drawn);
check("بعد الرمي يده رجعت 14", players[1].hand.length, 14);
check("الدور انتقل للاعب التالي (p3)", engine.state.currentTurnPlayerID, "p3");
check("ورقة النار فيها 1", engine.state.discardPile.length, 1);

// محاولة سحب مرتين بنفس الدور - يفشل
engine.drawCard("p3", DrawSource.STOCK);
threw = false;
try { engine.drawCard("p3", DrawSource.STOCK); } catch (e) { threw = true; }
check("السحب مرتين بنفس الدور يفشل", threw, true);

// --- اختبار قاعدة فتح النار بعد 4 لفّات (16 سحبة) ---
{
  const players2 = [
    { id: "p1", name: "أنت", hand: [] },
    { id: "p2", name: "سالم", hand: [] },
    { id: "p3", name: "خالد", hand: [] },
    { id: "p4", name: "فهد", hand: [] },
  ];
  const engine2 = new HandEngine(players2);
  engine2.startNewRound();

  // أول دور: محاولة أخذ من النار قبل أي سحبة - يفشل (النار فاضية أصلاً + مقفولة)
  threw = false;
  try { engine2.drawCard(engine2.state.currentTurnPlayerID, DrawSource.LEFT_DISCARD); } catch (e) { threw = true; }
  check("أخذ من النار قبل اكتمال 4 لفّات يفشل", threw, true);

  // نكمل 16 سحبة (4 لفّات) عادية من الدِّستة مع رمي ورقة بعد كل سحبة
  for (let i = 0; i < 16; i++) {
    const pid = engine2.state.currentTurnPlayerID;
    engine2.drawCard(pid, DrawSource.STOCK);
    const player = engine2.state.player(pid);
    engine2.discardCard(pid, player.hand[0]);
  }
  check("عداد السحبات = 16 بعد 4 لفّات", engine2.state.totalDrawsThisRound, 16);
  check("النار صارت مفتوحة", engine2.state.isLeftDiscardUnlocked, true);

  // الآن أخذ من النار يجب ينجح (لو فيه ورقة بالنار)
  const pid2 = engine2.state.currentTurnPlayerID;
  let drawErr = null;
  try { engine2.drawCard(pid2, DrawSource.LEFT_DISCARD); } catch (e) { drawErr = e; }
  check("أخذ من النار بعد اكتمال 4 لفّات ينجح", drawErr, null);
}

// --- اختبار قاعدة الالتزام: أخذ ورقة من النار يلزم نزول/خالص، أو إرجاعها ---
{
  const players3 = [
    { id: "p1", name: "أنت", hand: [] },
    { id: "p2", name: "سالم", hand: [] },
    { id: "p3", name: "خالد", hand: [] },
    { id: "p4", name: "فهد", hand: [] },
  ];
  const engine3 = new HandEngine(players3);
  engine3.startNewRound();
  // نفتح النار (16 سحبة)
  for (let i = 0; i < 16; i++) {
    const pid = engine3.state.currentTurnPlayerID;
    engine3.drawCard(pid, DrawSource.STOCK);
    engine3.discardCard(pid, engine3.state.player(pid).hand[0]);
  }
  const pid = engine3.state.currentTurnPlayerID;
  const player3 = engine3.state.player(pid);
  engine3.drawCard(pid, DrawSource.LEFT_DISCARD);

  threw = false;
  try { engine3.discardCard(pid, player3.hand[0]); } catch (e) { threw = true; }
  check("رمي عادي بعد أخذ من النار بدون نزول/خالص يفشل", threw, true);

  engine3.undoLeftDiscardDraw(pid); // ترجع الورقة وتفتح فرصة سحب جديد
  check("بعد الإرجاع: hasDrawnThisTurn رجعت false", engine3.state.hasDrawnThisTurn, false);
  engine3.drawCard(pid, DrawSource.STOCK);
  let noThrow = null;
  try { engine3.discardCard(pid, player3.hand[0]); } catch (e) { noThrow = e; }
  check("بعد الإرجاع والسحب من الدِّستة: الرمي العادي ينجح", noThrow, null);
}

console.log(`\n— النتيجة: ${pass} ناجح، ${fail} فاشل —`);
process.exit(fail > 0 ? 1 : 0);
