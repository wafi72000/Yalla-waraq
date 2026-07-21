import { BalootMatch, HandRuleError } from "./js/engine.js";
import { BidChoice } from "./js/bidding.js";
import { Suit } from "./js/models.js";

let pass = 0, fail = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "✅" : "❌"} ${name} → ${JSON.stringify(actual)} (متوقع: ${JSON.stringify(expected)})`);
  ok ? pass++ : fail++;
}
function checkThrows(name, fn) {
  try { fn(); console.log(`❌ ${name} (يفترض يفشل)`); fail++; }
  catch (e) { console.log(`✅ ${name} (يفترض يفشل) - ${e.message}`); pass++; }
}

const seatOrder = ["p1", "p2", "p3", "p4"]; // فيزيائي: p1-p3 فريق A متقابلين، p2-p4 فريق B
const teamOfPlayer = (id) => (id === "p1" || id === "p3") ? "A" : "B";

function freshMatch() {
  return new BalootMatch(seatOrder, teamOfPlayer);
}

/// يلعب يد كاملة بأبسط طريقة ممكنة: كل لاعب يرمي أول ورقة صالحة بيده (يضمن نجاح اللعبة ميكانيكياً بدون استراتيجية)
function playFullHandAutomatically(match) {
  while (match.phase === "playing") {
    if (match.completedTrick) {
      match.clearCompletedTrick(); // الاختبار الآلي "يشوف" الشوط فوراً ويكمل - ما يحتاج وقفة حقيقية
      continue;
    }
    const playerID = match.turnPlayerID;
    const hand = match.hands.get(playerID);
    let played = false;
    for (const card of [...hand]) {
      try {
        match.playCard(playerID, card);
        played = true;
        break;
      } catch (e) {
        continue; // ورقة غير صالحة - نجرّب التالية
      }
    }
    if (!played) throw new Error("ما قدر أي لاعب يرمي أي ورقة - خلل بالمنطق");
  }
}

/// يشتري حكم أول عبر لاعب معيّن، ويكمّل الجولة بالباقين "بس" - يضمن الحكم يصير المشتري النهائي فعلياً
/// (القاعدة الجديدة: حكم بالجولة الأولى يصير معلّق، ما يقفل المزايدة فوراً)
function buyHukmAndFinalize(match, buyerID) {
  const order = match.currentSeatOrder;
  const buyerIdx = order.indexOf(buyerID);
  match.submitBid(buyerID, BidChoice.HUKM);
  for (let i = 1; i < order.length; i++) {
    const id = order[(buyerIdx + i) % order.length];
    match.submitBid(id, BidChoice.PASS);
  }
}

// ===== يد كاملة: توزيع → مزايدة (صن) → لعب 8 أشواط → حساب =====
{
  const match = freshMatch();
  check("الدور يبدأ بيمين الموزّع (index0 بترتيب اليد)", match.bidding.currentPlayerID, match.currentSeatOrder[0]);

  // كل اللاعبين يمرّرون إلا آخر واحد (يسار الموزّع) يشتري صن
  const order = match.currentSeatOrder;
  match.submitBid(order[0], BidChoice.PASS);
  match.submitBid(order[1], BidChoice.PASS);
  const result = match.submitBid(order[2], BidChoice.SUN);
  check("الشراء نجح بصن", result.choice, BidChoice.SUN);
  check("المرحلة صارت لعب مباشرة (صن، بدون دبل)", match.phase, "playing");

  for (const id of order) {
    check(`${id} معه 8 ورقات بعد إكمال التوزيع`, match.hands.get(id).length, 8);
  }

  match.resolveProjects();
  playFullHandAutomatically(match);

  check("المرحلة صارت handOver بعد 8 أشواط", match.phase, "handOver");
  check("فيه نتيجة يد", !!match.handResult, true);
  check("مجموع تراكمي محدّث (ليس صفر-صفر)", match.cumulativeScores.A + match.cumulativeScores.B > 0, true);
}

// ===== صكّة ميتة: الكل يمرر بالجولتين، اليد تُلغى بدون حساب =====
{
  const match = freshMatch();
  const order = match.currentSeatOrder;
  for (let round = 0; round < 2; round++) {
    for (const id of order) match.submitBid(id, BidChoice.PASS);
  }
  check("صكّة ميتة", match.phase, "dead");
  check("النقاط التراكمية ما تغيّرت", match.cumulativeScores, { A: 0, B: 0 });

  const dealerBefore = match.dealerID;
  match.advanceToNextHand();
  check("الموزّع دار لليمين بعد الصكّة الميتة", match.dealerID, seatOrder[(seatOrder.indexOf(dealerBefore) + 1) % 4]);
}

// ===== شراء حكم يفتح مرحلة الدبل قبل اللعب =====
{
  const match = freshMatch();
  const order = match.currentSeatOrder;
  match.submitBid(order[0], BidChoice.HUKM); // حكم أول - معلّق فقط الآن، ما يقفل المزايدة فوراً
  check("المزايدة لسه مستمرة (حكم معلّق، مش نهائي بعد)", match.phase, "bidding");
  match.submitBid(order[1], BidChoice.PASS);
  match.submitBid(order[2], BidChoice.PASS);
  match.submitBid(order[3], BidChoice.PASS); // آخر لاعب - الحكم المعلّق يصير نهائي
  check("شراء الحكم يفتح مرحلة الدبل بعد اكتمال الجولة", match.phase, "doubling");
  check("isHukm = true", match.isHukm, true);

  match.proceedToPlay();
  check("proceedToPlay ينقل لمرحلة اللعب", match.phase, "playing");
}

// ===== الدبل الفعلي: الخصم يطلب دبل، يؤثر على المعامل =====
{
  const match = freshMatch();
  const order = match.currentSeatOrder;
  buyHukmAndFinalize(match, order[0]);
  const buyerTeam = match.buyerTeam;
  const opponentTeam = match.opponentTeam;

  const level = match.requestDouble(opponentTeam);
  check("الدبل نجح، المستوى=1", level, 1);
  check("المعامل صار 2", match.doubling.multiplier, 2);

  match.proceedToPlay();
  playFullHandAutomatically(match);
  check("اليد اكتملت مع الدبل الفعّال", match.phase, "handOver");
}

// ===== مو دورك بالمزايدة يُرفض عبر المحرك =====
{
  const match = freshMatch();
  const order = match.currentSeatOrder;
  checkThrows("مزايدة بغير الدور تُرفض عبر المحرك", () => match.submitBid(order[2], BidChoice.PASS));
}

// ===== رمي ورقة بغير الدور يُرفض =====
{
  const match = freshMatch();
  const order = match.currentSeatOrder;
  match.submitBid(order[0], BidChoice.SUN);
  const notMyTurn = seatOrder.find((id) => id !== match.turnPlayerID);
  checkThrows("رمي ورقة بغير دورك يُرفض", () => {
    const card = match.hands.get(notMyTurn)[0];
    match.playCard(notMyTurn, card);
  });
}

// ===== مباراة كاملة حتى نهايتها (نلعب عدة أيدي متتالية حتى isGameOver) =====
{
  const match = freshMatch();
  let handsPlayed = 0;
  const MAX_HANDS = 60; // حماية احترازية

  while (!match.matchOver && handsPlayed < MAX_HANDS) {
    const order = match.currentSeatOrder;
    // كل اللاعبين يمرّرون إلا آخر واحد يشتري صن (أبسط سيناريو، بدون دبل، بدون إشكال)
    match.submitBid(order[0], BidChoice.PASS);
    match.submitBid(order[1], BidChoice.PASS);
    match.submitBid(order[2], BidChoice.SUN);
    if (match.phase === "sunDoubling") {
      match.decideSunDouble(match.opponentTeam, false); // الخصم يختار لعب عادي (يبسّط سيناريو الاختبار)
    }
    match.resolveProjects();
    playFullHandAutomatically(match);
    handsPlayed++;
    if (!match.matchOver) match.advanceToNextHand();
  }

  check("المباراة انتهت خلال حد معقول من الأيدي", match.matchOver, true);
  check("فيه فائز محدّد", ["A", "B"].includes(match.matchWinner), true);
  check("رصيد الفائز فعلياً أعلى أو يساوي 152 (أو فاز بقاعدة التعادل)", 
    match.cumulativeScores[match.matchWinner] >= 152 || match.matchEndReason.includes("تعادل"), true);
  console.log(`(انتهت المباراة بعد ${handsPlayed} يد - الفائز ${match.matchWinner} بسبب: ${match.matchEndReason})`);
}

// ===== البلوت: يُحتسب فقط لو أعلن صح بالورقة الأولى من الزوج، قبل رمي الثانية =====
{
  const match = freshMatch();
  const order = match.currentSeatOrder;
  const buyerID = order[0];
  buyHukmAndFinalize(match, buyerID);

  // نضمن المشتري يملك K+Q من الحكم (بدل الاعتماد على حظ التوزيع) - نحقنهم يدوياً بيده
  const trumpSuit = match.trumpSuit;
  const buyerHand = match.hands.get(buyerID);
  buyerHand.push({ id: "test-king", suit: trumpSuit, rank: 13 }, { id: "test-queen", suit: trumpSuit, rank: 12 });
  match._setupBalootEligibility(); // نعيد الفحص بعد الحقن

  match.proceedToPlay();

  const state = match.balootState.get(buyerID);
  check("المشتري مؤهل للبلوت (معه K+Q من الحكم)", state.eligible, true);
  const king = buyerHand.find((c) => c.id === "test-king");
  match.playCard(buyerID, king, true); // يعلن بلوت بالورقة الأولى
  check("أُعلن البلوت بعد الورقة الأولى", match.balootState.get(buyerID).announced, true);
  check("لسه مو مؤكد (لسه ما رمى الثانية)", match.balootState.get(buyerID).confirmed, false);
}

// ===== البلوت: لو ما أعلن بالورقة الأولى، يسقط حقه للأبد حتى لو حاول بالثانية =====
{
  const match = freshMatch();
  const order = match.currentSeatOrder;
  const buyerID = order[0];
  buyHukmAndFinalize(match, buyerID);

  const trumpSuit = match.trumpSuit;
  const buyerHand = match.hands.get(buyerID);
  buyerHand.push({ id: "test-king2", suit: trumpSuit, rank: 13 }, { id: "test-queen2", suit: trumpSuit, rank: 12 });
  match._setupBalootEligibility();

  match.proceedToPlay();

  const king = buyerHand.find((c) => c.id === "test-king2");
  match.playCard(buyerID, king, false); // ما أعلن بالأولى
  check("ما أعلن بالأولى - eligible صار false للأبد", match.balootState.get(buyerID).eligible, false);

  // نتحقق مباشرة من منطق _trackBalootPlay: حتى لو حاول يعلن متأخر بالثانية، ما ينفع
  const queen = buyerHand.find((c) => c.id === "test-queen2");
  match._trackBalootPlay(buyerID, queen, true); // محاكاة مباشرة (تخطي قيد الدور، نختبر منطق البلوت بمعزل)
  check("حتى لو أعلن متأخر بالثانية، confirmed تبقى false (سقط حقه)", match.balootState.get(buyerID).confirmed, false);
}

// ===== إصلاح: projectsResolved يُصفّر بكل يد جديدة - resolveProjects تشتغل باليد الثانية أيضاً، مش أول يد بس =====
{
  const match = freshMatch();
  const order1 = match.currentSeatOrder;
  match.submitBid(order1[0], BidChoice.PASS);
  match.submitBid(order1[1], BidChoice.PASS);
  match.submitBid(order1[2], BidChoice.SUN);
  check("اليد الأولى: projectsResolved يبدأ false", match.projectsResolved, false);
  match.resolveProjects();
  check("اليد الأولى: بعد الاستدعاء يصير true", match.projectsResolved, true);
  playFullHandAutomatically(match);
  match.advanceToNextHand();

  check("اليد الثانية: projectsResolved رجع false تلقائياً (الإصلاح)", match.projectsResolved, false);
  const order2 = match.currentSeatOrder;
  match.submitBid(order2[0], BidChoice.PASS);
  match.submitBid(order2[1], BidChoice.PASS);
  match.submitBid(order2[2], BidChoice.SUN);
  const result2 = match.resolveProjects();
  check("اليد الثانية: resolveProjects تشتغل وترجع نتيجة فعلية", !!result2, true);
  check("اليد الثانية: projectsResolved صار true من جديد", match.projectsResolved, true);
}

// ===== سلسلة "خمسة" (قهوة) الكاملة: تنهي المباراة فوراً بغض النظر عن الرصيد التراكمي (حتى لو صفر) =====
{
  const match = freshMatch();
  const order = match.currentSeatOrder;
  buyHukmAndFinalize(match, order[0]);
  check("رصيد المشتري صفر قبل أي يد", match.cumulativeScores[match.buyerTeam], 0);

  match.requestDouble(match.opponentTeam); // دبل
  match.requestDouble(match.buyerTeam);    // ثري
  match.requestDouble(match.opponentTeam); // فور
  match.requestDouble(match.buyerTeam);    // خمسة (قهوة)
  check("وصلنا لمستوى قهوة", match.doubling.isMatchEndingKahwa, true);

  match.proceedToPlay();
  playFullHandAutomatically(match);

  check("المباراة انتهت فوراً بعد يد واحدة بس", match.matchOver, true);
  check("سبب الانتهاء = قهوة", match.matchEndReason.includes("قهوة"), true);
  check("فيه فائز محدّد رغم إن الرصيد التراكمي كان صفر-صفر قبل اليد", ["A", "B"].includes(match.matchWinner), true);
}

// ===== دبل الصن end-to-end: المشتري ≥100، الخصم <100 - يفتح نافذة قرار وحيد =====
{
  const match = freshMatch();
  const order = match.currentSeatOrder;
  match.cumulativeScores[match.teamOfPlayer(order[2])] = 100; // نضبط رصيد المشتري المستقبلي مسبقاً
  match.submitBid(order[0], BidChoice.PASS);
  match.submitBid(order[1], BidChoice.PASS);
  match.submitBid(order[2], BidChoice.SUN);
  check("شراء الصن مع رصيد المشتري 100+ يفتح نافذة دبل الصن", match.phase, "sunDoubling");
  check("sunDoubling.canOffer() = true", match.sunDoubling.canOffer(), true);

  match.decideSunDouble(match.opponentTeam, true); // الخصم يقرر يدبل
  check("بعد القرار، المرحلة تنتقل للعب مباشرة", match.phase, "playing");
  check("معامل دبل الصن = 2", match.sunDoubling.multiplier, 2);

  playFullHandAutomatically(match);
  check("اليد اكتملت مع دبل الصن الفعّال", match.phase, "handOver");
}

// ===== إصلاح مهم: الشوط المكتمل يبقى ظاهر (completedTrick) - ما ينكسح فوراً، ولعب جديد يُرفض حتى يُكسح صراحة =====
{
  const match = freshMatch();
  const order = match.currentSeatOrder;
  match.submitBid(order[0], BidChoice.PASS);
  match.submitBid(order[1], BidChoice.PASS);
  match.submitBid(order[2], BidChoice.SUN);
  match.resolveProjects();

  // نلعب أول شوط كامل يدوياً (بدون استخدام playFullHandAutomatically عشان نلاحظ اللحظة بالضبط)
  for (let i = 0; i < 4; i++) {
    const playerID = match.turnPlayerID;
    if (match.completedTrick) break; // ما يفترض يصير بعد أقل من 4 ورق
    const hand = match.hands.get(playerID);
    for (const card of [...hand]) {
      try { match.playCard(playerID, card); break; } catch (e) { continue; }
    }
  }

  check("بعد اكتمال أول شوط (4 ورق)، completedTrick معبّى بـ4 عناصر", match.completedTrick?.length, 4);
  check("currentTrick صفر (فُرِّغ فوراً لبدء الشوط الجاي لاحقاً)", match.currentTrick.length, 0);

  const winnerAfterTrick = match.turnPlayerID;
  const hand = match.hands.get(winnerAfterTrick);
  checkThrows("محاولة لعب ورقة جديدة قبل تكسيح الشوط المكتمل تُرفض", () => {
    match.playCard(winnerAfterTrick, hand[0]);
  });

  match.clearCompletedTrick();
  check("بعد التكسيح الصريح، completedTrick يصير null", match.completedTrick, null);

  // الآن اللعب يكمل عادي
  try {
    match.playCard(winnerAfterTrick, match.hands.get(winnerAfterTrick)[0]);
    check("بعد التكسيح، اللعب يستمر بنجاح", true, true);
  } catch (e) {
    check("بعد التكسيح، اللعب يستمر بنجاح - " + e.message, false, true);
  }
}

console.log(`\n— النتيجة: ${pass} ناجح، ${fail} فاشل —`);
process.exit(fail > 0 ? 1 : 0);
