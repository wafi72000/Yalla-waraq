import { scoreHand } from "./js/scoring.js";
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
  check("ما فيه خسران", result.isDefeat, false);
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

// ===== الصن: تعادل تام (65-65 بنط → 6-6 أبناط) بدون دبل - يتقاسمون فوراً، بدون أي تأجيل =====
{
  const { buyerCards, opponentCards } = buildScenario(null, 55); // A ياخذ آخر أكلة: 55+10=65
  const result = scoreHand({
    tricksWon: buildTricks(buyerCards, opponentCards), trumpSuit: null, isHukm: false,
    lastTrickWinnerTeam: "A", capotTeam: null, teamOfPlayer,
    buyerTeam: "A", projectPointsByTeam: { A: 0, B: 0 },
  });
  check("تعادل صن 65-65: buyerAbnat=opponentAbnat=6", [result.breakdown.buyerAbnat, result.breakdown.opponentAbnat], [6, 6]);
  check("يتقاسمون فوراً: كلاهما 12 (6×2)", [result.A, result.B], [12, 12]);
  check("ما فيه خسران", result.isDefeat, false);
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

// ===== الحكم: تعادل تام (81-81) بدون دبل - يتقاسمون فوراً (8-8)، بدون أي تأجيل =====
{
  const trumpSuit = Suit.HEARTS;
  const { buyerCards, opponentCards } = buildScenario(trumpSuit, 71);
  const result = scoreHand({
    tricksWon: buildTricks(buyerCards, opponentCards), trumpSuit, isHukm: true,
    lastTrickWinnerTeam: "A", capotTeam: null, teamOfPlayer,
    buyerTeam: "A", projectPointsByTeam: { A: 0, B: 0 },
  });
  check("تعادل حكم 81-81: كلاهما 8 أبناط", [result.breakdown.buyerAbnat, result.breakdown.opponentAbnat], [8, 8]);
  check("يتقاسمون فوراً: كلاهما 8", [result.A, result.B], [8, 8]);
  check("ما فيه خسران", result.isDefeat, false);
}

// ===== دبل فعّال - الأبناط (مع المشاريع) تحدد الفائز مباشرة، ياخذ كل شي، بدون تقاسم =====

// حالة 1: صن دبل - المشتري 64 بنط، الخصم 66 بنط → المشتري خسران، الخصم ياخذ 52 (26×2)
{
  const { buyerCards, opponentCards } = buildScenario(null, 54); // 54+10=64
  const result = scoreHand({
    tricksWon: buildTricks(buyerCards, opponentCards), trumpSuit: null, isHukm: false,
    lastTrickWinnerTeam: "A", capotTeam: null, teamOfPlayer,
    buyerTeam: "A", projectPointsByTeam: { A: 0, B: 0 }, doubleMultiplier: 2,
  });
  check("صن دبل، المشتري أقل (64 مقابل 66): خسران، الخصم=52", [result.A, result.B, result.isDefeat], [0, 52, true]);
}

// حالة 2: صن دبل - المشتري 66 بنط، الخصم 64 بنط → المشتري فايز، ياخذ 52 كاملة
{
  const { buyerCards, opponentCards } = buildScenario(null, 56); // 56+10=66
  const result = scoreHand({
    tricksWon: buildTricks(buyerCards, opponentCards), trumpSuit: null, isHukm: false,
    lastTrickWinnerTeam: "A", capotTeam: null, teamOfPlayer,
    buyerTeam: "A", projectPointsByTeam: { A: 0, B: 0 }, doubleMultiplier: 2,
  });
  check("صن دبل، المشتري أكثر (66 مقابل 64): فايز، ياخذ 52 كاملة", [result.A, result.B, result.isDefeat], [52, 0, false]);
}

// حالة 3: صن دبل - المشتري 56 بنط (أقل بالورق وحده)، لكن مشروع سرا (4) يقلب النتيجة لصالحه تحت الدبل
{
  const { buyerCards, opponentCards } = buildScenario(null, 46); // 46+10=56
  const result = scoreHand({
    tricksWon: buildTricks(buyerCards, opponentCards), trumpSuit: null, isHukm: false,
    lastTrickWinnerTeam: "A", capotTeam: null, teamOfPlayer,
    buyerTeam: "A", projectPointsByTeam: { A: 2, B: 0 }, doubleMultiplier: 2,
  });
  check("صن دبل + مشروع يقلب النتيجة: المشتري فايز، ياخذ 60 ((26+4)×2)", [result.A, result.B, result.isDefeat], [60, 0, false]);
}

// حالة 4: حكم دبل - نجاح واضح بدون دبل يصير تقاسم (10/7)، مع دبل يكسح المشتري كل شي
{
  const trumpSuit = Suit.HEARTS;
  const { buyerCards, opponentCards } = buildScenario(trumpSuit, 86);
  const result = scoreHand({
    tricksWon: buildTricks(buyerCards, opponentCards), trumpSuit, isHukm: true,
    lastTrickWinnerTeam: "A", capotTeam: null, teamOfPlayer,
    buyerTeam: "A", projectPointsByTeam: { A: 2, B: 0 }, doubleMultiplier: 3,
  });
  check("حكم دبل ×3: المشتري ياخذ كل شي بدون تقاسم = (16+2)×3=54", [result.A, result.B], [54, 0]);
}

// حالة 5: حكم دبل - تعادل بالورق (81-81) بدون مشاريع → المجموع الشامل يتساوى أيضاً → خسران فوري على المشتري
{
  const trumpSuit = Suit.HEARTS;
  const { buyerCards, opponentCards } = buildScenario(trumpSuit, 71);
  const result = scoreHand({
    tricksWon: buildTricks(buyerCards, opponentCards), trumpSuit, isHukm: true,
    lastTrickWinnerTeam: "A", capotTeam: null, teamOfPlayer,
    buyerTeam: "A", projectPointsByTeam: { A: 0, B: 0 }, doubleMultiplier: 2,
  });
  check("حكم دبل، تعادل شامل: خسران فوري، الخصم ياخذ كل شي (16×2=32)", [result.A, result.B, result.isDefeat], [0, 32, true]);
}

// ===== مشاريع الصن (بدون دبل) تُضاف بعد تحديد الفائز (مثال: نجاح 76→16 + مشروع سرا 4 = 20) =====
{
  const { buyerCards, opponentCards } = buildScenario(null, 66);
  const result = scoreHand({
    tricksWon: buildTricks(buyerCards, opponentCards), trumpSuit: null, isHukm: false,
    lastTrickWinnerTeam: "A", capotTeam: null, teamOfPlayer,
    buyerTeam: "A", projectPointsByTeam: { A: 2, B: 0 },
  });
  check("صن + مشروع سرا (2×2=4): المشتري = 20 (16+4)", result.A, 20);
  check("الخصم بدون مشروع = 10 (بدون تغيير)", result.B, 10);
}

// ===== مشاريع الحكم عند الخسران (بدون دبل): تروح كاملة للخصم (مشروع الفريقين مع بعض) =====
{
  const trumpSuit = Suit.HEARTS;
  const { buyerCards, opponentCards } = buildScenario(trumpSuit, 60); // خسران واضح
  const result = scoreHand({
    tricksWon: buildTricks(buyerCards, opponentCards), trumpSuit, isHukm: true,
    lastTrickWinnerTeam: "B", capotTeam: null, teamOfPlayer,
    buyerTeam: "A", projectPointsByTeam: { A: 2, B: 5 },
  });
  check("خسران: كل المشاريع (2+5) + الـ16 تروح للخصم = 23", result.B, 23);
  check("المشتري صفر رغم مشروعه الخاص", result.A, 0);
}

// ===== الكبوت بالصن: 44 نقطة للفائز، صفر للخصم =====
{
  const result = scoreHand({
    tricksWon: [], trumpSuit: null, isHukm: false,
    lastTrickWinnerTeam: "A", capotTeam: "A", teamOfPlayer,
    buyerTeam: "A", projectPointsByTeam: { A: 0, B: 0 },
  });
  check("كبوت صن: الفائز = 44", result.A, 44);
  check("كبوت: الخصم = صفر", result.B, 0);
  check("isCapot = true", result.isCapot, true);
}

// ===== الكبوت بالصن + مشروع: مضاعفة الصن التلقائية تنطبق على المشروع بهذا الفرع كمان =====
{
  const result = scoreHand({
    tricksWon: [], trumpSuit: null, isHukm: false,
    lastTrickWinnerTeam: "A", capotTeam: "A", teamOfPlayer,
    buyerTeam: "A", projectPointsByTeam: { A: 2, B: 0 }, // مشروع سرا (2 أبناط أساسية)
  });
  check("كبوت صن + مشروع سرا: 44+(2×2)=48 (المضاعفة التلقائية تنطبق هنا كمان)", result.A, 48);
}

// ===== الكبوت بالحكم: 25 + مشاريع =====
{
  const result = scoreHand({
    tricksWon: [], trumpSuit: Suit.HEARTS, isHukm: true,
    lastTrickWinnerTeam: "A", capotTeam: "A", teamOfPlayer,
    buyerTeam: "A", projectPointsByTeam: { A: 10, B: 0 }, // مشروع مية (10 أبناط)
  });
  check("كبوت حكم + مشروع مية: 25+10=35", result.A, 35);
}

// ===== الكبوت مع الدبل: (كبوت+مشاريع) × معامل =====
{
  const result = scoreHand({
    tricksWon: [], trumpSuit: Suit.HEARTS, isHukm: true,
    lastTrickWinnerTeam: "A", capotTeam: "A", teamOfPlayer,
    buyerTeam: "A", projectPointsByTeam: { A: 2, B: 0 }, doubleMultiplier: 2,
  });
  check("كبوت حكم مضاعف: (25+2)×2=54", result.A, 54);
}

// ===== البلوت محمي حتى مع الكبوت ضد صاحبه =====
{
  const result = scoreHand({
    tricksWon: [], trumpSuit: Suit.HEARTS, isHukm: true,
    lastTrickWinnerTeam: "A", capotTeam: "A", teamOfPlayer,
    buyerTeam: "A", projectPointsByTeam: { A: 0, B: 0 },
    balootPointsByTeam: { A: 0, B: 2 },
  });
  check("كبوت لصالح A: A = 25 (بدون بلوت)", result.A, 25);
  check("B خسر كل شي بس يحتفظ ببلوت (2) رغم الكبوت ضده", result.B, 2);
}

// ===== الأربعمية: قيمتها النهائية 40 ثابتة - استثناء من مضاعفة الصن التلقائية (بقية المشاريع تتضاعف، هي لا) =====
{
  const { buyerCards, opponentCards } = buildScenario(null, 66);
  const result = scoreHand({
    tricksWon: buildTricks(buyerCards, opponentCards), trumpSuit: null, isHukm: false,
    lastTrickWinnerTeam: "A", capotTeam: null, teamOfPlayer,
    buyerTeam: "A", projectPointsByTeam: { A: 20, B: 0 }, // قيمة projectPointsOf(أربعمية) = 20
  });
  check("أربعمية: المشتري = 56 (16+40، مو 16+80)", result.A, 56);
}

// ===== breakdown: يظهر بالتفاصيل الصحيحة =====
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

// ===== breakdown بحالة الكبوت =====
{
  const result = scoreHand({
    tricksWon: [], trumpSuit: Suit.HEARTS, isHukm: true,
    lastTrickWinnerTeam: "A", capotTeam: "A", teamOfPlayer,
    buyerTeam: "A", projectPointsByTeam: { A: 0, B: 0 },
  });
  check("breakdown.capotTeam يطابق الفريق الكبوت", result.breakdown.capotTeam, "A");
  check("breakdown.capotBasePoints يطابق قيمة الكبوت بالحكم (25)", result.breakdown.capotBasePoints, 25);
  check("breakdown.cardPointsRaw موجودة حتى بالكبوت", typeof result.breakdown.cardPointsRaw, "object");
}

// ===== تصحيح مهم: المقارنة بالخام مباشرة تمنع "منطقة تعادل مصطنعة" من التقريب =====
// (80 و82 كلاهما يقرّب لنفس الأبناط (8) - بالتقريب فقط كانا يطلعان تعادل غلط، والصح: 80=خسران واضح، 82=نجاح واضح)

// حكم: 80 خام (أقل بواحد من النص 81) = خسران حقيقي، مو تعادل
{
  const trumpSuit = Suit.HEARTS;
  const { buyerCards, opponentCards } = buildScenario(trumpSuit, 80);
  const result = scoreHand({
    tricksWon: buildTricks(buyerCards, opponentCards), trumpSuit, isHukm: true,
    lastTrickWinnerTeam: "B", capotTeam: null, teamOfPlayer,
    buyerTeam: "A", projectPointsByTeam: { A: 0, B: 0 },
  });
  check("حكم 80 خام (تحت النص بواحد): خسران حقيقي مو تعادل", [result.A, result.B, result.isDefeat], [0, 16, true]);
}

// حكم: 82 خام (أكثر بواحد من النص 81) = نجاح حقيقي، مو تعادل
{
  const trumpSuit = Suit.HEARTS;
  const { buyerCards, opponentCards } = buildScenario(trumpSuit, 82);
  const result = scoreHand({
    tricksWon: buildTricks(buyerCards, opponentCards), trumpSuit, isHukm: true,
    lastTrickWinnerTeam: "B", capotTeam: null, teamOfPlayer,
    buyerTeam: "A", projectPointsByTeam: { A: 0, B: 0 },
  });
  check("حكم 82 خام (فوق النص بواحد): نجاح حقيقي، ما يُعامل كخسران", result.isDefeat, false);
}

// صن: 64 خام (أقل بواحد من النص 65) = خسران حقيقي
{
  const { buyerCards, opponentCards } = buildScenario(null, 64);
  const result = scoreHand({
    tricksWon: buildTricks(buyerCards, opponentCards), trumpSuit: null, isHukm: false,
    lastTrickWinnerTeam: "B", capotTeam: null, teamOfPlayer,
    buyerTeam: "A", projectPointsByTeam: { A: 0, B: 0 },
  });
  check("صن 64 خام (تحت النص بواحد): خسران حقيقي مو تعادل", [result.A, result.B, result.isDefeat], [0, 26, true]);
}

// صن: 66 خام (أكثر بواحد من النص 65) = نجاح حقيقي
{
  const { buyerCards, opponentCards } = buildScenario(null, 66);
  const result = scoreHand({
    tricksWon: buildTricks(buyerCards, opponentCards), trumpSuit: null, isHukm: false,
    lastTrickWinnerTeam: "B", capotTeam: null, teamOfPlayer,
    buyerTeam: "A", projectPointsByTeam: { A: 0, B: 0 },
  });
  check("صن 66 خام (فوق النص بواحد): نجاح حقيقي، ما يُعامل كخسران", result.isDefeat, false);
}

console.log(`\n— النتيجة: ${pass} ناجح، ${fail} فاشل —`);
process.exit(fail > 0 ? 1 : 0);
