import { detectBestProject, resolveProjectPriority, compareProjects, ProjectType, projectPoints } from "./js/projects.js";
import { makeCard, Suit, Rank } from "./js/models.js";

let pass = 0, fail = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "✅" : "❌"} ${name} → ${JSON.stringify(actual)} (متوقع: ${JSON.stringify(expected)})`);
  ok ? pass++ : fail++;
}

// ===== كشف سِرا (3 متتالية) =====
{
  const hand = [makeCard(Suit.HEARTS, Rank.SEVEN), makeCard(Suit.HEARTS, Rank.EIGHT), makeCard(Suit.HEARTS, Rank.NINE), makeCard(Suit.SPADES, Rank.ACE)];
  const p = detectBestProject(hand, false);
  check("يكتشف سِرا (3 متتالية)", p?.type, ProjectType.SIRA);
  check("نقاط السِرا = 20", projectPoints(p.type), 20);
}

// ===== كشف خمسين (4 متتالية) =====
{
  const hand = [makeCard(Suit.HEARTS, Rank.SEVEN), makeCard(Suit.HEARTS, Rank.EIGHT), makeCard(Suit.HEARTS, Rank.NINE), makeCard(Suit.HEARTS, Rank.TEN)];
  const p = detectBestProject(hand, false);
  check("يكتشف خمسين (4 متتالية)", p?.type, ProjectType.KHAMSEEN);
  check("نقاط الخمسين = 50", projectPoints(p.type), 50);
}

// ===== كشف مية (5 متتالية) =====
{
  const hand = [7,8,9,10,11].map((r) => makeCard(Suit.HEARTS, r));
  const p = detectBestProject(hand, false);
  check("يكتشف مية (5 متتالية)", p?.type, ProjectType.MIA);
}

// ===== كشف مية (4 شواب) =====
{
  const hand = ALL_SUITS_KINGS();
  const p = detectBestProject(hand, false);
  check("يكتشف مية (4 شواب - نفس الفئة)", p?.type, ProjectType.MIA);
}
function ALL_SUITS_KINGS() {
  return [Suit.HEARTS, Suit.DIAMONDS, Suit.CLUBS, Suit.SPADES].map((s) => makeCard(s, Rank.KING));
}

// ===== كشف أربعمية (4 آسات) - صن فقط، وبالحكم تصير مية =====
{
  const hand = [Suit.HEARTS, Suit.DIAMONDS, Suit.CLUBS, Suit.SPADES].map((s) => makeCard(s, Rank.ACE));
  const pSun = detectBestProject(hand, false);
  check("4 آسات بالصن = أربعمية (400)", pSun?.type, ProjectType.ARBAAMIA);
  check("نقاط الأربعمية = 400", projectPoints(pSun.type), 400);

  const pHukm = detectBestProject(hand, true);
  check("4 آسات بالحكم = مية (100) بدل أربعمية", pHukm?.type, ProjectType.MIA);
}

// ===== بدون مشروع =====
{
  const hand = [makeCard(Suit.HEARTS, Rank.SEVEN), makeCard(Suit.SPADES, Rank.NINE)];
  check("يد بدون أي مشروع = null", detectBestProject(hand, false), null);
}

// ===== فض التعادل: النوع أولاً (مية تغلب سِرا) =====
{
  const sira = { type: ProjectType.SIRA, cards: [makeCard(Suit.HEARTS, 7), makeCard(Suit.HEARTS, 8), makeCard(Suit.HEARTS, 9)], suit: Suit.HEARTS };
  const khamseen = { type: ProjectType.KHAMSEEN, cards: [makeCard(Suit.SPADES, 7), makeCard(Suit.SPADES, 8), makeCard(Suit.SPADES, 9), makeCard(Suit.SPADES, 10)], suit: Suit.SPADES };
  check("خمسين تغلب سِرا (النوع أولاً)", compareProjects(khamseen, sira, null) < 0, true);
}

// ===== فض التعادل: نفس النوع، الأعلى ورقة يفوز =====
{
  const siraHigh = { type: ProjectType.SIRA, cards: [makeCard(Suit.HEARTS, Rank.JACK), makeCard(Suit.HEARTS, Rank.QUEEN), makeCard(Suit.HEARTS, Rank.KING)], suit: Suit.HEARTS };
  const siraLow = { type: ProjectType.SIRA, cards: [makeCard(Suit.SPADES, 7), makeCard(Suit.SPADES, 8), makeCard(Suit.SPADES, 9)], suit: Suit.SPADES };
  check("سِرا تنتهي بالشايب تغلب سِرا تنتهي بالعشرة", compareProjects(siraHigh, siraLow, null) < 0, true);
}

// ===== فض التعادل: مية 5-متسلسلة تغلب مية 4-متشابهة (نفس النوع، نفس أعلى ورقة) =====
{
  const mia5 = { type: ProjectType.MIA, cards: [10, 11, 12, 13, 14].map((r) => makeCard(Suit.HEARTS, r)), suit: Suit.HEARTS };
  const mia4 = { type: ProjectType.MIA, cards: [Suit.HEARTS, Suit.DIAMONDS, Suit.CLUBS, Suit.SPADES].map((s) => makeCard(s, Rank.ACE)), suit: null };
  check("مية 5 متسلسلة تغلب مية 4 متشابهة (عدد الأوراق)", compareProjects(mia5, mia4, null) < 0, true);
}

// ===== فض التعادل: لون الحكم يغلب لون عادي (تعادل تام غير ذلك) =====
{
  const siraTrump = { type: ProjectType.SIRA, cards: [makeCard(Suit.HEARTS, 7), makeCard(Suit.HEARTS, 8), makeCard(Suit.HEARTS, 9)], suit: Suit.HEARTS };
  const siraNormal = { type: ProjectType.SIRA, cards: [makeCard(Suit.SPADES, 7), makeCard(Suit.SPADES, 8), makeCard(Suit.SPADES, 9)], suit: Suit.SPADES };
  check("سِرا بلون الحكم تغلب سِرا بلون عادي (نفس القوة تماماً)", compareProjects(siraTrump, siraNormal, Suit.HEARTS) < 0, true);
}

// ===== حسم الأولوية بين فريقين: فريق بدون مشاريع يخسر كل شي =====
{
  const teamA = [{ playerID: "p1", project: { type: ProjectType.SIRA, cards: [makeCard(Suit.HEARTS,7),makeCard(Suit.HEARTS,8),makeCard(Suit.HEARTS,9)], suit: Suit.HEARTS } }];
  const teamB = [{ playerID: "p2", project: null }];
  const result = resolveProjectPriority(teamA, teamB, null, () => 0);
  check("الفريق A يفوز (B بدون مشاريع)", result.winningTeam, "A");
}

// ===== حسم الأولوية: تعادل تام يحسمه موقع اللاعب =====
{
  const proj = (suit) => ({ type: ProjectType.SIRA, cards: [makeCard(suit,7),makeCard(suit,8),makeCard(suit,9)], suit });
  const teamA = [{ playerID: "right", project: proj(Suit.SPADES) }];
  const teamB = [{ playerID: "left", project: proj(Suit.CLUBS) }];
  const seatPriority = (id) => ({ right: 0, partner: 1, left: 2, dealer: 3 }[id]);
  const result = resolveProjectPriority(teamA, teamB, null, seatPriority);
  check("تعادل تام - يفوز الأقرب لدور اللعب (يمين)", result.winningTeam, "A");
}

console.log(`\n— النتيجة: ${pass} ناجح، ${fail} فاشل —`);
process.exit(fail > 0 ? 1 : 0);
