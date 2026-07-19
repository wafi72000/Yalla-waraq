// ai.js — ذكاء اصطناعي محسّن (v4): قرارات أذكى في السحب، النزول، الإضافة، والإنهاء

import { HandEngine, DrawSource, HandRuleError } from "./engine.js";
import { MeldKind, isValidSet, isValidRun } from "./meld.js";
import { totalPoints } from "./scoring.js";
import { EndingType } from "./escalation.js";

/// يبحث عن تسلسلات بنفس النوع، يسمح بتعويض فجوة واحدة بالجوكر (لو متوفر) لكل تسلسل
function findSuitRuns(cardsOfSuit, availableJokers) {
  const sorted = [...cardsOfSuit].sort((a, b) => a.rank - b.rank);
  const runs = [];
  let jokerIdx = 0;

  let i = 0;
  while (i < sorted.length) {
    let group = [sorted[i]];
    let usedJokerForThisGroup = false;
    let j = i + 1;
    while (j < sorted.length) {
      const gap = sorted[j].rank - group[group.length - 1].rank - 1;
      if (gap === 0) {
        group.push(sorted[j]);
        j++;
      } else if (gap === 1 && !usedJokerForThisGroup && jokerIdx < availableJokers.length) {
        group.push(availableJokers[jokerIdx]);
        group.push(sorted[j]);
        usedJokerForThisGroup = true;
        jokerIdx++;
        j++;
      } else {
        break;
      }
    }
    if (group.length >= 3) {
      runs.push(group);
      i = j;
    } else {
      i++;
    }
  }
  return runs;
}

export function findPossibleMelds(hand) {
  const result = [];
  const reals = hand.filter((c) => !c.isJoker);
  const allJokers = hand.filter((c) => c.isJoker);
  let usedJokerCount = 0;
  const usedRealIds = new Set();

  const byRank = new Map();
  for (const c of reals) {
    if (!byRank.has(c.rank)) byRank.set(c.rank, []);
    byRank.get(c.rank).push(c);
  }
  for (const [, cardsOfRank] of byRank) {
    const bySuit = new Map();
    for (const c of cardsOfRank) if (!bySuit.has(c.suit)) bySuit.set(c.suit, c);
    const oneOfEachSuit = [...bySuit.values()];
    if (oneOfEachSuit.length >= 3) {
      result.push({ cards: oneOfEachSuit, kind: MeldKind.SET });
      for (const c of oneOfEachSuit) usedRealIds.add(c.id);
    } else if (oneOfEachSuit.length === 2 && usedJokerCount < allJokers.length) {
      result.push({ cards: [...oneOfEachSuit, allJokers[usedJokerCount]], kind: MeldKind.SET });
      for (const c of oneOfEachSuit) usedRealIds.add(c.id);
      usedJokerCount += 1;
    }
  }

  const remainingJokers = allJokers.slice(usedJokerCount);
  const bySuit = new Map();
  for (const c of reals) {
    if (usedRealIds.has(c.id)) continue;
    if (!bySuit.has(c.suit)) bySuit.set(c.suit, []);
    bySuit.get(c.suit).push(c);
  }
  for (const [, cardsOfSuit] of bySuit) {
    const runs = findSuitRuns(cardsOfSuit, remainingJokers);
    for (const run of runs) result.push({ cards: run, kind: MeldKind.RUN });
  }

  return result;
}

function tryFullHandPartition(hand) {
  const melds = [];
  let remaining = [...hand];
  let progress = true;
  while (progress && remaining.length > 0) {
    progress = false;
    const found = findPossibleMelds(remaining).filter(
      (m) => (m.kind === MeldKind.SET ? isValidSet(m.cards) : isValidRun(m.cards))
    );
    if (found.length > 0) {
      found.sort((a, b) => b.cards.length - a.cards.length);
      const chosen = found[0];
      const usedIds = new Set(chosen.cards.map((c) => c.id));
      remaining = remaining.filter((c) => !usedIds.has(c.id));
      melds.push(chosen);
      progress = true;
    }
  }
  return { melds, leftover: remaining };
}

function supportScore(card, hand) {
  if (card.isJoker) return 999;
  const sameRank = hand.filter((c) => c.rank === card.rank && c.suit !== card.suit).length;
  const sameSuitNeighbors = hand.filter(
    (c) => !c.isJoker && c.suit === card.suit && c.rank !== card.rank && Math.abs(c.rank - card.rank) <= 2
  ).length;
  return sameRank + sameSuitNeighbors;
}

export function chooseDiscard(hand) {
  const nonJokers = hand.filter((c) => !c.isJoker);
  if (nonJokers.length === 0) return hand[0] ?? null;

  const scored = nonJokers.map((c) => ({ card: c, score: supportScore(c, hand) }));
  const minScore = Math.min(...scored.map((s) => s.score));
  const candidates = scored.filter((s) => s.score === minScore).map((s) => s.card);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export function isCardUseful(card, hand) {
  if (card.isJoker) return false;
  const sameRank = hand.some((c) => c.rank === card.rank && c.suit !== card.suit);
  const sameSuitNeighbor = hand.some(
    (c) => !c.isJoker && c.suit === card.suit && Math.abs(c.rank - card.rank) === 1
  );
  return sameRank || sameSuitNeighbor;
}

/// هل ورقة النار مفيدة لهذا اللاعب؟ (تكمّل بير موجود أو تبني واحد جديد)
function isDiscardUsefulFor(card, hand) {
  if (!card) return false;
  if (card.isJoker) return true; // الجوكر دايماً مفيد
  // تكمّل مجموعة (نفس الرتبة، نوع مختلف)
  const sameRank = hand.filter((c) => !c.isJoker && c.rank === card.rank && c.suit !== card.suit).length;
  if (sameRank >= 2) return true;
  // تكمّل تسلسل (نفس النوع، رتبة مجاورة)
  const sameSuitNeighbors = hand.filter(
    (c) => !c.isJoker && c.suit === card.suit && Math.abs(c.rank - card.rank) <= 1
  ).length;
  return sameSuitNeighbors >= 1;
}

function ensureStrategyAssigned(state, player) {
  if (player._aiStrategyRound !== state.roundNumber) {
    player._aiStrategyRound = state.roundNumber;
    // 30% يجرّب المسار المخفي (هند/لون/قرينق)، 70% المسار المكشوف
    player._aiConcealed = Math.random() < 0.3;
  }
}

function performConcealedAITurn(engine, playerID) {
  const s = engine.state;
  const player = s.player(playerID);

  // يسحب من النار لو مفيدة، وإلا من الدستة (في المسار المخفي، يفضّل الدستة)
  const topDiscard = s.discardPile[s.discardPile.length - 1];
  const takeFromFire = s.isLeftDiscardUnlocked && topDiscard && isDiscardUsefulFor(topDiscard, player.hand);
  const source = takeFromFire ? DrawSource.LEFT_DISCARD : DrawSource.STOCK;

  let drawnCard;
  try {
    drawnCard = engine.drawCard(playerID, source);
  } catch (e) {
    return;
  }

  // يحاول خالص مباشر (بيده ورقة وحدة بعد نزول ما)
  if (s.exposedActionPlayers.has(playerID) && player.hand.length === 1) {
    try { engine.endRound(playerID, EndingType.KHALES, player.hand.slice()); return; } catch (e) {
      if (!(e instanceof HandRuleError)) console.error("[AI concealed] KHALES unexpected:", e);
    }
  }

  // يحاول هند/لون/قرينق
  if (s.escalation.isEndingAllowed(EndingType.HAND) && source === DrawSource.STOCK) {
    const { melds, leftover } = tryFullHandPartition(player.hand);
    if (leftover.length <= 1) {
      // يفضّل لون ثم قرينق لو يطبّق
      const allCards = [...player.hand].filter((c) => !c.isJoker);
      const allRed = allCards.every((c) => ["hearts","diamonds"].includes(c.suit));
      const allBlack = allCards.every((c) => ["spades","clubs"].includes(c.suit));
      const firstSuit = allCards[0]?.suit;
      const allSameSuit = firstSuit && allCards.every((c) => c.suit === firstSuit);
      const finalDiscards = leftover;
      const endType = allSameSuit ? EndingType.QARINQ : (allRed || allBlack) ? EndingType.COLOR : EndingType.HAND;
    try {
      engine.endRound(playerID, endType, finalDiscards, melds);
      return;
    } catch (e) {
      if (!(e instanceof HandRuleError)) console.error("[AI concealed] endRound unexpected:", e);
    }
    }
  }

  // لو أخذ من النار بس ما قدر يستفيد - يرجّعها
  if (source === DrawSource.LEFT_DISCARD && !s.hasMadeProgressThisTurn) {
    try {
      engine.undoLeftDiscardDraw(playerID);
      drawnCard = engine.drawCard(playerID, DrawSource.STOCK);
    } catch (e) { return; }
  }

  let discard = chooseDiscard(player.hand);
  if (discard && drawnCard && discard.id === drawnCard.id && player.hand.length > 1) {
    const alternatives = player.hand.filter((c) => c.id !== drawnCard.id);
    discard = chooseDiscard(alternatives) ?? discard;
  }
  if (discard) {
    try { engine.discardCard(playerID, discard); } catch (e) {
      if (!(e instanceof HandRuleError)) console.error("[AI concealed] discardCard unexpected:", e);
    }
  }
}

function performExposedAITurn(engine, playerID) {
  const s = engine.state;
  const player = s.player(playerID);

  const topDiscard = s.discardPile[s.discardPile.length - 1];
  // يسحب من النار لو مفيدة، وإلا من الدستة
  const takeFromFire = s.isLeftDiscardUnlocked && topDiscard && isDiscardUsefulFor(topDiscard, player.hand);
  const source = takeFromFire ? DrawSource.LEFT_DISCARD : DrawSource.STOCK;

  let drawnCard;
  try {
    drawnCard = engine.drawCard(playerID, source);
  } catch (e) {
    return;
  }

  let madeProgress = false;

  // نأخذ snapshot من اليد قبل أي تعديل - يحمي من تكرار على مصفوفة تتغيّر (v4: كان [...player.hand] داخل الحلقة بس ما يكفي لو declareMelds شيل ورق وأضاف في نفس الوقت)
  const handSnapshot = () => [...player.hand];

  // نزول لو سحب من النار وعنده بيرات
  if (source === DrawSource.LEFT_DISCARD && s.escalation.isDeclareAllowed) {
    const melds = findPossibleMelds(handSnapshot());
    if (melds.length > 0) {
      const alreadyInRace = s.declaration.isPlayerInRace(playerID);
      // نبني مجموعة بيرات بدون أي تداخل بالورق (نفس الورقة ما تتكرر بأكثر من بير)، مع احترام سقف 14 وحفظ ورقة
      const melds2declare = [];
      const usedCardIds = new Set();
      let placedCount = s.cardsPlacedBy.get(playerID) ?? 0;
      const currentHand = handSnapshot();
      for (const m of melds) {
        if (m.cards.some((c) => usedCardIds.has(c.id))) continue; // تتشارك ورقة مع بير سبق اختياره - تُتجاهل
        const newCount = m.cards.length;
        const meldIds = new Set(m.cards.map((c) => c.id));
        const remainAfter = currentHand.filter((c) => !usedCardIds.has(c.id) && !meldIds.has(c.id)).length;
        if (placedCount + newCount <= 14 && remainAfter >= 1) {
          melds2declare.push(m);
          for (const c of m.cards) usedCardIds.add(c.id);
          placedCount += newCount;
        }
      }
      // العتبة تُحسب من الميلدات المُختارة فعلياً (بعد استبعاد التداخل والقيود)، مش من كل الميلدات الممكنة نظرياً
      const actualTotal = melds2declare.reduce((sum, m) => sum + totalPoints(m.cards, m.kind), 0);
      const canDeclare = melds2declare.length > 0 && (alreadyInRace || s.declaration.canEnterRace(actualTotal));
      if (canDeclare) {
        try { engine.declareMelds(playerID, melds2declare); madeProgress = true; } catch (e) {
          if (!(e instanceof HandRuleError)) console.error("[AI] declareMelds unexpected:", e);
        }
      }
    }
  }

  // إضافة على أي بير مكشوف (يفضّل بيره لحاله أولاً)
  if (s.declaration.isPlayerInRace(playerID)) {
    const sortedMelds = [...s.exposedMelds].sort((a) => a.declaredByPlayerID === playerID ? -1 : 1);
    outer: for (const meld of sortedMelds) {
      for (const card of handSnapshot()) { // snapshot جديد لكل بير عشان يعكس أي شيل صار من الإضافة السابقة
        try {
          engine.addCardToExposedMeld(playerID, meld.id, card);
          madeProgress = true;
          break outer;
        } catch (e) {} // الأخطاء المتوقعة (ورقة ما تطابق) تُتجاهل، غير المتوقعة نسجّلها
      }
    }
  }

  // خالص لو بقيت ورقة وحدة
  if (player.hand.length === 1 && s.exposedActionPlayers.has(playerID)) {
    try { engine.endRound(playerID, EndingType.KHALES, player.hand.slice()); return; } catch (e) {
      if (!(e instanceof HandRuleError)) console.error("[AI exposed] KHALES unexpected:", e);
    }
  }

  // لو أخذ من النار وما قدر يستفيد - يرجّعها
  if (source === DrawSource.LEFT_DISCARD && !madeProgress) {
    try {
      engine.undoLeftDiscardDraw(playerID);
      drawnCard = engine.drawCard(playerID, DrawSource.STOCK);
    } catch (e) { return; }
  }

  s.turnsWithoutProgress = madeProgress ? 0 : (s.turnsWithoutProgress ?? 0) + 1;

  let discard = chooseDiscard(player.hand);
  if (discard && drawnCard && discard.id === drawnCard.id && player.hand.length > 1) {
    const alternatives = player.hand.filter((c) => c.id !== drawnCard.id);
    discard = chooseDiscard(alternatives) ?? discard;
  }
  if ((s.turnsWithoutProgress ?? 0) > 60) {
    const nonJokers = player.hand.filter((c) => !c.isJoker);
    if (nonJokers.length > 0) discard = nonJokers[Math.floor(Math.random() * nonJokers.length)];
  }
  if (discard) {
    try { engine.discardCard(playerID, discard); } catch (e) {
      if (!(e instanceof HandRuleError)) console.error("[AI exposed] discardCard unexpected:", e);
    }
  }
}

HandEngine.prototype.performAITurn = function (playerID) {
  const s = this.state;
  const player = s.player(playerID);
  if (!player) return;

  ensureStrategyAssigned(s, player);

  if (player._aiConcealed) {
    performConcealedAITurn(this, playerID);
  } else {
    performExposedAITurn(this, playerID);
  }
};
