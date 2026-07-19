// declareEngine.js — النزول، الإضافة على بير مكشوف، تبديل الجوكر

import { HandEngine, ExposedMeld, HandRuleError, DrawSource } from "./engine.js";
import { isValidSet, isValidRun, sequenceValue, canonicalRunOrder, MAX_SET_SIZE, MeldKind } from "./meld.js";
import { totalPoints } from "./scoring.js";

function requireTurnAndDraw(engine, playerID) {
  const s = engine.state;
  if (s.currentTurnPlayerID !== playerID) throw new HandRuleError("ليس دورك الآن");
  if (!s.hasDrawnThisTurn) throw new HandRuleError("يجب السحب أولاً قبل أي إجراء آخر");
}

function firstRealRankAndIndex(cards) {
  const idx = cards.findIndex((c) => !c.isJoker);
  if (idx === -1) return null;
  return { rank: cards[idx].rank, index: idx };
}

function lastRealRankAndIndex(cards) {
  let idx = -1;
  for (let i = cards.length - 1; i >= 0; i--) {
    if (!cards[i].isJoker) { idx = i; break; }
  }
  if (idx === -1) return null;
  return { rank: cards[idx].rank, index: idx };
}

HandEngine.prototype.declareMelds = function (playerID, melds) {
  const s = this.state;
  requireTurnAndDraw(this, playerID);
  if (s.lastDrawSource !== DrawSource.LEFT_DISCARD) {
    throw new HandRuleError("النزول لا يصير إلا إذا أخذت ورقة النار (يسارك) هذا الدور، مش بالسحب من الدِّستة");
  }
  if (!s.escalation.isDeclareAllowed) {
    throw new HandRuleError("النزول ممنوع الآن - تجاوزنا مستوى التصعيد المسموح له");
  }
  for (const m of melds) {
    const valid = m.kind === MeldKind.SET ? isValidSet(m.cards) : isValidRun(m.cards);
    if (!valid) throw new HandRuleError("بير غير صحيح");
  }

  // حماية حرجة: لو نفس الورقة تكررت بأكثر من بير بنفس الاستدعاء، شيل الورق المكرر يفسد اليد بصمت
  // (splice(-1,1) على ورقة مش موجودة يشيل ورقة عشوائية بدل ما يفشل بوضوح) - نرفضها مبكراً قبل أي تعديل
  {
    const allCardIds = melds.flatMap((m) => m.cards.map((c) => c.id));
    if (new Set(allCardIds).size !== allCardIds.length) {
      throw new HandRuleError("نفس الورقة مكررة بأكثر من بير بهذا النزول - غير مسموح");
    }
  }

  const player = s.player(playerID);
  if (!player) throw new HandRuleError("لاعب غير موجود");
  for (const m of melds) {
    for (const c of m.cards) {
      if (!player.hand.some((h) => h.id === c.id)) throw new HandRuleError("هذه الورقة ليست بيد اللاعب");
    }
  }

  const newCardsCount = melds.reduce((sum, m) => sum + m.cards.length, 0);

  // النزول العادي (المسار التدريجي) لازم يبقي ورقة واحدة على الأقل باليد - محجوزة للخالص بالنهاية
  // (ما يصير تنزّل كل يدّك دفعة وحدة بالنزول العادي - هذا فقط لمسارات هند/لون/قرينق/خالص المباشر)
  if (player.hand.length - newCardsCount < 1) {
    throw new HandRuleError("لازم تبقي ورقة واحدة على الأقل بيدك بعد النزول - محجوزة للخالص، ما يصير تنزّل يدّك بالكامل بالنزول العادي");
  }

  // مجموع الورق اللي "هو نفسه" نزّله/أضافه طول الجولة (نزول + أي إضافة، بغض النظر عن بير مين) ما يصير يتجاوز 14
  const alreadyPlacedCount = s.cardsPlacedBy.get(playerID) ?? 0;
  if (alreadyPlacedCount + newCardsCount > 14) {
    throw new HandRuleError(
      `ما يصير - مجموع الورق اللي نزّلته/أضفته بيتجاوز 14 ورقة (نزّلت/أضفت ${alreadyPlacedCount} مسبقاً، وتحاول تنزّل ${newCardsCount} زيادة)`
    );
  }

  const totalPointsAll = melds.reduce((sum, m) => sum + totalPoints(m.cards, m.kind), 0);
  const isFirstDeclarationEver = !s.declaration.hasAnyDeclaration;

  if (s.declaration.isPlayerInRace(playerID)) {
    s.declaration.increaseOwnTotal(playerID, totalPointsAll);
  } else {
    if (!s.declaration.canEnterRace(totalPointsAll)) {
      const threshold = s.declaration.currentThreshold ?? 91;
      throw new HandRuleError(`النزول يحتاج إجمالي أعلى من ${threshold} نقطة`);
    }
    s.declaration.enterRace(playerID, totalPointsAll);
  }

  if (isFirstDeclarationEver) s.escalation.freezeAfterFirstDeclaration();

  for (const m of melds) {
    for (const c of m.cards) {
      const idx = player.hand.findIndex((h) => h.id === c.id);
      player.hand.splice(idx, 1);
    }
    const storedCards = m.kind === MeldKind.RUN ? canonicalRunOrder(m.cards) : m.cards;
    s.exposedMelds.push(new ExposedMeld(storedCards, m.kind, playerID));
  }
  s.exposedActionPlayers.add(playerID);
  s.cardsPlacedBy.set(playerID, (s.cardsPlacedBy.get(playerID) ?? 0) + newCardsCount);
  s.hasMadeProgressThisTurn = true;
};

HandEngine.prototype.addCardToExposedMeld = function (playerID, meldID, card) {
  const s = this.state;
  requireTurnAndDraw(this, playerID);
  if (!s.declaration.isPlayerInRace(playerID)) {
    throw new HandRuleError("لازم تنزّل بير على الطاولة أول قبل تقدر تضيف على بيرك أو بير أي لاعب ثاني");
  }
  const player = s.player(playerID);
  if (!player || !player.hand.some((c) => c.id === card.id)) throw new HandRuleError("هذه الورقة ليست بيد اللاعب");
  const meld = s.exposedMelds.find((m) => m.id === meldID);
  if (!meld) throw new HandRuleError("البير غير موجود");

  // مجموع الورق اللي "هو نفسه" نزّله/أضافه طول الجولة ما يصير يتجاوز 14 - حتى لو يضيف على بير لاعب ثاني
  const alreadyPlacedCount = s.cardsPlacedBy.get(playerID) ?? 0;
  if (alreadyPlacedCount + 1 > 14) {
    throw new HandRuleError("ما يصير - مجموع الورق اللي نزّلته/أضفته بيتجاوز 14 ورقة لو أضفت هذي");
  }

  if (meld.kind === MeldKind.SET) {
    validateSetAddition(meld, card);
  } else {
    validateRunAddition(meld, card); // قد تعدّل meld.cards مباشرة (إدراج بالمكان الصحيح)
  }

  if (playerID !== meld.declaredByPlayerID) {
    s.declaration.registerCrossPlayerAddition(playerID, meld.declaredByPlayerID);
  }
  s.exposedActionPlayers.add(playerID);
  s.cardsPlacedBy.set(playerID, alreadyPlacedCount + 1);
  s.hasMadeProgressThisTurn = true;

  const idx = player.hand.findIndex((c) => c.id === card.id);
  player.hand.splice(idx, 1);

  if (meld.kind === MeldKind.SET) meld.cards.push(card);
};

function validateSetAddition(meld, card) {
  const realCard = meld.cards.find((c) => !c.isJoker);
  if (!realCard) throw new HandRuleError("بير غير صالح");
  if (card.isJoker || card.rank !== realCard.rank) throw new HandRuleError("الورقة لا تطابق رتبة المجموعة");
  const usedSuits = new Set(meld.cards.map((c) => c.suit).filter(Boolean));
  if (usedSuits.has(card.suit)) throw new HandRuleError("هذا النوع مستخدم بالمجموعة بالفعل");
  if (meld.cards.length >= MAX_SET_SIZE) throw new HandRuleError("المجموعة مكتملة بالفعل (4 أنواع)"); // إجمالي الورق (حقيقي+جوكر)، مش الحقيقي بس
}

function validateRunAddition(meld, card) {
  if (card.isJoker) throw new HandRuleError("ورقة غير صالحة للتسلسل");
  const anyReal = meld.cards.find((c) => !c.isJoker);
  if (!anyReal || card.suit !== anyReal.suit) throw new HandRuleError("النوع لا يطابق التسلسل");

  const first = firstRealRankAndIndex(meld.cards);
  const last = lastRealRankAndIndex(meld.cards);
  if (!first || !last) throw new HandRuleError("تسلسل غير صالح");

  const frontSeq = sequenceValue(first.rank, first.index) - first.index;
  const backSeq = sequenceValue(last.rank, last.index) + (meld.cards.length - 1 - last.index);

  if (card.rank !== 14) {
    if (card.rank === frontSeq - 1) { meld.cards.unshift(card); return; }
    if (card.rank === backSeq + 1) { meld.cards.push(card); return; }
  } else {
    if (frontSeq === 2) { meld.cards.unshift(card); return; }
    if (backSeq === 13) { meld.cards.push(card); return; }
  }
  throw new HandRuleError("الورقة لا تكمّل التسلسل من أي طرف");
}

HandEngine.prototype.swapJokerInRun = function (requesterID, meldID, replacement) {
  const s = this.state;
  if (!s.declaration.isPlayerInRace(requesterID)) {
    throw new HandRuleError("فقط اللاعبين النازلين يقدرون يبدّلون الجوكر");
  }
  const requester = s.player(requesterID);
  if (!requester || !requester.hand.some((c) => c.id === replacement.id)) {
    throw new HandRuleError("هذه الورقة ليست بيد اللاعب");
  }
  const meld = s.exposedMelds.find((m) => m.id === meldID);
  if (!meld || meld.kind !== MeldKind.RUN) throw new HandRuleError("البير غير موجود أو ليس تسلسل");

  const jokerIndex = meld.cards.findIndex((c) => c.isJoker);
  if (jokerIndex === -1) throw new HandRuleError("لا يوجد جوكر بهذا البير");

  const anchor = firstRealRankAndIndex(meld.cards);
  if (!anchor) throw new HandRuleError("تسلسل غير صالح");
  const anchorSeq = sequenceValue(anchor.rank, anchor.index);
  const designatedSeq = anchorSeq + (jokerIndex - anchor.index);

  const runSuit = meld.cards.find((c) => !c.isJoker)?.suit;
  if (replacement.suit !== runSuit) throw new HandRuleError("النوع لا يطابق التسلسل");
  const replacementSeq = sequenceValue(replacement.rank, jokerIndex);
  if (replacementSeq !== designatedSeq) throw new HandRuleError("الورقة لا تطابق مكان الجوكر بالضبط");

  const joker = meld.cards[jokerIndex];
  meld.cards[jokerIndex] = replacement;
  const idx = requester.hand.findIndex((c) => c.id === replacement.id);
  requester.hand.splice(idx, 1);
  requester.hand.push(joker);
  return joker;
};

HandEngine.prototype.extractJokerFromSet = function (requesterID, meldID) {
  const s = this.state;
  if (!s.declaration.isPlayerInRace(requesterID)) {
    throw new HandRuleError("فقط اللاعبين النازلين يقدرون يسحبون الجوكر");
  }
  const requester = s.player(requesterID);
  const meld = s.exposedMelds.find((m) => m.id === meldID);
  if (!meld || meld.kind !== MeldKind.SET) throw new HandRuleError("البير غير موجود أو ليس مجموعة");

  const realCount = meld.cards.filter((c) => !c.isJoker).length;
  const jokerIndex = meld.cards.findIndex((c) => c.isJoker);
  if (realCount !== MAX_SET_SIZE || jokerIndex === -1) {
    throw new HandRuleError("المجموعة لسه ناقصة أنواع - لازم تكتمل 4 أوراق حقيقية أولاً");
  }
  const joker = meld.cards.splice(jokerIndex, 1)[0];
  requester.hand.push(joker);
  return joker;
};
