import { BalootMatch, HandRuleError, projectPointsOf } from "./engine.js";
import { BidChoice } from "./bidding.js";
import { DoubleLevel } from "./doubling.js";
import { Suit, Rank, rankDisplayName } from "./models.js";
import { ProjectType, detectBestProject } from "./projects.js";
import { aiDecideBid, aiChooseCard, aiDecideDouble } from "./ai.js";
import { computeRawCardPoints } from "./scoring.js";
import { speak, BID_SPEECH, PROJECT_SPEECH } from "./speech.js";
import { sounds } from "./sounds.js";

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

/// ينطق "أول" أو "ثاني" أول ما تبدأ/تنتقل جولة مزايدة جديدة - مرة وحدة بس لكل جولة (يتتبع آخر جولة نُطقت)
function announceBiddingRoundIfNew() {
  if (!match || match.phase !== "bidding" || match.bidding.isDead) return;
  const round = match.bidding.round;
  if (match._lastSpokenRound === round) return;
  match._lastSpokenRound = round;
  speak(round === 1 ? BID_SPEECH.ROUND_FIRST : BID_SPEECH.ROUND_SECOND);
}

function newMatch() {
  match = new BalootMatch(baseSeatOrder, teamOfPlayer);
  balootAnnounceActive = false;
  match._projectsRevealed = false;
  match._lastAnnouncedTurnKey = null;
  render();
  playDealingAnimation();
  maybeRunAI();
}

/// أنيميشن تزييني (بصري+صوتي) لتوزيع الورق ببداية كل يد - كل ورقة تطير من منتصف الطاولة نحو مقعدها
function playDealingAnimation() {
  const layer = $("dealFxLayer");
  if (!layer) return;
  const tableRect = $("tableArea")?.getBoundingClientRect();
  if (!tableRect) return;
  const centerX = tableRect.left + tableRect.width / 2;
  const centerY = tableRect.top + tableRect.height / 2;

  const targets = [
    $("handRow"), // أنت
    $(SEAT_ELEMENT_ID.khaled), // خالد (فوق)
    $(SEAT_ELEMENT_ID.salem),  // سالم
    $(SEAT_ELEMENT_ID.fahad),  // فهد
  ].filter(Boolean);
  if (targets.length === 0) return;

  const CARDS_PER_SEAT = 2; // تزييني بس - مو عدد حقيقي مطابق للتوزيع الفعلي
  let step = 0;
  const totalSteps = targets.length * CARDS_PER_SEAT;

  for (let round = 0; round < CARDS_PER_SEAT; round++) {
    for (const targetEl of targets) {
      const delay = step * 90;
      setTimeout(() => {
        const rect = targetEl.getBoundingClientRect();
        const targetX = rect.left + rect.width / 2;
        const targetY = rect.top + rect.height / 2;
        const mini = document.createElement("div");
        mini.className = "deal-fx-card";
        mini.style.left = `${centerX - 10}px`;
        mini.style.top = `${centerY - 14}px`;
        mini.style.opacity = "1";
        layer.appendChild(mini);
        sounds.dealCard();
        void mini.offsetWidth; // فورس ريفلو
        mini.style.transform = `translate(${targetX - centerX}px, ${targetY - centerY}px) scale(0.6)`;
        mini.style.opacity = "0.4";
        setTimeout(() => mini.remove(), 500);
      }, delay);
      step++;
    }
  }
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
  renderBuyerBadge();
  renderBiddingBar();
  renderDoublingBar();
  renderSunDoublingBar();
  renderHand();
  renderBalootButton();
  renderProjectsCheckButton();
  renderOverlays();
  announceTurnChangeIfNew();
  announceBiddingRoundIfNew();
}

/// يعلن دور اللاعب الحالي (AI بس) بفقاعة عند صورته مباشرة + صوت - بدل نص مركزي عام
/// يتأكد من عدم تكرار نفس الإعلان لنفس الدور بالضبط (مفتاح فريد لكل تركيبة شوط+ورقة+لاعب)
function announceTurnChangeIfNew() {
  if (!match || match.phase !== "playing" || match.completedTrick) return;
  if (match.turnPlayerID === HUMAN_ID) return; // بانر "دورك! اختر ورقة" فوق يدّك يغطّي حالة الإنسان أصلاً
  const key = `${match.tricksWon.length}_${match.currentTrick.length}_${match.turnPlayerID}`;
  if (match._lastAnnouncedTurnKey === key) return;
  match._lastAnnouncedTurnKey = key;
  showChatBubble(match.turnPlayerID, "دورك");
  speak(BID_SPEECH.TURN);
}

/// شارة دائمة تحت صورة المشتري (صن/حكم♥) تبقى طول اليد - بدل فقاعة مؤقتة تختفي بعد ثوانٍ
function renderBuyerBadge() {
  const badges = {
    khaled: $("topBuyerBadge"),
    salem: $("leftBuyerBadge"),
    fahad: $("rightBuyerBadge"),
    human: $("humanBuyerBadge"),
  };
  const showBadge = ["playing", "doubling", "sunDoubling", "handOver"].includes(match.phase) && match.buyerID;
  if (!showBadge) {
    for (const el of Object.values(badges)) el.classList.add("hidden");
    return;
  }
  const label = match.isHukm ? `حكم ${SUIT_SYMBOL[match.trumpSuit]}` : "صن";
  for (const [id, el] of Object.entries(badges)) {
    if (id === match.buyerID) {
      el.textContent = label;
      el.classList.remove("hidden");
    } else {
      el.classList.add("hidden");
    }
  }
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
  $("humanAvatarWrap").classList.remove("active-turn");
  let activeID = null;
  if (match.phase === "bidding" && !match.bidding.isDead) activeID = match.bidding.currentPlayerID;
  else if (match.phase === "playing") activeID = match.turnPlayerID;
  if (activeID && AI_IDS.includes(activeID)) {
    $(SEAT_ELEMENT_ID[activeID]).classList.add("active-turn");
  } else if (activeID === HUMAN_ID) {
    $("humanAvatarWrap").classList.add("active-turn");
  }
}

function renderCardBacks() {
  for (const id of AI_IDS) {
    const hand = match.hands.get(id);
    const count = hand?.length ?? 0;
    const seatEl = $(SEAT_ELEMENT_ID[id]);
    const countEl = $(id === "salem" ? "leftCardCount" : id === "khaled" ? "topCardCount" : "rightCardCount");
    countEl.textContent = count > 0 ? `${count} ورقة` : "";

    const fan = seatEl.querySelector(".card-fan");
    if (fan) {
      fan.style.display = count > 0 ? "" : "none";
      const minis = fan.querySelectorAll(".mini-card");
      const visibleCount = Math.min(minis.length, count); // ما نعرض أكثر مكوّنات من الورق الفعلي بيده
      minis.forEach((mini, i) => { mini.style.display = i < visibleCount ? "" : "none"; });
    }
  }
}

const trickCardElements = new Map(); // card.id -> DOM element - نفس فكرة كاش يدّك، يمنع هدم/إعادة بناء الصور بالميدان

let flippedCardElement = null; // كاش نفس عنصر الورقة المفروشة - يمنع الوميض (نفس مشكلة handRow/trickZone سابقاً)

function renderCenterArea() {
  const flippedZone = $("flippedCardZone");
  if (match.phase === "bidding" && match.flippedCard) {
    if (!flippedCardElement || flippedCardElement.dataset.cardId !== String(match.flippedCard.id)) {
      flippedZone.innerHTML = "";
      flippedCardElement = cardDisplay(match.flippedCard);
      flippedZone.appendChild(flippedCardElement);
    }
    // لو نفس الورقة (id) موجودة أصلاً بالـDOM، ما نلمسها إطلاقاً - يمنع أي إعادة تحميل للصورة
  } else {
    if (flippedZone.firstChild) flippedZone.innerHTML = "";
    flippedCardElement = null;
  }

  const trickZone = $("trickZone");
  const cardsToShow = (match.phase === "playing" || match.phase === "doubling")
    ? (match.completedTrick ?? match.currentTrick ?? [])
    : [];

  const currentIds = new Set(cardsToShow.map((e) => e.card.id));
  for (const [id, el] of trickCardElements) {
    if (!currentIds.has(id)) { el.remove(); trickCardElements.delete(id); }
  }
  for (const entry of cardsToShow) {
    let el = trickCardElements.get(entry.card.id);
    if (!el) {
      el = cardDisplay(entry.card);
      el.classList.add("trick-card", `pos-${SEAT_TRICK_POS[entry.playerID]}`);
      trickCardElements.set(entry.card.id, el);
      trickZone.appendChild(el);
    }
    // لو العنصر موجود أصلاً (من رندر سابق)، ما نلمسه إطلاقاً - يبقى مكانه وصورته وأي أنيميشن شغّالة عليه (animateTrickCollection)
  }

  const turnIndicator = $("turnIndicator");
  if (match.completedTrick) {
    turnIndicator.textContent = `${displayName(match.turnPlayerID)} أخذ الشوط`;
  } else if (match.phase === "playing") {
    // دور اللاعبين أثناء اللعب يُعلن بفقاعة عند صورتهم مباشرة (announceTurnChangeIfNew) - مو نص مركزي هنا
    turnIndicator.textContent = "";
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

/// ينطق قرار مزايدة معيّن، مراعياً الفرق حسب الجولة (حكم أول/ثاني، بس/ولا)
function speakBidChoice(choice, round) {
  const map = {
    [BidChoice.SUN]: BID_SPEECH.SUN,
    [BidChoice.ASHKAL]: BID_SPEECH.ASHKAL,
    [BidChoice.HUKM]: round === 1 ? BID_SPEECH.HUKM_FIRST : BID_SPEECH.HUKM_SECOND,
    [BidChoice.PASS]: round === 1 ? BID_SPEECH.PASS_ROUND1 : BID_SPEECH.PASS_ROUND2,
  };
  speak(map[choice] ?? "");
}

function submitHumanBid(choice, trumpSuitForHukm) {
  try {
    const round = match.bidding.round;
    match.submitBid(HUMAN_ID, choice, trumpSuitForHukm);
    speakBidChoice(choice, round);
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
        speak(nextLabel.replace(/\s*\(.*\)/, ""));
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

/// نافذة دبل الصن - منفصلة تماماً عن دبل الحكم: قرار وحيد يخص الخصم بس، بدون أي رد من المشتري
function renderSunDoublingBar() {
  const bar = $("sunDoublingBar");
  if (match.phase !== "sunDoubling") { bar.classList.add("hidden"); return; }

  const humanTeam = teamOfPlayer(HUMAN_ID);
  bar.classList.remove("hidden");
  const choicesEl = $("sunDoublingChoices");
  choicesEl.innerHTML = "";

  if (humanTeam !== match.opponentTeam) {
    $("sunDoublingTitle").textContent = "الخصم يقرر: دبل صن أو لعب عادي...";
    return;
  }

  $("sunDoublingTitle").textContent = "رصيدك يخوّلك دبل الصن (×2) - قرار وحيد، بدون رد من المشتري";

  const doubleBtn = document.createElement("button");
  doubleBtn.className = "double-btn";
  doubleBtn.textContent = "دبل صن (×2)";
  doubleBtn.addEventListener("click", () => {
    try {
      match.decideSunDouble(humanTeam, true);
      speak(BID_SPEECH.DOUBLE);
      afterAction();
    } catch (e) {
      showToast(e.message);
    }
  });
  choicesEl.appendChild(doubleBtn);

  const normalBtn = document.createElement("button");
  normalBtn.className = "double-btn";
  normalBtn.textContent = "لعب عادي";
  normalBtn.addEventListener("click", () => {
    try {
      match.decideSunDouble(humanTeam, false);
      afterAction();
    } catch (e) {
      showToast(e.message);
    }
  });
  choicesEl.appendChild(normalBtn);
}

// ===== يد اللاعب =====

let balootAnnounceActive = false;

const CARD_ASPECT_RATIO = 84 / 58; // نفس نسبة أبعاد صور الورق الحقيقية - نحافظ عليها دايماً عشان ما تنعصر الرسمة
const FIXED_CARD_WIDTH = 80; // حجم ثابت كبير دايماً - ما نصغّر الورقة نفسها أبداً، نتحكم بالتراكب بدلها
const HAND_GAP = 3;

/// يحسب تراكب الورق (لو لزم) عشان يتناسب دايماً بصف واحد بحجم كبير ثابت، بدل تصغير كل ورقة
/// نفس فكرة اللعب الحقيقي: يد فيها ورق كثير تتراكب جزئياً، بدل ما تصغر كل ورقة لدرجة يصعب تمييزها
function applyDynamicCardSize(row, cardCount) {
  if (cardCount === 0) return;
  const containerWidth = (row.parentElement?.clientWidth || row.clientWidth || window.innerWidth - 16) - 6; // هامش أمان يمنع أي طفح خارج الشاشة
  const height = Math.round(FIXED_CARD_WIDTH * CARD_ASPECT_RATIO);
  row.style.setProperty("--dynamic-card-w", `${FIXED_CARD_WIDTH}px`);
  row.style.setProperty("--dynamic-card-h", `${height}px`);

  if (cardCount <= 1) {
    row.dataset.cardStep = String(FIXED_CARD_WIDTH);
    return;
  }
  // مروحة الورق تدور حول نقطة ارتكاز بعيدة (FAN_PIVOT_DISTANCE) - الورقتان بالطرفين تنزاحان أفقياً
  // بمقدار FAN_PIVOT_DISTANCE * sin(الزاوية) بسبب الدوران، فوق وبعد التراكب العادي. لازم نحجز
  // هالمساحة الإضافية مسبقاً وإلا تطلع الأطراف خارج حاوية #app (اللي عندها overflow:hidden) - نفس البلاغ.
  const maxEdgeAngleDeg = ((cardCount - 1) / 2) * ARC_ANGLE_STEP;
  const fanOverflowPerSide = FAN_PIVOT_DISTANCE * Math.sin((maxEdgeAngleDeg * Math.PI) / 180);
  const desiredStep = FIXED_CARD_WIDTH - 40; // مسافة مفضّلة أضيق (كانت -22) - تقريب أكبر بين الورق
  const maxAllowedStep = (containerWidth - FIXED_CARD_WIDTH - 2 * fanOverflowPerSide) / (cardCount - 1);
  const step = Math.max(12, Math.min(desiredStep, maxAllowedStep)); // 12px حد أدنى (كان 20) - يسمح بتراكب أكبر لضمان الكل يفضل جوّه الشاشة
  row.dataset.cardStep = String(step);
}

const handCardElements = new Map(); // card.id -> DOM element - يُعاد استخدامها بين الرندرات، ما تُهدم إلا لو الورقة خرجت فعلياً من اليد
let selectedCardID = null; // الورقة "المرفوعة" حالياً (ضغطة أولى) - ضغطة ثانية عليها ترميها بالميدان فعلياً

const ARC_ANGLE_STEP = 2.5; // درجة دوران لكل خطوة عن المنتصف - مروحة خفيفة حول الأفاتار (كانت 4.5، لسه واسعة)
const FAN_PIVOT_DISTANCE = 450; // بكسل - المسافة من كل ورقة لنقطة الارتكاز المشتركة (كانت 320، لسه قريبة)
const SELECT_LIFT_PX = 18;  // كم ترتفع الورقة وقت اختيارها (ضغطة أولى) قبل رميها

function renderHand() {
  const isMyTurnNow = match.phase === "playing" && match.turnPlayerID === HUMAN_ID;
  $("yourTurnBanner").classList.toggle("hidden", !isMyTurnNow);

  const row = $("handRow");
  if (!match.hands.has(HUMAN_ID)) { row.innerHTML = ""; handCardElements.clear(); return; }
  const hand = [...match.hands.get(HUMAN_ID)].sort((a, b) => {
    if (a.suit !== b.suit) return a.suit.localeCompare(b.suit);
    return b.rank - a.rank;
  });

  applyDynamicCardSize(row, hand.length);
  const step = Number(row.dataset.cardStep) || FIXED_CARD_WIDTH;
  const isMyTurn = match.phase === "playing" && match.turnPlayerID === HUMAN_ID;

  // نحذف من الكاش أي ورقة ما عادت موجودة بيدّك (اتلعبت) - عنصرها يُهدم فعلياً
  const currentIds = new Set(hand.map((c) => c.id));
  for (const [id, el] of handCardElements) {
    if (!currentIds.has(id)) { el.remove(); handCardElements.delete(id); }
  }
  if (selectedCardID && !currentIds.has(selectedCardID)) selectedCardID = null; // الورقة المختارة اتلعبت أو خرجت - نصفّر الاختيار

  hand.forEach((card, index) => {
    let el = handCardElements.get(card.id);
    if (!el) {
      el = cardDisplay(card); // ورقة جديدة فعلياً بيدّك (توزيع جديد) - عنصر جديد مرة وحدة بس
      handCardElements.set(card.id, el);
    } else {
      el.className = "card card-image"; // نصفّر الفئات (not-playable/illegal القديمة) قبل نعيد تطبيقها بالأسفل - العنصر نفسه والصورة تبقى بدون إعادة تحميل
    }
    el.style.marginInlineStart = index > 0 ? `${step - FIXED_CARD_WIDTH}px` : "0";

    // مروحة حقيقية: نقطة ارتكاز واحدة بعيدة تحت الورق كله (عند موقع الأفاتار تقريباً) - نفس فيزياء
    // مروحة ورق حقيقية بإيدك (الدوران وحده ينتج القوس الطبيعي، بدون أي رفع مصطنع منفصل)
    // بما إن الصفحة RTL، أول عنصر بالمصفوفة يطلع أقصى اليمين بصرياً (مو اليسار) - نحسب الموضع البصري
    // الحقيقي (مو ترتيب المصفوفة الخام) عشان زاوية الميل تطلع صح على الطرفين بالتساوي
    const visualPos = hand.length - 1 - index; // 0 = أقصى اليسار بصرياً، الأكبر = أقصى اليمين
    const offsetFromCenter = visualPos - (hand.length - 1) / 2;
    const angle = offsetFromCenter * ARC_ANGLE_STEP;
    const isSelected = card.id === selectedCardID;
    const lift = isSelected ? -SELECT_LIFT_PX : 0;
    el.style.transformOrigin = `50% ${FAN_PIVOT_DISTANCE}px`;
    el.style.transform = `rotate(${angle}deg) translateY(${lift}px)`;
    el.style.zIndex = isSelected ? "999" : String(hand.length - index); // الورقة المرفوعة تعلو فوق أي تراكب مجاور

    el.onclick = null; // نمسح أي مستمع سابق قبل نقرر من جديد
    if (!isMyTurn) {
      el.classList.add("not-playable");
    } else if (!isCardLegalForHuman(card)) {
      el.classList.add("not-playable", "illegal");
    } else {
      el.onclick = () => {
        if (selectedCardID === card.id) {
          selectedCardID = null;
          onHumanPlayCard(card); // ضغطة ثانية على نفس الورقة المرفوعة - ترميها فعلياً
        } else {
          selectedCardID = card.id; // ضغطة أولى - بس ترفعها، ما ترميها
          renderHand();
        }
      };
    }
    row.appendChild(el); // appendChild لعنصر موجود أصلاً بس ينقل ترتيبه - ما يهدمه ولا يعيد تحميل الصورة
  });
}

function isCardLegalForHuman(card) {
  return match.isCardLegal(HUMAN_ID, card);
}

function onHumanPlayCard(card) {
  const isBalootCard = match.isHukm && card.suit === match.trumpSuit && (card.rank === Rank.KING || card.rank === Rank.QUEEN);
  const pressedBaloot = isBalootCard && balootAnnounceActive;
  try {
    match.playCard(HUMAN_ID, card, pressedBaloot);
    sounds.playCard();
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

// ===== النوافذ =====

function renderOverlays() {
  const showHandEnd = match.phase === "handOver" && !match.completedTrick;
  $("handEndOverlay").classList.toggle("hidden", !showHandEnd);
  $("matchEndOverlay").classList.toggle("hidden", !match.matchOver || !!match.completedTrick);

  if (showHandEnd) {
    const r = match.handResult;
    const b = r.breakdown ?? {};
    const humanTeam = teamOfPlayer(HUMAN_ID);
    const oppTeam = humanTeam === "A" ? "B" : "A";
    const usThem = (team) => (team === humanTeam ? "لنا" : "لهم");

    $("handEndTitle").textContent = r.isCapot ? "كابوت!" : r.isDefeat ? "خسران!" : "انتهت اليد";
    $("handEndDetails").textContent = `لنا: ${r.A} — لهم: ${r.B}`;

    const rows = [];
    if (r.isCapot && b.capotTeam) {
      rows.push(`<tr><td>كابوت (${usThem(b.capotTeam)})</td><td>${b.capotBasePoints} نقطة</td></tr>`);
    } else if (b.cardPointsRaw) {
      rows.push(`<tr><td>الأبناط (لنا)</td><td>${b.cardPointsRaw[humanTeam] ?? 0}</td></tr>`);
      rows.push(`<tr><td>الأبناط (لهم)</td><td>${b.cardPointsRaw[oppTeam] ?? 0}</td></tr>`);
      if (b.lastTrickTeam) {
        rows.push(`<tr><td>آخر أكلة (الأرض)</td><td>${usThem(b.lastTrickTeam)} +${b.lastTrickBonus}</td></tr>`);
      }
    }
    if (b.projectPointsByTeam) {
      const winningTeam = b.projectPointsByTeam.A > 0 ? "A" : b.projectPointsByTeam.B > 0 ? "B" : null;
      if (winningTeam) {
        rows.push(`<tr><td>المشاريع</td><td>${usThem(winningTeam)} +${b.projectPointsByTeam[winningTeam]}</td></tr>`);
      }
    }
    if (b.balootPointsByTeam?.[humanTeam]) rows.push(`<tr><td>بلوت (لنا)</td><td>+${b.balootPointsByTeam[humanTeam]}</td></tr>`);
    if (b.balootPointsByTeam?.[oppTeam]) rows.push(`<tr><td>بلوت (لهم)</td><td>+${b.balootPointsByTeam[oppTeam]}</td></tr>`);
    if (b.doubleMultiplier > 1) rows.push(`<tr><td>معامل الدبل</td><td>×${b.doubleMultiplier}</td></tr>`);
    rows.push(`<tr><td>المجموع التراكمي</td><td>لنا ${match.cumulativeScores.A} — لهم ${match.cumulativeScores.B}</td></tr>`);

    $("handEndScoreTable").innerHTML = rows.join("");
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

// ===== زر "المشاريع" التفاعلي - تختار مشروعك بنفسك، والنظام يتحقق فعلياً (بدل الكشف التلقائي بس) =====

$("projectsCheckToggleBtn").addEventListener("click", () => {
  $("projectsCheckMenu").classList.toggle("hidden");
});

/// يعيد بناء قائمة أنواع المشاريع الممكنة - أربعمية تظهر بس بالصن (قاعدة أربعة آسات صن فقط)
function renderProjectsCheckMenu() {
  const menu = $("projectsCheckMenu");
  menu.innerHTML = "";
  const types = match?.isHukm
    ? [ProjectType.SIRA, ProjectType.KHAMSEEN, ProjectType.MIA]
    : [ProjectType.SIRA, ProjectType.KHAMSEEN, ProjectType.MIA, ProjectType.ARBAAMIA];
  const points = { [ProjectType.SIRA]: 20, [ProjectType.KHAMSEEN]: 50, [ProjectType.MIA]: 100, [ProjectType.ARBAAMIA]: 400 };
  for (const type of types) {
    const btn = document.createElement("button");
    btn.className = "chat-phrase-btn";
    btn.textContent = `${PROJECT_NAME_AR[type]} (${points[type]})`;
    btn.addEventListener("click", () => onProjectCheckSelected(type));
    menu.appendChild(btn);
  }
}

/// يتحقق فعلياً: هل يدّك تحتوي المشروع اللي اخترته؟ (يقارن بأقوى مشروع فعلي بيدّك، نفس منطق الكشف التلقائي)
function onProjectCheckSelected(chosenType) {
  $("projectsCheckMenu").classList.add("hidden");
  if (!match?.hands?.has(HUMAN_ID)) return;
  const actual = detectBestProject(match.hands.get(HUMAN_ID), match.isHukm);
  if (actual && actual.type === chosenType) {
    showToast(`✅ صحيح! عندك ${PROJECT_NAME_AR[chosenType]}`);
    showChatBubble(HUMAN_ID, PROJECT_NAME_AR[chosenType]);
    speak(PROJECT_SPEECH[chosenType] ?? PROJECT_NAME_AR[chosenType]);
  } else {
    showToast(`❌ ما عندك ${PROJECT_NAME_AR[chosenType]}`);
  }
}

/// الزر يظهر بس بالجولة الأولى (قبل اكتمال أول شوط) - نفس نافذة الإعلان الحقيقية بالقانون
function renderProjectsCheckButton() {
  const btn = $("projectsCheckToggleBtn");
  const shouldShow = match && match.phase === "playing" && match.tricksWon.length === 0;
  btn.classList.toggle("hidden", !shouldShow);
  if (shouldShow) renderProjectsCheckMenu();
  else $("projectsCheckMenu").classList.add("hidden");
}

$("startMatchBtn").addEventListener("click", newMatch);
$("nextHandBtn").addEventListener("click", () => {
  balootAnnounceActive = false;
  match.advanceToNextHand();
  match._lastSpokenRound = null;
  match._projectsRevealed = false;
  match._lastAnnouncedTurnKey = null;
  render();
  playDealingAnimation();
  maybeRunAI();
});
$("newMatchBtn").addEventListener("click", newMatch);
$("scoreboardBtn").addEventListener("click", () => $("scoreboardOverlay").classList.remove("hidden"));
$("homeBtn").addEventListener("click", (e) => {
  if (match && !match.matchOver) {
    const sure = confirm("فيه مباراة شغّالة الحين - تقدّمك بينحذف لو رجعت للرئيسية. متأكد؟");
    if (!sure) e.preventDefault();
  }
});
$("closeScoreboardBtn").addEventListener("click", () => $("scoreboardOverlay").classList.add("hidden"));

// سرعة لعب الـAI الموحّدة - متوسطة، تعطي وقت كافي لملاحظة الورقة المفروشة وآخر ورقة تُلعب
const AI_BID_DELAY_MS = 1200;    // قرار مزايدة (كان 500 - سريع جداً، يصعّب متابعة الورقة المفروشة)
const AI_DOUBLE_DELAY_MS = 1200; // قرار دبل/دبل صن (كان 700)
const AI_PLAY_DELAY_MS = 1400;   // رمي ورقة أثناء اللعب (كان 1200)
const TRICK_PAUSE_MS = 3000;     // وقفة كافية يشوف فيها كل اللاعبين الشوط كامل (بما فيها ورقة آخر لاعب) قبل ما ينكسح (كانت 2500)

/// كل لاعب معه مشروع يعلنه بفقاعة كلام فوق صورته + صوت - بترتيب متتابع (900ms بينهم) عشان الأصوات ما تتقاطع
/// هذا يصير بالجولة (الشوط) الأولى بس - الكشف الفعلي للورق يتأخر للجولة الثانية (انظر revealWinningProjectCards)
function announceProjectsSequentially() {
  if (!match.projectEntries) return;
  const withProjects = match.projectEntries.filter((e) => e.project);
  withProjects.forEach((entry, i) => {
    setTimeout(() => {
      if (!match) return;
      const name = PROJECT_NAME_AR[entry.project.type];
      showChatBubble(entry.playerID, name);
      speak(PROJECT_SPEECH[entry.project.type] ?? name);
    }, i * 900);
  });
}

/// يعرض ورق صاحب أقوى مشروع فعلياً (صور حقيقية) لمدة كافية، فوق مقعده - يثبت للجميع صحة مشروعه
function revealWinningProjectCards(entry) {
  const layer = $("chatBubbleLayer");
  if (!layer || !entry?.project) return;
  const seatEl = entry.playerID === HUMAN_ID ? $("handRow") : $(SEAT_ELEMENT_ID[entry.playerID]);
  if (!seatEl) return;
  const rect = seatEl.getBoundingClientRect();

  const panel = document.createElement("div");
  panel.className = "project-reveal";
  const title = document.createElement("div");
  title.className = "project-reveal-title";
  title.textContent = `${displayName(entry.playerID)}: ${PROJECT_NAME_AR[entry.project.type]}`;
  panel.appendChild(title);
  const cardsRow = document.createElement("div");
  cardsRow.className = "project-reveal-cards";
  for (const card of entry.project.cards) cardsRow.appendChild(cardDisplay(card));
  panel.appendChild(cardsRow);

  panel.style.left = `${rect.left + rect.width / 2}px`;
  panel.style.top = `${Math.max(10, rect.top - 10)}px`;
  layer.appendChild(panel);
  (window.requestAnimationFrame ?? ((fn) => setTimeout(fn, 16)))(() => panel.classList.add("show"));
  setTimeout(() => {
    panel.classList.remove("show");
    setTimeout(() => panel.remove(), 300);
  }, 3200);
}

function afterAction() {
  render();
  if (match.phase === "playing" && match.tricksWon.length === 0 && !match.projectsResolved) {
    match.resolveProjects();
    announceProjectsSequentially();
    render(); // نعيد الرندر عشان شريط المشاريع يعكس النتيجة فوراً
  }
  if (match.completedTrick) {
    sounds.takeTrick();
    // شوط اكتمل للتو - ننتظر وقفة واضحة قبل ما نكسحه ونكمل اللعب، عشان كل لاعب يشوف الأربع ورقات كاملة
    const COLLECT_ANIM_MS = 350;
    setTimeout(() => {
      if (!match || !match.completedTrick) return; // احتياط لو تغيّرت الحالة بطريقة ثانية بالأثناء
      animateTrickCollection(match.turnPlayerID); // الفائز بالشوط (turnPlayerID محدّث له أصلاً بالمحرك)
      setTimeout(() => {
        if (!match || !match.completedTrick) return;
        const justFinishedFirstTrick = match.tricksWon.length === 1;
        match.clearCompletedTrick();
        render();
        // بداية الجولة الثانية بالضبط - صاحب أقوى مشروع يكشف ورقه فعلياً هنا (مو بالجولة الأولى وقت الإعلان)
        if (justFinishedFirstTrick && match.winningProjectEntry && !match._projectsRevealed) {
          match._projectsRevealed = true;
          revealWinningProjectCards(match.winningProjectEntry);
        }
        maybeRunAI();
      }, COLLECT_ANIM_MS);
    }, Math.max(0, TRICK_PAUSE_MS - COLLECT_ANIM_MS));
    return;
  }
  maybeRunAI();
}

/// ينزلق الورق المعروض بالميدان نحو مقعد الفائز بالشوط (يذوب ويصغر بالتزامن) - تأثير بصري لـ"أخذ الجولة"
function animateTrickCollection(winnerID) {
  const trickZone = $("trickZone");
  const cards = trickZone?.querySelectorAll(".trick-card");
  if (!cards || cards.length === 0) return;
  const targetEl = winnerID === HUMAN_ID ? $("handRow") : $(SEAT_ELEMENT_ID[winnerID]);
  if (!targetEl) return;
  const targetRect = targetEl.getBoundingClientRect();
  const targetX = targetRect.left + targetRect.width / 2;
  const targetY = targetRect.top + targetRect.height / 2;
  cards.forEach((card) => {
    const rect = card.getBoundingClientRect();
    // نحوّل الورقة لموضع ثابت (fixed) بنفس مكانها الحالي بالضبط - يتفادى أي تعارض مع transform الأصلي
    // الخاص بتموضعها (pos-top/left/right/bottom)، ونحرّكها بحرية عبر left/top بدل transform
    card.style.position = "fixed";
    card.style.left = `${rect.left}px`;
    card.style.top = `${rect.top}px`;
    card.style.margin = "0";
    card.style.transform = "none";
    card.style.transition = "left 0.35s ease-in, top 0.35s ease-in, opacity 0.35s ease-in, scale 0.35s ease-in";
    card.style.zIndex = "95";
    void card.offsetWidth; // فورس ريفلو - يضمن المتصفح يلتقط القيم الحالية قبل بدء الانتقال للهدف
    card.style.left = `${targetX - rect.width / 2}px`;
    card.style.top = `${targetY - rect.height / 2}px`;
    card.style.opacity = "0";
    card.style.scale = "0.35"; // خاصية scale مستقلة (مدعومة بالمتصفحات الحديثة) - تتفادى تعارض transform تماماً
  });
}

// ===== حلقة الذكاء الاصطناعي =====

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

function maybeRunAI() {
  if (!match || match.matchOver) return;
  if (match.completedTrick) return; // شوط لسه ينتظر يُكسح - ننتظر afterAction تتولى الوقفة والاستمرار

  if (match.phase === "bidding" && !match.bidding.isDead) {
    const current = match.bidding.currentPlayerID;
    if (AI_IDS.includes(current)) {
      setTimeout(() => {
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
    setTimeout(() => {
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
      setTimeout(() => {
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
      setTimeout(() => {
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
    setTimeout(() => {
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

render();
