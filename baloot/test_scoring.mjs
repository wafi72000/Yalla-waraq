import { scoreHand, PendingPot } from "./js/scoring.js";
import { makeCard, Suit, Rank } from "./js/models.js";

let pass = 0, fail = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "✅" : "❌"} ${name} → ${JSON.stringify(actual)} (متوقع: ${JSON.stringify(expected)})`);
  ok ? pass++ : fail++;
}

const teamOfPlayer = (id) => (id === "p1" || id === "p3") ? "A" : "B"; // p1/p3 فريق A، p2/p4 فريق B

function trickOf(playerID, cards) { return { playerID, cards }; }

// ===== يد صن عادية: المشتري (A) ينجح بأغلبية واضحة (لازم أكثر من نصف الـ26 = 13+) =====
{
  // فريق A ياخذ كل الآسات والعشرات (أعلى قيمة): 4 آسات(44) + 4 عشرات(40) = 84 خام + لو أخذ آخر أكلة (25) = 109 → 109/10=10.9→11 (لسه أقل من 13!)
  // نحتاج فريق A ياخذ كمية أكبر بوضوح - نعطيه كل الأوراق ذات القيمة (32 ورقة كلها قيمتها 120)، ونعطي B فقط أوراق الصفر
  const highValueCards = [Rank.ACE, Rank.TEN, Rank.KING, Rank.QUEEN, Rank.JACK].flatMap((r) =>
    [Suit.HEARTS, Suit.DIAMONDS, Suit.CLUBS, Suit.SPADES].map((s) => makeCard(s, r))
  ); // 20 ورقة، كل القيمة (120) بالكامل
  const zeroCards = [Rank.NINE, Rank.EIGHT, Rank.SEVEN].flatMap((r) =>
    [Suit.HEARTS, Suit.DIAMONDS, Suit.CLUBS, Suit.SPADES].map((s) => makeCard(s, r))
  ); // 12 ورقة، قيمتها صفر بالكامل

  const tricksWon = [
    trickOf("p1", highValueCards.slice(0, 10)), // فريق A ياخذ كل الـ120 نقطة
    trickOf("p3", highValueCards.slice(10, 20)),
    trickOf("p2", zeroCards.slice(0, 6)), // فريق B ياخذ صفر
    trickOf("p4", zeroCards.slice(6, 12)),
  ];

  const result = scoreHand({
    tricksWon, trumpSuit: null, isHukm: false,
    lastTrickWinnerTeam: "A", capotTeam: null, teamOfPlayer,
    buyerTeam: "A", projectPointsByTeam: { A: 0, B: 0 },
  });
  // A: 120+25=145 راو → 145/10=14.5→15 (كل الـ26... بس فعلياً 15>13 فينجح). B: 0
  check("فريق A (المشتري) ينجح - نقاطه أعلى من النصف (13)", result.A > 13, true);
  check("ما فيه خسف", result.isDefeat, false);
  check("ما فيه تعليق", result.isPending, false);
}

// ===== خسف: المشتري ما يحقق الأغلبية =====
{
  const strongCards = [Rank.ACE, Rank.TEN, Rank.KING, Rank.QUEEN].flatMap((r) =>
    [Suit.HEARTS, Suit.DIAMONDS].map((s) => makeCard(s, r))
  );
  const weakCards = [Rank.NINE, Rank.EIGHT, Rank.SEVEN, Rank.JACK].flatMap((r) =>
    [Suit.CLUBS, Suit.SPADES].map((s) => makeCard(s, r))
  );
  const tricksWon = [
    trickOf("p1", weakCards.slice(0, 4)), // A (المشتري) ياخذ الضعيف
    trickOf("p3", weakCards.slice(4, 8)),
    trickOf("p2", strongCards.slice(0, 4)), // B (الخصم) ياخذ القوي
    trickOf("p4", strongCards.slice(4, 8)),
  ];
  const result = scoreHand({
    tricksWon, trumpSuit: null, isHukm: false,
    lastTrickWinnerTeam: "B", capotTeam: null, teamOfPlayer,
    buyerTeam: "A", projectPointsByTeam: { A: 0, B: 0 },
  });
  check("خسف: المشتري (A) يسجّل صفر", result.A, 0);
  check("خسف: الخصم (B) ياخذ كل نقاط اليد (26 بالصن)", result.B, 26);
  check("isDefeat = true", result.isDefeat, true);
}

// ===== تعادل تام (13-13 بالصن) - المشتري يُعلّق، الخصم ياخذ فوراً =====
{
  // نبني يد متعادلة يدوياً: كل فريق ياخذ نصف القيمة بالضبط
  // القيمة الكلية 120 (بدون آخر أكلة)، +25 آخر أكلة = 145. لتعادل تام نحتاج توزيع دقيق - نبسّط بمحاكاة القيم مباشرة
  // نصنع 4 أوراق لكل فريق تجمع بالضبط نفس القيمة
  const teamACards = [makeCard(Suit.HEARTS, Rank.ACE), makeCard(Suit.HEARTS, Rank.TEN)]; // 11+10=21
  const teamBCards = [makeCard(Suit.CLUBS, Rank.ACE), makeCard(Suit.CLUBS, Rank.TEN)]; // 11+10=21
  const tricksWon = [trickOf("p1", teamACards), trickOf("p2", teamBCards)];
  // آخر أكلة تروح لفريق B (يضيف 25) بينما A بدون - نحتاج تعادل تام بعد الجمع
  // 21(A) vs 21+25=46(B) غير متعادل - نعدّل: نخلي آخر أكلة تجعلهم متعادلين فعلاً بدل الحسابات المعقدة
  // الأبسط: نتحقق فقط أن دالة التعادل تشتغل صح بمدخلات مضبوطة يدوياً - نستخدم قيم صافية بسيطة بدل محاكاة توزيع حقيقي
}

// ===== نتحقق من التعادل مباشرة بمدخلات مبسّطة (Direct payload) =====
{
  // نمرّر tricksWon تعطي بالضبط 13-13 بعد التقريب: نحتاج raw points متساوية تماماً قبل القسمة
  // 65 لكل فريق (65/10=6.5 يقرب 7 أو 6...) - نستخدم بدل هذا قيم تعطي بالضبط تعادل عشري نظيف
  // الأبسط تقنياً: نمرر مباشرة toolCards تحقق raw=130 لكل فريق (13 بعد القسمة على 10) - المجموع 260 يتجاوز 145، فهذا غير واقعي فعلياً باللعبة
  // الحل: نغيّر الاختبار ليعتمد على منطق مباشر لمقارنة roundedA===roundedB بدل بناء يد فعلية معقدة
}

console.log("(اختبارات مباشرة أدق تحت)");

// ===== دالة مساعدة لبناء سيناريو تعادل بسيط دقيق: 2 ورقة فقط لكل فريق، بدون مشاريع، ندوّر آخر أكلة =====
function buildTiedSunScenario() {
  // فريق A: آس + عشرة = 21. فريق B: شايب + بنت + ولد + آس(آخر) - نبسّط: نجعل كل يد فيها 4 أوراق فقط (تجربة اصطناعية للدالة، مو 8 كاملة)
  const teamACards = [makeCard(Suit.HEARTS, Rank.ACE)]; // 11
  const teamBCards = [makeCard(Suit.CLUBS, Rank.KING), makeCard(Suit.CLUBS, Rank.SEVEN)]; // 4+0=4 ... مو متعادل، نصلحها يدوياً بالأسفل
  return { teamACards, teamBCards };
}
// بدل تعقيد بناء يد حقيقية متعادلة، نتحقق من سلوك scoreHand مباشرة بحقن نتائج تقارن roundedA/roundedB يدوياً عبر tricksWon مضبوطة:
{
  // نبني 4 أوراق فقط، القيمة الكلية معروفة: Q(3)+Q(3) لفريق A = 6، K(4)+نفس آخر أكلة تضاف لاحقاً... نحتاج توازن ما بعد آخر أكلة أيضاً
  // الأسهل: نمرر لاست تريك وينر يعادل الفارق، بحيث raw متساوية فعلياً
  const teamACards = [makeCard(Suit.SPADES, Rank.KING)]; // 4
  const teamBCards = [makeCard(Suit.DIAMONDS, Rank.KING)]; // 4 (متساوية قبل آخر أكلة! لكن آخر أكلة تكسر التعادل حسب مين ياخذها)
  // بما إن آخر أكلة (25 بالصن) تُضاف لفريق واحد فقط، ما راح تتعادل النتيجة إلا لو ما فيه آخر أكلة تُحتسب - وهذا مستحيل فعلياً
  // لأغراض اختبار الدالة نفسها (منطق التعادل)، نستخدم قيم raw مباشرة بدل محاكاة توزيع ورق حقيقي: نضيف اختبار منفصل يفحص فرع الكود مباشرة
}

// اختبار مباشر: نبني حالة تُنتج roundedA===roundedB يدوياً بضبط القيم (كل الأشواط لفريق واحد فقط + آخر أكلة لنفس الفريق يخلي فريق التاني صفر تماماً - غير مفيد لاختبار تعادل)
// الحل العملي: نصمم توزيع أوراق يعطي بالضبط نفس القيمة الصافية شاملة آخر أكلة لكلا الفريقين
{
  // فريق A ياخذ آخر أكلة (25) + أوراق قيمتها صافي منخفضة = نحتاج مجموع فريق A == مجموع فريق B
  // فريق B بدون آخر أكلة، لازم يعوّض بأوراق أعلى قيمة بمقدار 25
  // فريق A: يأخذ Q+Q (3+3=6) + آخر أكلة (25) = 31
  // فريق B: يحتاج 31 أيضاً - K+K+10+A = 4+4+10+11=29 قريب، نضبطها: A+A=11+11=22 + K+K=4+4=8 => 30... نجرب J+A+A+10=2+11+11+10=34
  // الأدق: نحسب المطلوب فريق B=31 بالضبط: A(11)+10(10)+K(4)+K(4)+Q... نستخدم A+10+Q+Q+K = 11+10+3+3+4=31 (5 ورق)
  const teamACards = [makeCard(Suit.HEARTS, Rank.QUEEN), makeCard(Suit.DIAMONDS, Rank.QUEEN)]; // 3+3=6, +25 آخر أكلة = 31
  const teamBCards = [
    makeCard(Suit.CLUBS, Rank.ACE), makeCard(Suit.CLUBS, Rank.TEN), makeCard(Suit.SPADES, Rank.QUEEN),
    makeCard(Suit.SPADES, Rank.KING), makeCard(Suit.SPADES, Rank.NINE), // 11+10+3+4+0=28... نعدّل نطلع 31 بالضبط
  ];
  // 11+10+3+4=28 - نحتاج 31: نضيف ورقة قيمتها 3 بدل التسعة
  const teamBCardsFixed = [
    makeCard(Suit.CLUBS, Rank.ACE), makeCard(Suit.CLUBS, Rank.TEN),
    makeCard(Suit.SPADES, Rank.QUEEN), makeCard(Suit.SPADES, Rank.KING), makeCard(Suit.CLUBS, Rank.QUEEN),
  ]; // 11+10+3+4+3=31 ✓

  const tricksWon = [trickOf("p1", teamACards), trickOf("p2", teamBCardsFixed)];
  const result = scoreHand({
    tricksWon, trumpSuit: null, isHukm: false,
    lastTrickWinnerTeam: "A", capotTeam: null, teamOfPlayer,
    buyerTeam: "A", projectPointsByTeam: { A: 0, B: 0 },
  });
  check("راو A = راو B = 31 → بعد التقريب كلاهما 3", [result.A, result.B].sort(), [0, 3].sort());
  check("isPending = true (تعادل بعد التقريب)", result.isPending, true);
  check("الخصم (B) ياخذ نقاطه فوراً", result.B, 3);
  check("المشتري (A) يُسجَّل صفر", result.A, 0);
  check("pendingAmount = 3 (نقاط A المعلّقة)", result.pendingAmount, 3);
  check("pendingTeam = A", result.pendingTeam, "A");
}

// ===== الكابوت بالصن: 44 نقطة للفريق الفائز، صفر للخصم =====
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

// ===== الكابوت بالحكم: 25 نقطة + مشاريع =====
{
  const result = scoreHand({
    tricksWon: [], trumpSuit: Suit.HEARTS, isHukm: true,
    lastTrickWinnerTeam: "A", capotTeam: "A", teamOfPlayer,
    buyerTeam: "A", projectPointsByTeam: { A: 40, B: 0 }, // مشروع 400 بالحكم = 100... نستخدم 40 توضيحي بسيط
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
    balootPointsByTeam: { A: 0, B: 2 }, // الفريق B خسر كل الأشواط بس معه بلوت
  });
  check("كابوت لصالح A: A = 25 (بدون بلوت)", result.A, 25);
  check("B خسر كل شي بس يحتفظ ببلوت (2 نقطة) رغم الكابوت ضده", result.B, 2);
}

// ===== الحصالة المعلّقة: تتراكم عبر أيدي متعددة، وتُطلق باليد الحاسمة =====
{
  const pot = new PendingPot();
  const r1 = { isPending: true, pendingAmount: 13, pendingTeam: "A" };
  const released1 = pot.applyHandResult(r1);
  check("يد أولى معلّقة: لا إطلاق بعد", released1, 0);
  check("الحصالة = 13", pot.amount, 13);

  const r2 = { isPending: true, pendingAmount: 13, pendingTeam: "A" };
  const released2 = pot.applyHandResult(r2);
  check("يد ثانية معلّقة أيضاً: تتراكم لـ26", pot.amount, 26);
  check("لا إطلاق بعد", released2, 0);

  const r3 = { isPending: false };
  const released3 = pot.applyHandResult(r3);
  check("يد ثالثة حاسمة: تُطلق الحصالة كاملة (26)", released3, 26);
  check("الحصالة تصفر بعد الإطلاق", pot.amount, 0);
}

// ===== حالة الحكم الخاصة: 8-8 بالضبط (نصف الـ16) = خسف مباشر، مش تعادل معلّق =====
{
  // حكم = قلوب (مجموع لون الحكم = 62). فريق A ياخذ كل القلوب (62) + K+Q+J سبيت (4+3+2=9) = 71، ويأخذ آخر أكلة (+10) = 81
  // فريق B ياخذ: كل الديناري (30) + كل الكلوب (30) + باقي السبيت A+10+9+8+7 (11+10+0+0+0=21) = 81
  const teamACards = [
    ...[Rank.JACK, Rank.NINE, Rank.ACE, Rank.TEN, Rank.KING, Rank.QUEEN, Rank.EIGHT, Rank.SEVEN].map((r) => makeCard(Suit.HEARTS, r)), // 62
    makeCard(Suit.SPADES, Rank.KING), makeCard(Suit.SPADES, Rank.QUEEN), makeCard(Suit.SPADES, Rank.JACK), // 4+3+2=9
  ]; // مجموع 71
  const teamBCards = [
    ...[Rank.ACE, Rank.TEN, Rank.KING, Rank.QUEEN, Rank.JACK, Rank.NINE, Rank.EIGHT, Rank.SEVEN].map((r) => makeCard(Suit.DIAMONDS, r)), // 30
    ...[Rank.ACE, Rank.TEN, Rank.KING, Rank.QUEEN, Rank.JACK, Rank.NINE, Rank.EIGHT, Rank.SEVEN].map((r) => makeCard(Suit.CLUBS, r)), // 30
    makeCard(Suit.SPADES, Rank.ACE), makeCard(Suit.SPADES, Rank.TEN), makeCard(Suit.SPADES, Rank.NINE),
    makeCard(Suit.SPADES, Rank.EIGHT), makeCard(Suit.SPADES, Rank.SEVEN), // 11+10+0+0+0=21
  ]; // مجموع 81

  const tricksWon = [trickOf("p1", teamACards), trickOf("p2", teamBCards)];
  const result = scoreHand({
    tricksWon, trumpSuit: Suit.HEARTS, isHukm: true,
    lastTrickWinnerTeam: "A", capotTeam: null, teamOfPlayer,
    buyerTeam: "A", projectPointsByTeam: { A: 0, B: 0 },
  });
  check("راو A=71+10(آخر أكلة)=81، راو B=81 → كلاهما 8 بعد التقريب", [result.isDefeat], [true]);
  check("خسف مباشر (مش تعليق) بحالة 8-8 بالحكم", result.isPending, false);
  check("المشتري (A) يُسجَّل صفر بالخسف", result.A, 0);
  check("الخصم (B) ياخذ الـ16 كاملة", result.B, 16);
}

// ===== breakdown: يظهر بكل الحالات (عادي، خسف، تعليق، كابوت) بالتفاصيل الصحيحة =====
{
  // حالة عادية: نفس بيانات أول اختبار بالملف (A ينجح بأغلبية واضحة)
  const highValueCards = [Rank.ACE, Rank.TEN, Rank.KING, Rank.QUEEN, Rank.JACK].flatMap((r) =>
    [Suit.HEARTS, Suit.DIAMONDS, Suit.CLUBS, Suit.SPADES].map((s) => makeCard(s, r))
  );
  const zeroCards = [Rank.NINE, Rank.EIGHT, Rank.SEVEN].flatMap((r) =>
    [Suit.HEARTS, Suit.DIAMONDS, Suit.CLUBS, Suit.SPADES].map((s) => makeCard(s, r))
  );
  const tricksWon = [
    trickOf("p1", highValueCards.slice(0, 10)),
    trickOf("p3", highValueCards.slice(10, 20)),
    trickOf("p2", zeroCards.slice(0, 6)),
    trickOf("p4", zeroCards.slice(6, 12)),
  ];
  const result = scoreHand({
    tricksWon, trumpSuit: null, isHukm: false,
    lastTrickWinnerTeam: "A", capotTeam: null, teamOfPlayer,
    buyerTeam: "A", projectPointsByTeam: { A: 50, B: 0 }, // نضيف مشروع لفريق A عشان نتحقق من ظهوره بالتفصيل
  });
  check("breakdown.cardPointsRaw موجود ويطابق النقاط الخام (120 لفريق A، 0 لفريق B)", result.breakdown.cardPointsRaw, { A: 120, B: 0 });
  check("breakdown.lastTrickTeam يطابق مين أخذ آخر أكلة", result.breakdown.lastTrickTeam, "A");
  check("breakdown.lastTrickBonus يطابق قيمة الأرض بالصن (25)", result.breakdown.lastTrickBonus, 25);
  check("breakdown.projectPointsByTeam يعكس المشروع المُمرَّر (50 لفريق A)", result.breakdown.projectPointsByTeam, { A: 50, B: 0 });
  check("breakdown.roundedCardPoints موجودة بالحالة العادية", typeof result.breakdown.roundedCardPoints, "object");
}

// ===== breakdown بحالة الكابوت - تحتوي capotTeam وcapotBasePoints، وcardPointsRaw موجودة للعرض حتى لو ما أثّرت بالحساب =====
{
  const allCards = [Rank.ACE, Rank.TEN, Rank.KING, Rank.QUEEN, Rank.JACK, Rank.NINE, Rank.EIGHT, Rank.SEVEN].flatMap((r) =>
    [Suit.HEARTS, Suit.DIAMONDS, Suit.CLUBS, Suit.SPADES].map((s) => makeCard(s, r))
  );
  const tricksWon = [
    trickOf("p1", allCards.slice(0, 8)),
    trickOf("p3", allCards.slice(8, 16)),
    trickOf("p1", allCards.slice(16, 24)),
    trickOf("p3", allCards.slice(24, 32)),
  ];
  const result = scoreHand({
    tricksWon, trumpSuit: Suit.HEARTS, isHukm: true,
    lastTrickWinnerTeam: "A", capotTeam: "A", teamOfPlayer,
    buyerTeam: "A", projectPointsByTeam: { A: 0, B: 0 },
  });
  check("breakdown.capotTeam يطابق الفريق الكابوت", result.breakdown.capotTeam, "A");
  check("breakdown.capotBasePoints يطابق قيمة الكابوت بالحكم (25)", result.breakdown.capotBasePoints, 25);
  check("breakdown.cardPointsRaw موجودة حتى بالكابوت (للعرض)", typeof result.breakdown.cardPointsRaw, "object");
}

console.log(`\n— النتيجة: ${pass} ناجح، ${fail} فاشل —`);
process.exit(fail > 0 ? 1 : 0);
