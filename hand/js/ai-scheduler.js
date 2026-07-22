// ai-scheduler.js — جدولة دور الذكاء الاصطناعي (سحب/تنزيل/رمي) عبر setTimeout
// مسؤولية واحدة محدَّدة: "متى ياخذ AI دوره" - منفصل عن الرندر والأحداث

import { engine } from "./state.js";
import { HUMAN_ID, SEAT_BY_ID } from "./seats.js";
import { sounds } from "./sounds.js";
import { render, onRoundOver, onStuck } from "./app.js";

const AI_SPEEDS = { slow: 1200, medium: 500, fast: 150 };
let aiSpeed = "medium";
let aiTimer = null;

export function setAISpeed(speed) {
  aiSpeed = speed;
}

function oppSlotElementFor(playerID) {
  const seat = SEAT_BY_ID[playerID];
  return seat ? document.getElementById(`opp${seat}`) : null;
}

export function runAILoop() {
  const s = engine.state;
  if (s.isRoundOver) { render(); onRoundOver(); return; }
  if (s.isStuck) { render(); onStuck(); return; }
  if (s.currentTurnPlayerID === HUMAN_ID) { render(); return; }
  render();
  clearTimeout(aiTimer);
  const actingPlayerID = s.currentTurnPlayerID;
  const discardCountBefore = s.discardPile.length;
  aiTimer = setTimeout(() => {
    engine.performAITurn(actingPlayerID);
    sounds.draw();
    if (s.discardPile.length > discardCountBefore) sounds.discard();
    render();
    const slot = oppSlotElementFor(actingPlayerID);
    if (slot) {
      slot.classList.add("opp-acting");
      setTimeout(() => slot.classList.remove("opp-acting"), 260);
    }
    runAILoop();
  }, AI_SPEEDS[aiSpeed]);
}
