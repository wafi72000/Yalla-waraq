import { scoreHand, PendingPot } from "./js/scoring.js";
import { makeCard, Suit, Rank, cardValue } from "./js/models.js";

let pass = 0, fail = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "✅" : "❌"} ${name} → ${JSON.stringify(actual)} (متوقع: ${JSON.stringify(expected)})`);
  ok ? pass++ : fail++;
}

const teamOfPlayer = (id) => (id === "p1" || id === "p3") ? "A" : "B"; // p1/p3 فريق A، p2/p4 فريق B
const ALL_SUITS = [Suit.HEARTS, Suit.DIAMONDS, Suit.CLUBS, Suit.SPADES];
const ALL_RANKS = [Rank.SEVEN, Rank.EIGHT, Rank.NINE, Rank.TEN, Rank.JACK, Rank.QUEEN, Rank.KING, Rank.ACE];

function fullDeck() {
  const deck = [];
  for (const s of ALL_SUITS) for (const r of ALL_RANKS) deck.push(makeCard(s, r));
  return deck;
}

/// يبحث عن مجموعة فرعية من الأوراق تجمع بالضبط raw معيّن (بحث تراجعي بسيط - 32 ورقة بس، سريع)
/// يضمن دقة رياضية 100% بدل اختيار أوراق يدوياً عرضة للخطأ
function subsetSumming(cards, trumpSuit, target) {
  const values = cards.map((c) => ({ c, v: cardValue(c, trumpSuit) }));
  function rec(i, remaining, chosen) {
    if (remaining === 0) return chosen;
    if (i >= values.length || remaining < 0) return null;
    const withIt = rec(i + 1, remaining - values[i].v, [...chosen, values[i].c]);
    if (withIt) return withIt;
    return rec(i + 1, remaining, chosen);
  }
  return rec(0, target, []);
}

/// يبني tricksWon كاملة (4 أشواط، فريق A ياخذ نصفها وفريق B النصف الثاني) من قائمتي أوراق الفريقين
function buildTricks(teamACards, teamBCards) {
  return [
    { playerID: "p1", cards: teamACards.slice(0, Math.ceil(teamACards.length / 2)) },
    { playerID: "p3", cards: teamACards.slice(Math.ceil(teamACards.length / 2)) },
    { playerID: "p2", cards: teamBCards.slice(0, Math.ceil(teamBCards.length / 2)) },
    { playerID: "p4", cards: teamBCards.slice(Math.ceil(teamBCards.length / 2)) },
  ];
}

/// يبني سيناريو كامل: فريق A ياخذ raw معيّن (قبل آخر أكلة)، فريق B الباقي - آخر أكلة تروح لـlastTrickTeam
function buildScenario(trumpSuit, buyerRawBeforeLastTrick) {
  const deck = fullDeck();
  const buyerCards = subsetSumming(deck, trumpSuit, buyerRawBeforeLastTrick);
  if (!buyerCards) throw new Error(`ما لقيت مجموعة تعطي ${buyerRawBeforeLastTrick}`);
  const ids = new Set(buyerCards.map((c) => c.id));
  const opponentCards = deck.filter((c) => !ids.has(c.id));
  return { buyerCards, opponentCards };
}

// ===== الصن: نجاح واضح (المشتري ياخذ 66 قبل آخر أكلة، +10 = 76 → 8 أبناط ×2 = 16. الخصم: 54 → 5 ×2 = 10) =====
{
  const { buyerCards, opponentCards } = buildScenario(null, 66);
  const result = scoreHand({
    tricksWon: buildTricks(buyerCards, opponentCards), trumpSuit: null, isHukm: false,
    lastTrickWinnerTeam: "A", capotTeam: null, teamOfPlayer,
    buyerTeam: "A", projectPointsByTeam: { A: 0, B: 0 },
  });
  check("صن ناجح: المشتري (A) = 16", result.A, 16);
  check("صن ناجح: الخصم (B) = 10", result.B, 10);
  check("مجموع اليد = 26", result.A + result.B, 26);
  check("ما فيه خسران ولا تعليق", [result.isDefeat, result.isPending], [false, false]);
}

// ===== الصن: خسران (المشتري ياخذ صفر تماماً) - كل الـ26 للخصم =====
{
  const { buyerCards, opponentCards } = buildScenario(null, 0);
  const result = scoreHand({
    tricksWon: buildTricks(buyerCards, opponentCards), trumpSuit: null, isHukm: false,
    lastTrickWinnerTeam: "B", capotTeam: null, teamOfPlayer,
    buyerTeam: "A", projectPointsByTeam: { A: 0, B: 0 },
  });
  check("صن خسران: المشتري (A) = صفر", result.A, 0);
  check("صن خسران: الخصم (B) ياخذ الـ26 كاملة", result.B, 26);
  check("isDefeat = true", result.isDefeat, true);
}

// ===== الصن: تعادل تام (65-65 بنط → 6-6 أبناط بقاعدة التقريب → 12-12 نقطة) - بدون دبل: تعليق =====
{
  const { buyerCards, opponentCards } = buildScenario(null, 55); // A ياخذ آخر أكلة: 55+10=65
  const result = scoreHand({
    tricksWon: buildTricks(buyerCards, opponentCards), trumpSuit: null, isHukm: false,
    lastTrickWinnerTeam: "A", capotTeam: null, teamOfPlayer,
    buyerTeam: "A", projectPointsByTeam: { A: 0, B: 0 }, doubleMultiplier: 1,
  });
  check("تعادل صن 65-65: buyerAbnat=opponentAbnat=6", [result.breakdown.buyerAbnat, result.breakdown.opponentAbnat], [6, 6]);
  check("isPending = true (بدون دبل)", result.isPending, true);
  check("الخصم (B) ياخذ 12 فوراً", result.B, 12);
  check("المشتري (A) صفر الآن، pendingAmount=12", [result.A, result.pendingAmount], [0, 12]);
  check("pendingTeam = A", result.pendingTeam, "A");
}

// ===== الصن: نفس التعادل لكن مع دبل حكم فعّال (doubleMultiplier>1) - خسران فوري على المشتري، بدون تعليق =====
{
  const { buyerCards, opponentCards } = buildScenario(null, 55);
  const result = scoreHand({
    tricksWon: buildTricks(buyerCards, opponentCards), trumpSuit: null, isHukm: false,
    lastTrickWinnerTeam: "A", capotTeam: null, teamOfPlayer,
    buyerTeam: "A", projectPointsByTeam: { A: 0, B: 0 }, doubleMultiplier: 2,
  });
  check("تعادل + دبل فعّال = خسران فوري (مش تعليق)", [result.isPending, result.isDefeat], [false, true]);
  check("المشتري صفر، الخصم ياخذ كل شي (26×2=52)", [result.A, result.B], [0, 52]);
}

// ===== الحكم: نجاح واضح (المشتري 86+10=96 → 10 أبناط. الخصم 66 → 7. المجموع 17) =====
{
  const trumpSuit = Suit.HEARTS;
  const { buyerCards, opponentCards } = buildScenario(trumpSuit, 86);
  const result = scoreHand({
    tricksWon: buildTricks(buyerCards, opponentCards), trumpSuit, isHukm: true,
    lastTrickWinnerTeam: "A", capotTeam: null, teamOfPlayer,
    buyerTeam: "A", projectPointsByTeam: { A: 0, B: 0 },
  });
  check("حكم ناجح: المشتري (A) = 10", result.A, 10);
  check("حكم ناجح: الخصم (B) = 7", result.B, 7);
  check("مجموع 17 (بسبب تقريب مستقل بكل فريق)", result.A + result.B, 17);
}

// ===== الحكم: خسران (المشتري صفر تماماً) - كل الـ16 للخصم =====
{
  const trumpSuit = Suit.HEARTS;
  const { buyerCards, opponentCards } = buildScenario(trumpSuit, 0);
  const result = scoreHand({
    tricksWon: buildTricks(buyerCards, opponentCards), trumpSuit, isHukm: true,
    lastTrickWinnerTeam: "B", capotTeam: null, teamOfPlayer,
    buyerTeam: "A", projectPointsByTeam: { A: 0, B: 0 },
  });
  check("حكم خسران: المشتري (A) = صفر", result.A, 0);
  check("حكم خسران: الخصم (B) = 16 كاملة", result.B, 16);
  check("isDefeat = true", result.isDefeat, true);
}

// ===== الحكم: تعادل تام (المشتري ياخذ آخر أكلة: 71+10=81. الخصم: 81) - بدون دبل: تعليق =====
{
  const trumpSuit = Suit.HEARTS;
  const { buyerCards, opponentCards } = buildScenario(trumpSuit, 71);
  const result = scoreHand({
    tricksWon: buildTricks(buyerCards, opponentCards), trumpSuit, isHukm: true,
    lastTrickWinnerTeam: "A", capotTeam: null, teamOfPlayer,
    buyerTeam: "A", projectPointsByTeam: { A: 0, B: 0 }, doubleMultiplier: 1,
  });
  check("تعادل حكم 81-81: كلاهما 8 أبناط", [result.breakdown.buyerAbnat, result.breakdown.opponentAbnat], [8, 8]);
  check("isPending = true (بدون دبل)", result.isPending, true);
  check("الخصم (B) ياخذ 8 فوراً، المشتري معلّق 8", [result.B, result.A, result.pendingAmount], [8, 0, 8]);
}

// ===== الحكم: نفس التعادل مع دبل فعّال - خسران فوري (بدون تعليق) =====
{
  const trumpSuit = Suit.HEARTS;
  const { buyerCards, opponentCards } = buildScenario(trumpSuit, 71);
  const result = scoreHand({
    tricksWon: buildTricks(buyerCards, opponentCards), trumpSuit, isHukm: true,
    lastTrickWinnerTeam: "A", capotTeam: null, teamOfPlayer,
    buyerTeam: "A", projectPointsByTeam: { A: 0, B: 0 }, doubleMultiplier: 2,
  });
  check("تعادل حكم + دبل = خسران فوري", [result.isPending, result.isDefeat], [false, true]);
  check("الخصم ياخذ كل شي (16×2=32)، المشتري صفر", [result.B, result.A], [32, 0]);
}

// ===== الدبل لا يقبل القسمة: نجاح واضح بالحكم مع دبل فعّال (×2) = المشتري ياخذ كل شي، الخصم صفر (بدل التقاسم النسبي) =====
{
  const trumpSuit = Suit.HEARTS;
  const { buyerCards, opponentCards } = buildScenario(trumpSuit, 86); // نفس مثال النجاح (10 مقابل 7 بدون دبل)
  const result = scoreHand({
    tricksWon: buildTricks(buyerCards, opponentCards), trumpSuit, isHukm: true,
    lastTrickWinnerTeam: "A", capotTeam: null, teamOfPlayer,
    buyerTeam: "A", projectPointsByTeam: { A: 2, B: 0 }, doubleMultiplier: 3,
  });
  check("نجاح + دبل فعّال: المشتري ياخذ كل شي بدون تقاسم = (16+2)×3=54", result.A, 54);
  check("الخصم صفر رغم إنه كان بياخذ نصيبه لو ما فيه دبل", result.B, 0);
}

// ===== مشاريع الصن تُضاف بعد تحديد النجاح (مثال: نجاح 76→16 + مشروع سرا 4 = 20) =====
{
  const { buyerCards, opponentCards } = buildScenario(null, 66);
  const result = scoreHand({
    tricksWon: buildTricks(buyerCards, opponentCards), trumpSuit: null, isHukm: false,
    lastTrickWinnerTeam: "A", capotTeam: null, teamOfPlayer,
    buyerTeam: "A", projectPointsByTeam: { A: 4, B: 0 },
  });
  check("صن + مشروع سرا (4): المشتري = 20 (16+4)", result.A, 20);
  check("الخصم بدون مشروع = 10 (بدون تغيير)", result.B, 10);
}

// ===== مشاريع الحكم عند الخسران: تروح كاملة للخصم (مشروع الفريقين مع بعض) =====
{
  const trumpSuit = Suit.HEARTS;
  const { buyerCards, opponentCards } = buildScenario(trumpSuit, 60); // خسران واضح (60 ما يتجاوز نص الـ16)
  const result = scoreHand({
    tricksWon: buildTricks(buyerCards, opponentCards), trumpSuit, isHukm: true,
    lastTrickWinnerTeam: "B", capotTeam: null, teamOfPlayer,
    buyerTeam: "A", projectPointsByTeam: { A: 2, B: 5 },
  });
  check("خسران: كل المشاريع (2+5) + الـ16 تروح للخصم = 23", result.B, 23);
  check("المشتري صفر رغم مشروعه الخاص", result.A, 0);
}

// ===== الكابوت بالصن: 44 نقطة للفائز، صفر للخصم =====
{
  const result = scoreHand({
    tricksWon: [], trumpSuit: null, isHukm: false,
    lastTrickWinnerTeam: "A", capotTeam: "A", teamOfPlayer,
    buyerTeam: "A", projectPointsByTeam: { A: 0, B: 0 },
  });
  check("كابوت صن: الفائز = 44", result.A, 44);
  check("كابوت: الخصم = صفر", result.B, 0);
  check("isCapot = true", result.isCapot, true);
}

// ===== الكابوت بالحكم: 25 + مشاريع =====
{
  const result = scoreHand({
    tricksWon: [], trumpSuit: Suit.HEARTS, isHukm: true,
    lastTrickWinnerTeam: "A", capotTeam: "A", teamOfPlayer,
    buyerTeam: "A", projectPointsByTeam: { A: 40, B: 0 },
  });
  check("كابوت حكم + مشاريع: 25+40=65", result.A, 65);
}

// ===== الكابوت مع الدبل: (كابوت+مشاريع) × معامل =====
{
  const result = scoreHand({
    tricksWon: [], trumpSuit: Suit.HEARTS, isHukm: true,
    lastTrickWinnerTeam: "A", capotTeam: "A", teamOfPlayer,
    buyerTeam: "A", projectPointsByTeam: { A: 2, B: 0 }, doubleMultiplier: 2,
  });
  check("كابوت حكم مضاعف: (25+2)×2=54", result.A, 54);
}

// ===== البلوت محمي حتى مع الكابوت ضد صاحبه =====
{
  const result = scoreHand({
    tricksWon: [], trumpSuit: Suit.HEARTS, isHukm: true,
    lastTrickWinnerTeam: "A", capotTeam: "A", teamOfPlayer,
    buyerTeam: "A", projectPointsByTeam: { A: 0, B: 0 },
    balootPointsByTeam: { A: 0, B: 2 },
  });
  check("كابوت لصالح A: A = 25 (بدون بلوت)", result.A, 25);
  check("B خسر كل شي بس يحتفظ ببلوت (2) رغم الكابوت ضده", result.B, 2);
}

// ===== الحصالة المعلّقة: تتراكم عبر أيدي متعددة، وتُطلق باليد الحاسمة =====
{
  const pot = new PendingPot();
  const released1 = pot.applyHandResult({ isPending: true, pendingAmount: 12, pendingTeam: "A" });
  check("يد أولى معلّقة: لا إطلاق بعد", released1, 0);
  check("الحصالة = 12", pot.amount, 12);

  const released2 = pot.applyHandResult({ isPending: true, pendingAmount: 12, pendingTeam: "A" });
  check("يد ثانية معلّقة أيضاً: تتراكم لـ24", pot.amount, 24);
  check("لا إطلاق بعد", released2, 0);

  const released3 = pot.applyHandResult({ isPending: false });
  check("يد ثالثة حاسمة: تُطلق الحصالة كاملة (24)", released3, 24);
  check("الحصالة تصفر بعد الإطلاق", pot.amount, 0);
}

// ===== breakdown: يظهر بالتفاصيل الصحيحة (buyerAbnat/opponentAbnat بدل roundedCardPoints القديمة) =====
{
  const { buyerCards, opponentCards } = buildScenario(null, 66);
  const result = scoreHand({
    tricksWon: buildTricks(buyerCards, opponentCards), trumpSuit: null, isHukm: false,
    lastTrickWinnerTeam: "A", capotTeam: null, teamOfPlayer,
    buyerTeam: "A", projectPointsByTeam: { A: 50, B: 0 },
  });
  check("breakdown.cardPointsRaw صحيحة (66 لفريق A، 54 لفريق B)", result.breakdown.cardPointsRaw, { A: 66, B: 54 });
  check("breakdown.lastTrickTeam = A", result.breakdown.lastTrickTeam, "A");
  check("breakdown.lastTrickBonus = 10 (نفس القيمة بالنظامين)", result.breakdown.lastTrickBonus, 10);
  check("breakdown.projectPointsByTeam يعكس المشروع المُمرَّر", result.breakdown.projectPointsByTeam, { A: 50, B: 0 });
  check("breakdown.buyerAbnat/opponentAbnat موجودة (8، 5)", [result.breakdown.buyerAbnat, result.breakdown.opponentAbnat], [8, 5]);
}

// ===== breakdown بحالة الكابوت =====
{
  const result = scoreHand({
    tricksWon: [], trumpSuit: Suit.HEARTS, isHukm: true,
    lastTrickWinnerTeam: "A", capotTeam: "A", teamOfPlayer,
    buyerTeam: "A", projectPointsByTeam: { A: 0, B: 0 },
  });
  check("breakdown.capotTeam يطابق الفريق الكابوت", result.breakdown.capotTeam, "A");
  check("breakdown.capotBasePoints يطابق قيمة الكابوت بالحكم (25)", result.breakdown.capotBasePoints, 25);
  check("breakdown.cardPointsRaw موجودة حتى بالكابوت", typeof result.breakdown.cardPointsRaw, "object");
}

console.log(`\n— النتيجة: ${pass} ناجح، ${fail} فاشل —`);
process.exit(fail > 0 ? 1 : 0);
