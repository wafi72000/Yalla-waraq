// projects.js — كشف المشاريع، وحسم الأولوية بين فريقين حسب سلسلة القواعد المتفق عليها

import { ALL_SUITS, PROJECT_TIEBREAK_ORDER, Rank } from "./models.js";

export const ProjectType = {
  SIRA: "sira",     // 3 متتالية - 20
  KHAMSEEN: "khamseen", // 4 متتالية - 50
  MIA: "mia",       // 5 متتالية أو 4 من نفس الفئة - 100
  ARBAAMIA: "arbaamia", // 4 آسات (صن فقط) - 400
  BALOOT: "baloot", // شايب+بنت من الحكم - 20 (مستقل تماماً، لا يدخل بالمقارنات)
};

const PROJECT_POINTS = {
  [ProjectType.SIRA]: 20,
  [ProjectType.KHAMSEEN]: 50,
  [ProjectType.MIA]: 100,
  [ProjectType.ARBAAMIA]: 400,
  [ProjectType.BALOOT]: 20,
};

const TYPE_STRENGTH = {
  [ProjectType.ARBAAMIA]: 4,
  [ProjectType.MIA]: 3,
  [ProjectType.KHAMSEEN]: 2,
  [ProjectType.SIRA]: 1,
};

/// يرجع الأوراق مرتبة تصاعدياً بنفس اللون فقط (لكشف المتتاليات)
function sortedBySuit(hand) {
  const bySuit = new Map();
  for (const c of hand) {
    if (!bySuit.has(c.suit)) bySuit.set(c.suit, []);
    bySuit.get(c.suit).push(c);
  }
  for (const [, cards] of bySuit) cards.sort((a, b) => a.rank - b.rank);
  return bySuit;
}

/// يلاقي أطول متتالية بلون واحد (يرجع المتتاليات كلها بطول >=3، الأطول أولاً)
function findRunsInSuit(cardsOfSuit) {
  const runs = [];
  let i = 0;
  while (i < cardsOfSuit.length) {
    let group = [cardsOfSuit[i]];
    let j = i + 1;
    while (j < cardsOfSuit.length && cardsOfSuit[j].rank === group[group.length - 1].rank + 1) {
      group.push(cardsOfSuit[j]);
      j++;
    }
    if (group.length >= 3) runs.push(group);
    i = j;
  }
  return runs;
}

/// يكشف أفضل مشروع بيد لاعب معين (يرجع null لو ما فيه مشروع مؤهل، أو أفضل واحد لو فيه أكثر من خيار)
/// trumpSuit = لون الحكم (null لو صن) - يلزم لتحديد "بلوت" ولتفضيل لون الحكم بفض التعادل
export function detectBestProject(hand, isHukmSystem) {
  const bySuit = sortedBySuit(hand);
  const candidates = [];

  for (const [suit, cards] of bySuit) {
    const runs = findRunsInSuit(cards);
    for (const run of runs) {
      if (run.length >= 5) {
        candidates.push({ type: ProjectType.MIA, cards: run.slice(-5), suit });
      } else if (run.length === 4) {
        candidates.push({ type: ProjectType.KHAMSEEN, cards: run, suit });
      } else if (run.length === 3) {
        candidates.push({ type: ProjectType.SIRA, cards: run, suit });
      }
    }
  }

  // 4 من نفس الفئة (شواب/بنات/أولاد/عشرات) = مية أيضاً
  const byRank = new Map();
  for (const c of hand) {
    if (!byRank.has(c.rank)) byRank.set(c.rank, []);
    byRank.get(c.rank).push(c);
  }
  for (const [rank, cards] of byRank) {
    if (cards.length === 4) {
      if (rank === Rank.ACE) {
        candidates.push({
          type: isHukmSystem ? ProjectType.MIA : ProjectType.ARBAAMIA,
          cards, suit: null, isFourOfKind: true,
        });
      } else {
        candidates.push({ type: ProjectType.MIA, cards, suit: null, isFourOfKind: true });
      }
    }
  }

  if (candidates.length === 0) return null;

  // نختار أقوى مرشّح بنفس منطق فض التعادل (نوع، ثم أعلى ورقة، ثم عدد أوراق المية، ثم لون الحكم)
  candidates.sort((a, b) => compareProjects(a, b, trumpSuitPlaceholderOrNull(isHukmSystem)) );
  return candidates[0];

  function trumpSuitPlaceholderOrNull() { return null; } // نستخدم مقارنة محايدة داخل نفس اليد (لون الحكم يُطبّق لاحقاً وقت المقارنة بين فريقين)
}

function highestRankInProject(project) {
  const sorted = [...project.cards].sort(
    (a, b) => PROJECT_TIEBREAK_ORDER.indexOf(a.rank) - PROJECT_TIEBREAK_ORDER.indexOf(b.rank)
  );
  return sorted[0].rank;
}

/// يقارن مشروعين (سالب = a أقوى، موجب = b أقوى، صفر = تعادل تام يحتاج فحص الموقع خارجياً)
/// trumpSuit تُستخدم فقط للتفضيل بالخطوة الثالثة (null يعني نتجاهل هذي الخطوة - يُستخدم بالمقارنة الداخلية لنفس اليد)
export function compareProjects(a, b, trumpSuit) {
  const strengthDiff = TYPE_STRENGTH[b.type] - TYPE_STRENGTH[a.type];
  if (strengthDiff !== 0) return strengthDiff;

  const aHighIdx = PROJECT_TIEBREAK_ORDER.indexOf(highestRankInProject(a));
  const bHighIdx = PROJECT_TIEBREAK_ORDER.indexOf(highestRankInProject(b));
  if (aHighIdx !== bHighIdx) return aHighIdx - bHighIdx; // أصغر index = أقوى (الآس أول بالقائمة)

  if (a.type === ProjectType.MIA && b.type === ProjectType.MIA) {
    const aCount = a.cards.length;
    const bCount = b.cards.length;
    if (aCount !== bCount) return bCount - aCount; // أكثر عدد يفوز (5 متسلسلة > 4 متشابهة)
  }

  if (trumpSuit !== null) {
    const aIsTrump = a.suit === trumpSuit;
    const bIsTrump = b.suit === trumpSuit;
    if (aIsTrump !== bIsTrump) return aIsTrump ? -1 : 1;
  }

  return 0; // تعادل تام - يحتاج فحص موقع اللاعب خارجياً
}

/// يحسم الفريق الفائز بالمشاريع بين قائمتين (كل قائمة = أفضل مشروع لكل لاعب بالفريق، ممكن null)
/// seatPriority: دالة ترجع رقم أولوية الموقع (أصغر = أقرب لدور اللعب: يمين=0، صدر=1، يسار=2، الموزع=3)
/// يرجّع { winningTeam: "A"|"B"|null (تعادل تام نادر جداً - عملياً غير ممكن لعدم تكرار الورق)، reason }
export function resolveProjectPriority(teamAProjects, teamBProjects, trumpSuit, seatPriority) {
  const best = (list) => {
    let winner = null;
    for (const entry of list) {
      if (!entry.project) continue;
      if (!winner || compareProjects(entry.project, winner.project, trumpSuit) < 0) winner = entry;
      else if (compareProjects(entry.project, winner.project, trumpSuit) === 0) {
        if (seatPriority(entry.playerID) < seatPriority(winner.playerID)) winner = entry;
      }
    }
    return winner;
  };

  const bestA = best(teamAProjects);
  const bestB = best(teamBProjects);

  if (!bestA && !bestB) return { winningTeam: null, reason: "لا يوجد مشاريع" };
  if (!bestA) return { winningTeam: "B", reason: "الفريق A بدون مشاريع" };
  if (!bestB) return { winningTeam: "A", reason: "الفريق B بدون مشاريع" };

  const cmp = compareProjects(bestA.project, bestB.project, trumpSuit);
  if (cmp < 0) return { winningTeam: "A", reason: "مشروع A أقوى" };
  if (cmp > 0) return { winningTeam: "B", reason: "مشروع B أقوى" };

  // تعادل تام بالنوع والقوة ولون الحكم - يحسم بموقع اللاعب
  const winnerBySeat = seatPriority(bestA.playerID) < seatPriority(bestB.playerID) ? "A" : "B";
  return { winningTeam: winnerBySeat, reason: "تعادل تام - حُسم بموقع اللاعب" };
}

export function projectPoints(type) {
  return PROJECT_POINTS[type];
}
