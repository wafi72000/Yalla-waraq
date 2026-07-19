import { BalootMatch, HandRuleError, projectPointsOf } from "./engine.js";
import { BidChoice } from "./bidding.js";
import { DoubleLevel } from "./doubling.js";
import { Suit, Rank, rankDisplayName } from "./models.js";
import { ProjectType } from "./projects.js";
import { aiDecideBid, aiChooseCard, aiDecideDouble } from "./ai.js";
import { computeRawCardPoints } from "./scoring.js";

const HUMAN_ID = "human";
// ترتيب فيزيائي بعقارب الساعة: أنت(أسفل) -> سالم(يسار) -> خالد(فوق، شريكك) -> فهد(يمين) -> رجوع لك
const baseSeatOrder = [HUMAN_ID, "salem", "khaled", "fahad"];
const teamOfPlayer = (id) => (id === HUMAN_ID || id === "khaled") ? "A" : "B";
const AI_IDS = ["salem", "khaled", "fahad"];

const SUIT_SYMBOL = { hearts: "♥", diamonds: "♦", clubs: "♣", spades: "♠" };
const SEAT_ELEMENT_ID = { salem: "seatLeft", khaled: "seatTop", fahad: "seatRight" };
const SEAT_TRICK_POS = { human: "bottom", salem: "left", khaled: "top", fahad: "right" };

let match = null;

function $(id) { return document.getElementById(id); }

function suitIsRed(suit) { return suit === Suit.HEARTS || suit === Suit.DIAMONDS; }

const FACE_SUIT_NAME = { hearts: "heart", diamonds: "diamond", clubs: "club", spades: "spade" };
const RANK_FILE_NAME = { 11: "jack", 12: "queen", 13: "king", 14: "1" }; // الأص بترقيم ملفات SVG المصدر = 1

function cardImagePath(card) {
  const rankPart = RANK_FILE_NAME[card.rank] ?? String(card.rank);
  return `assets/faces/${FACE_SUIT_NAME[card.suit]}_${rankPart}.svg`;
}

function cardDisplay(card) {
  const div = document.createElement("div");
  div.className = "card card-image"; // رسمة حقيقية بدل النص - تمييز أوضح بكثير من الأرقام والحروف
  div.dataset.cardId = card.id;
  const img = document.createElement("img");
  img.src = cardImagePath(card);
  img.alt = `${rankDisplayName(card.rank)} ${SUIT_SYMBOL[card.suit]}`;
  img.draggable = false;
  div.appendChild(img);
  return div;
}

function displayName(id) {
  if (id === HUMAN_ID) return "أنت";
  const names = { salem: "سالم", khaled: "خالد", fahad: "فهد" };
  return names[id] ?? id;
}

function newMatch() {
  match = new BalootMatch(baseSeatOrder, teamOfPlayer);
  balootAnnounceActive = false;
  render();
  maybeRunAI();
}

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove("show"), 2000);
}

// ===== الرندر الرئيسي =====

function render() {
  $("startOverlay").classList.toggle("hidden", !!match);
  if (!match) return;
  renderScores();
  renderSeatsActiveTurn();
  renderCardBacks();
  renderCenterArea();
  renderBiddingBar();
  renderDoublingBar();
  renderProjectsBar();
  renderHand();
  renderBalootButton();
  renderOverlays();
}

function renderScores() {
  $("scoreUs").textContent = match.cumulativeScores.A;
  $("scoreThem").textContent = match.cumulativeScores.B;
  $("scoreboardUs").textContent = match.cumulativeScores.A;
  $("scoreboardThem").textContent = match.cumulativeScores.B;

  const badge = $("handPointsBadge");
  if (match.phase === "playing" || match.phase === "doubling" || match.phase === "handOver") {
    const typeLabel = match.isHukm ? `حكم ${SUIT_SYMBOL[match.trumpSuit]}` : "صن";
    let liveText = "";
    if (match.tricksWon.length > 0) {
      const live = computeRawCardPoints(match.tricksWon, match.trumpSuit, teamOfPlayer);
      liveText = ` — نقاط اليد الحالية: لنا ${live.A} - لهم ${live.B}`;
    }
    badge.textContent = `${typeLabel} — اشترى: ${displayName(match.buyerID)}${liveText}`;
  } else {
    badge.textContent = "";
  }
}

function renderSeatsActiveTurn() {
  for (const id of AI_IDS) {
    $(SEAT_ELEMENT_ID[id]).classList.remove("active-turn");
  }
  let activeID = null;
  if (match.phase === "bidding" && !match.bidding.isDead) activeID = match.bidding.currentPlayerID;
  else if (match.phase === "playing") activeID = match.turnPlayerID;
  if (activeID && AI_IDS.includes(activeID)) {
    $(SEAT_ELEMENT_ID[activeID]).classList.add("active-turn");
  }
}

function renderCardBacks() {
  for (const id of AI_IDS) {
    const hand = match.hands.get(id);
    const el = $(id === "salem" ? "leftCardCount" : id === "khaled" ? "topCardCount" : "rightCardCount");
    el.textContent = hand && hand.length > 0 ? `${hand.length} ورقة` : "";
  }
}

function renderCenterArea() {
  const flippedZone = $("flippedCardZone");
  flippedZone.innerHTML = "";
  if (match.phase === "bidding" && match.flippedCard) {
    flippedZone.appendChild(cardDisplay(match.flippedCard));
  }

  const trickZone = $("trickZone");
  trickZone.innerHTML = "";
  if (match.phase === "playing" || match.phase === "doubling") {
    for (const entry of match.currentTrick ?? []) {
      const el = cardDisplay(entry.card);
      el.classList.add("trick-card", `pos-${SEAT_TRICK_POS[entry.playerID]}`);
      trickZone.appendChild(el);
    }
  }

  const turnIndicator = $("turnIndicator");
  if (match.phase === "playing") {
    turnIndicator.textContent = match.turnPlayerID === HUMAN_ID ? "دورك" : `دور ${displayName(match.turnPlayerID)}`;
  } else if (match.phase === "bidding" && !match.bidding.isDead) {
    turnIndicator.textContent = match.bidding.currentPlayerID === HUMAN_ID ? "دورك بالمزايدة" : `مزايدة ${displayName(match.bidding.currentPlayerID)}`;
  } else if (match.bidding?.isDead) {
    turnIndicator.textContent = "صكّة ميتة - إعادة توزيع";
  } else {
    turnIndicator.textContent = "";
  }
}

// ===== المزايدة =====

function renderBiddingBar() {
  const bar = $("biddingBar");
  const picker = $("hukmSuitPicker");
  if (match.phase !== "bidding" || match.bidding.isDead || match.bidding.currentPlayerID !== HUMAN_ID) {
    bar.classList.add("hidden");
    if (match.phase !== "bidding") picker.classList.add("hidden");
    return;
  }
  bar.classList.remove("hidden");
  const pending = match.bidding.pendingHukm;
  const pendingText = pending
    ? ` — حالياً معلّق: ${displayName(pending.buyerID)} اشترى حكم (${SUIT_SYMBOL[pending.trumpSuit]}) — تقدر ترفعها بصن/اشكل`
    : "";
  $("biddingTitle").textContent = `المزايدة (الجولة ${match.bidding.round}) — الورقة المفروشة: ${SUIT_SYMBOL[match.flippedCard.suit]}${pendingText}`;

  const choices = match.bidding.availableChoices();
  const choicesEl = $("biddingChoices");
  choicesEl.innerHTML = "";
  const labels = {
    [BidChoice.HUKM]: match.bidding.round === 1 ? "حكم أول" : "حكم ثاني",
    [BidChoice.SUN]: "صن",
    [BidChoice.ASHKAL]: "اشكل",
    [BidChoice.PASS]: match.bidding.round === 1 ? "بس" : "ولا",
  };
  for (const choice of choices) {
    const btn = document.createElement("button");
    btn.className = "bid-btn";
    btn.textContent = labels[choice];
    btn.addEventListener("click", () => onHumanBid(choice));
    choicesEl.appendChild(btn);
  }
}

function onHumanBid(choice) {
  if (choice === BidChoice.HUKM && match.bidding.round === 2) {
    $("hukmSuitPicker").classList.remove("hidden");
    $("biddingBar").classList.add("hidden");
    document.querySelectorAll(".suit-btn").forEach((btn) => {
      btn.onclick = () => {
        $("hukmSuitPicker").classList.add("hidden");
        submitHumanBid(choice, btn.dataset.suit);
      };
    });
    return;
  }
  submitHumanBid(choice, null);
}

function submitHumanBid(choice, trumpSuitForHukm) {
  try {
    match.submitBid(HUMAN_ID, choice, trumpSuitForHukm);
    afterAction();
  } catch (e) {
    showToast(e.message);
  }
}

// ===== الدبل =====

function renderDoublingBar() {
  const bar = $("doublingBar");
  if (match.phase !== "doubling") { bar.classList.add("hidden"); return; }

  const humanTeam = teamOfPlayer(HUMAN_ID);
  bar.classList.remove("hidden");
  const levelNames = ["", "دبل", "ثري", "فور", "خمسة (قهوة)"];

  const choicesEl = $("doublingChoices");
  choicesEl.innerHTML = "";

  if (match.doubling.teamToActNext !== humanTeam) {
    $("doublingTitle").textContent = "الطرف الثاني يفكّر بالدبل...";
    return;
  }

  $("doublingTitle").textContent = match.doubling.level === 0
    ? "تبي تطلب دبل؟ (اختياري، بس بالحكم)"
    : `المستوى الحالي: ${levelNames[match.doubling.level]} — دورك ترد`;

  const nextBtn = document.createElement("button");
  nextBtn.className = "double-btn";
  const nextLabel = levelNames[match.doubling.level + 1];
  if (nextLabel && match.doubling.level < DoubleLevel.KAHWA) {
    nextBtn.textContent = `طلب ${nextLabel}`;
    nextBtn.addEventListener("click", () => {
      try {
        match.requestDouble(humanTeam);
        afterAction();
      } catch (e) {
        showToast(e.message);
      }
    });
    choicesEl.appendChild(nextBtn);
  }

  const proceedBtn = document.createElement("button");
  proceedBtn.className = "double-btn";
  proceedBtn.textContent = "ابدأ اللعب";
  proceedBtn.addEventListener("click", () => {
    match.proceedToPlay();
    afterAction();
  });
  choicesEl.appendChild(proceedBtn);
}

// ===== يد اللاعب =====

let balootAnnounceActive = false;

function renderHand() {
  const isMyTurnNow = match.phase === "playing" && match.turnPlayerID === HUMAN_ID;
  $("yourTurnBanner").classList.toggle("hidden", !isMyTurnNow);

  const row = $("handRow");
  row.innerHTML = "";
  if (!match.hands.has(HUMAN_ID)) return;
  const hand = [...match.hands.get(HUMAN_ID)].sort((a, b) => {
    if (a.suit !== b.suit) return a.suit.localeCompare(b.suit);
    return b.rank - a.rank;
  });

  const isMyTurn = match.phase === "playing" && match.turnPlayerID === HUMAN_ID;
  for (const card of hand) {
    const el = cardDisplay(card);
    if (!isMyTurn || !isCardLegalForHuman(card)) {
      el.classList.add("disabled");
    } else {
      el.addEventListener("click", () => onHumanPlayCard(card));
    }
    row.appendChild(el);
  }
}

function isCardLegalForHuman(card) {
  return match.isCardLegal(HUMAN_ID, card);
}

function onHumanPlayCard(card) {
  const isBalootCard = match.isHukm && card.suit === match.trumpSuit && (card.rank === Rank.KING || card.rank === Rank.QUEEN);
  const pressedBaloot = isBalootCard && balootAnnounceActive;
  try {
    match.playCard(HUMAN_ID, card, pressedBaloot);
    balootAnnounceActive = false;
    afterAction();
  } catch (e) {
    showToast(e.message);
  }
}

function renderBalootButton() {
  const wrap = $("balootBtnWrap");
  wrap.innerHTML = "";
  if (match.phase !== "playing" || match.turnPlayerID !== HUMAN_ID || !match.isHukm) return;
  const state = match.balootState?.get(HUMAN_ID);
  if (!state || !state.eligible || state.cardsPlayed.size !== 0 || balootAnnounceActive) return;
  const btn = document.createElement("button");
  btn.className = "baloot-announce-btn";
  btn.textContent = "بلوت! (اضغط، ثم ارمِ الشايب أو البنت)";
  btn.addEventListener("click", () => {
    balootAnnounceActive = true;
    showToast("جاهز - ارمِ الشايب أو البنت الحين لتأكيد البلوت");
    renderBalootButton();
  });
  wrap.appendChild(btn);
}

const PROJECT_NAME_AR = {
  [ProjectType.SIRA]: "سِرا",
  [ProjectType.KHAMSEEN]: "خمسين",
  [ProjectType.MIA]: "مية",
  [ProjectType.ARBAAMIA]: "أربعمية",
  [ProjectType.BALOOT]: "بلوت",
};

function renderProjectsBar() {
  const bar = $("projectsBar");
  if (!match.projectEntries || match.tricksWon.length > 0) {
    bar.classList.add("hidden");
    return;
  }
  bar.classList.remove("hidden");
  bar.innerHTML = "";

  const title = document.createElement("div");
  title.className = "bidding-title";
  const result = match.projectResult;
  if (result.winningTeam === null) {
    title.textContent = "المشاريع: لا أحد يملك مشروع";
  } else {
    const teamLabel = result.winningTeam === teamOfPlayer(HUMAN_ID) ? "لنا" : "لهم";
    const points = match.projectPoints[result.winningTeam];
    title.textContent = `المشاريع: ${teamLabel} (${points} نقطة) — ${result.reason}`;
  }
  bar.appendChild(title);

  const list = document.createElement("div");
  list.className = "bidding-choices";
  for (const entry of match.projectEntries) {
    if (!entry.project) continue;
    const chip = document.createElement("div");
    chip.className = "score-chip";
    const isWinner = teamOfPlayer(entry.playerID) === result.winningTeam;
    chip.style.opacity = isWinner ? "1" : "0.45"; // المشاريع الخاسرة تُعرض باهتة ("مشاريعك أرض")
    chip.textContent = `${displayName(entry.playerID)}: ${PROJECT_NAME_AR[entry.project.type]} (${projectPointsOf(entry.project)})`;
    list.appendChild(chip);
  }
  bar.appendChild(list);
}

// ===== النوافذ =====

function renderOverlays() {
  $("handEndOverlay").classList.toggle("hidden", match.phase !== "handOver");
  $("matchEndOverlay").classList.toggle("hidden", !match.matchOver);

  if (match.phase === "handOver") {
    const r = match.handResult;
    $("handEndTitle").textContent = r.isCapot ? "كابوت!" : r.isPending ? "تعادل معلّق" : r.isDefeat ? "خسف!" : "انتهت اليد";
    $("handEndDetails").textContent = `لنا: ${r.A} — لهم: ${r.B}`;
    $("handEndScoreTable").innerHTML = `<tr><td>المجموع التراكمي</td><td>لنا ${match.cumulativeScores.A} — لهم ${match.cumulativeScores.B}</td></tr>`;
  }

  if (match.matchOver) {
    const weWon = match.matchWinner === teamOfPlayer(HUMAN_ID);
    $("matchEndWinner").textContent = weWon ? "فزتم بالمباراة! 🎉" : "خسرتم المباراة";
    $("matchEndReason").textContent = match.matchEndReason;
  }
}

// ===== الدردشة السريعة =====

const QUICK_PHRASES = [
  "العب سريع! ⏱️",
  "مشاريعك أرض 😎",
  "قاطوع! ✂️",
  "جاك العلم 🔥",
  "بلوت! 🃏",
  "☕", // فنجان قهوة
  "🔴",
];

function showChatBubble(playerID, text) {
  const layer = $("chatBubbleLayer");
  const bubble = document.createElement("div");
  bubble.className = "chat-bubble";
  bubble.textContent = text;

  let anchorEl;
  if (playerID === HUMAN_ID) {
    anchorEl = $("handRow");
  } else {
    anchorEl = $(SEAT_ELEMENT_ID[playerID]).querySelector(".avatar");
  }
  const rect = anchorEl.getBoundingClientRect();
  bubble.style.left = `${rect.left + rect.width / 2}px`;
  bubble.style.top = `${rect.top}px`;

  layer.appendChild(bubble);
  (window.requestAnimationFrame ?? ((fn) => setTimeout(fn, 16)))(() => bubble.classList.add("show"));
  setTimeout(() => {
    bubble.classList.remove("show");
    setTimeout(() => bubble.remove(), 250);
  }, 2500);
}

$("chatToggleBtn").addEventListener("click", () => {
  $("chatPhrases").classList.toggle("hidden");
});

function renderChatPhrases() {
  const container = $("chatPhrases");
  container.innerHTML = "";
  for (const phrase of QUICK_PHRASES) {
    const btn = document.createElement("button");
    btn.className = "chat-phrase-btn";
    btn.textContent = phrase;
    btn.addEventListener("click", () => {
      showChatBubble(HUMAN_ID, phrase);
      container.classList.add("hidden");
      // الميزة اجتماعية بحتة - ما تؤثر على منطق اللعبة، مجرد بث بصري (نفس فلسفة التصميم الأصلية)
    });
    container.appendChild(btn);
  }
}
renderChatPhrases();

$("startMatchBtn").addEventListener("click", newMatch);
$("nextHandBtn").addEventListener("click", () => {
  balootAnnounceActive = false;
  match.advanceToNextHand();
  render();
  maybeRunAI();
});
$("newMatchBtn").addEventListener("click", newMatch);
$("scoreboardBtn").addEventListener("click", () => $("scoreboardOverlay").classList.remove("hidden"));
$("closeScoreboardBtn").addEventListener("click", () => $("scoreboardOverlay").classList.add("hidden"));

function afterAction() {
  render();
  if (match.phase === "playing" && match.tricksWon.length === 0 && !match.projectsResolved) {
    match.resolveProjects();
  }
  maybeRunAI();
}

// ===== حلقة الذكاء الاصطناعي =====

function announceAIBid(playerID, choice) {
  const name = displayName(playerID);
  if (choice === BidChoice.PASS) {
    showToast(`${name}: ${match.bidding?.round === 2 ? "ولا" : "بس"}`);
    return;
  }
  const labels = { [BidChoice.SUN]: "صن", [BidChoice.ASHKAL]: "اشكل", [BidChoice.HUKM]: "حكم" };
  showToast(`${name} اشترى ${labels[choice]}!`);
}

function maybeRunAI() {
  if (!match || match.matchOver) return;

  if (match.phase === "bidding" && !match.bidding.isDead) {
    const current = match.bidding.currentPlayerID;
    if (AI_IDS.includes(current)) {
      setTimeout(() => {
        if (match.phase !== "bidding") return;
        const hand = match.hands.get(current);
        const choices = match.bidding.availableChoices();
        const flippedSuit = match.flippedCard.suit;
        const decision = aiDecideBid(hand, choices, flippedSuit, match.bidding.round);
        try {
          match.submitBid(current, decision.choice, decision.trumpSuitForHukm);
          announceAIBid(current, decision.choice);
        } catch (e) {
          try { match.submitBid(current, BidChoice.PASS); } catch (e2) { console.error("[AI bid]", e2); }
        }
        afterAction();
      }, 500);
    }
    return;
  }

  if (match.bidding?.isDead && match.phase === "dead") {
    setTimeout(() => {
      match.advanceToNextHand();
      render();
      maybeRunAI();
    }, 1200);
    return;
  }

  if (match.phase === "doubling") {
    const teamToAct = match.doubling.teamToActNext;
    const humanTeam = teamOfPlayer(HUMAN_ID);
    if (teamToAct !== humanTeam) {
      // دور فريق AI بالكامل (سالم وفهد) - يقرر تلقائياً
      setTimeout(() => {
        if (match.phase !== "doubling") return;
        const aiMemberID = AI_IDS.find((id) => teamOfPlayer(id) === teamToAct);
        const hand = match.hands.get(aiMemberID);
        const role = teamToAct === match.opponentTeam ? "opponent" : "buyer";
        const wantsToDouble = aiDecideDouble(hand, match.trumpSuit, match.doubling.level, role, match.cumulativeScores, teamToAct);
        try {
          if (wantsToDouble) {
            match.requestDouble(teamToAct);
            afterAction();
          } else {
            match.proceedToPlay();
            afterAction();
          }
        } catch (e) {
          match.proceedToPlay();
          afterAction();
        }
      }, 700);
    }
    // لو دور فريق الإنسان، ننتظر تفاعله عبر renderDoublingBar (ما نسوي شي هنا)
    return;
  }

  if (match.phase === "playing" && AI_IDS.includes(match.turnPlayerID)) {
    setTimeout(() => {
      if (match.phase !== "playing") return;
      const playerID = match.turnPlayerID;
      const hand = match.hands.get(playerID);
      const card = aiChooseCard(hand, match.currentTrick, match.trumpSuit, match.partnerOfID, playerID, match.tricksWon);
      if (card) {
        try {
          match.playCard(playerID, card, false);
        } catch (e) {
          console.error("[AI] playCard unexpected:", e);
        }
      }
      afterAction();
    }, 700);
    return;
  }
}

render();
