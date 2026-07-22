// ai-scheduler.js — جدولة قرارات الذكاء الاصطناعي (مزايدة، دبل، رمي ورقة) عبر setTimeout
// مسؤولية واحدة محدَّدة: "متى ياخذ AI قراره، وأي دالة بالمحرك يستدعي" - منفصل عن الرندر والأحداث

import { match } from "./state.js";
import { BidChoice } from "./bidding.js";
import { aiDecideBid, aiChooseCard, aiDecideDouble } from "./ai.js";
import { speak, BID_SPEECH } from "./speech.js";
import { sounds } from "./sounds.js";
import { HUMAN_ID, AI_IDS, teamOfPlayer, displayName } from "./seats.js";
import { render, afterAction, playDealingAnimation, showToast, speakBidChoice } from "./app.js";

const AI_BID_DELAY_MS = 1200;    // قرار مزايدة (كان 500 - سريع جداً، يصعّب متابعة الورقة المفروشة)
const AI_DOUBLE_DELAY_MS = 1200; // قرار دبل/دبل صن (كان 700)
const AI_PLAY_DELAY_MS = 1400;   // رمي ورقة أثناء اللعب (كان 1200)

function announceAIBid(playerID, choice, round) {
  const name = displayName(playerID);
  speakBidChoice(choice, round);
  if (choice === BidChoice.PASS) {
    showToast(`${name}: ${round === 2 ? "ولا" : "بس"}`);
    return;
  }
  const labels = { [BidChoice.SUN]: "صن", [BidChoice.ASHKAL]: "اشكل", [BidChoice.HUKM]: "حكم" };
  showToast(`${name} اشترى ${labels[choice]}!`);
}

let aiActionPending = false; // يمنع جدولة أكثر من setTimeout واحد لإجراء AI بنفس الوقت - حماية من سباقات نادرة

export function maybeRunAI() {
  if (!match || match.matchOver) return;
  if (match.completedTrick) return; // شوط لسه ينتظر يُكسح - ننتظر afterAction تتولى الوقفة والاستمرار
  if (aiActionPending) return; // فيه إجراء AI مجدول أصلاً بانتظار وقته - ما نجدول وحد ثاني فوقه

  if (match.phase === "bidding" && !match.bidding.isDead) {
    const current = match.bidding.currentPlayerID;
    if (AI_IDS.includes(current)) {
      aiActionPending = true;
      setTimeout(() => {
        aiActionPending = false;
        if (match.phase !== "bidding") return;
        const hand = match.hands.get(current);
        const choices = match.bidding.availableChoices();
        const flippedSuit = match.flippedCard.suit;
        const decision = aiDecideBid(hand, choices, flippedSuit, match.bidding.round);
        const roundBefore = match.bidding.round;
        try {
          match.submitBid(current, decision.choice, decision.trumpSuitForHukm);
          announceAIBid(current, decision.choice, roundBefore);
        } catch (e) {
          try { match.submitBid(current, BidChoice.PASS); } catch (e2) { console.error("[AI bid]", e2); }
        }
        afterAction();
      }, AI_BID_DELAY_MS);
    }
    return;
  }

  if (match.bidding?.isDead && match.phase === "dead") {
    aiActionPending = true;
    setTimeout(() => {
      aiActionPending = false;
      if (match.phase !== "dead") return;
      match.advanceToNextHand();
      match._lastSpokenRound = null;
      match._projectsRevealed = false;
      match._lastAnnouncedTurnKey = null;
      render();
      playDealingAnimation();
      maybeRunAI();
    }, 1200);
    return;
  }

  if (match.phase === "doubling") {
    const teamToAct = match.doubling.teamToActNext;
    const humanTeam = teamOfPlayer(HUMAN_ID);
    if (teamToAct !== humanTeam) {
      // دور فريق AI بالكامل (سالم وفهد) - يقرر تلقائياً
      aiActionPending = true;
      setTimeout(() => {
        aiActionPending = false;
        if (match.phase !== "doubling") return;
        const aiMemberID = AI_IDS.find((id) => teamOfPlayer(id) === teamToAct);
        const hand = match.hands.get(aiMemberID);
        const role = teamToAct === match.opponentTeam ? "opponent" : "buyer";
        const wantsToDouble = aiDecideDouble(hand, match.trumpSuit, match.doubling.level, role, match.cumulativeScores, teamToAct);
        try {
          if (wantsToDouble) {
            const levelNamesAI = ["", "دبل", "ثري", "فور", "خمسة"];
            const spokenLevel = levelNamesAI[match.doubling.level + 1];
            match.requestDouble(teamToAct);
            speak(spokenLevel);
            afterAction();
          } else {
            match.proceedToPlay();
            afterAction();
          }
        } catch (e) {
          match.proceedToPlay();
          afterAction();
        }
      }, AI_DOUBLE_DELAY_MS);
    }
    // لو دور فريق الإنسان، ننتظر تفاعله عبر renderDoublingBar (ما نسوي شي هنا)
    return;
  }

  if (match.phase === "sunDoubling") {
    const humanTeam = teamOfPlayer(HUMAN_ID);
    if (match.opponentTeam !== humanTeam) {
      // فريق AI هو الخصم - يقرر تلقائياً (معيار بسيط: يدبل لو متأخر بوضوح، غير كذا يلعب عادي)
      aiActionPending = true;
      setTimeout(() => {
        aiActionPending = false;
        if (match.phase !== "sunDoubling") return;
        const myScore = match.cumulativeScores[match.opponentTeam];
        const theirScore = match.cumulativeScores[match.buyerTeam];
        const desperate = theirScore - myScore >= 100; // نفس معيار الجرأة بالحكم - نجازف لو متأخرين جداً
        try {
          match.decideSunDouble(match.opponentTeam, desperate);
          if (desperate) speak(BID_SPEECH.DOUBLE);
          afterAction();
        } catch (e) {
          console.error("[AI sunDouble]", e);
        }
      }, AI_DOUBLE_DELAY_MS);
    }
    // لو دور فريق الإنسان (هو الخصم)، ننتظر تفاعله عبر renderSunDoublingBar
    return;
  }

  if (match.phase === "playing" && AI_IDS.includes(match.turnPlayerID)) {
    aiActionPending = true;
    setTimeout(() => {
      aiActionPending = false;
      if (match.phase !== "playing") return;
      const playerID = match.turnPlayerID;
      const hand = match.hands.get(playerID);
      const isBuyerTeam = match.teamOfPlayer(playerID) === match.buyerTeam;
      const card = aiChooseCard(hand, match.currentTrick, match.trumpSuit, match.partnerOfID, playerID, match.tricksWon, isBuyerTeam);
      if (card) {
        try {
          match.playCard(playerID, card, false);
          sounds.playCard();
        } catch (e) {
          console.error("[AI] playCard unexpected:", e);
        }
      }
      afterAction();
    }, AI_PLAY_DELAY_MS);
    return;
  }
}
