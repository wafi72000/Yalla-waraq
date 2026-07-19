import { Suit, SUIT_SYMBOL, isRedSuit, rankDisplayName } from "./models.js";
import { MeldKind, isValidSet, isValidRun } from "./meld.js";
import { HandEngine, DrawSource, HandRuleError } from "./engine.js";
import "./declareEngine.js";
import { scoreTier, tierLabel } from "./endingEngine.js";
import "./ai.js";
import { EndingType } from "./escalation.js";
import { totalPoints } from "./scoring.js";
import { sounds } from "./sounds.js";

const HUMAN_ID = "human";

const players = [
  { id: HUMAN_ID, name: "أنت", hand: [] },
  { id: "ai3", name: "فهد", hand: [] },  // يلعب بعدك مباشرة (مقعده الثابت يمينك)
  { id: "ai2", name: "خالد", hand: [] }, // ثاني (مقعده الثابت قبالتك)
  { id: "ai1", name: "سالم", hand: [] }, // آخر واحد قبل ما يرجع لك (مقعده الثابت يسارك)
];

// مقعد كل لاعب على الطاولة - ثابت بالاسم/المعرّف، مستقل تماماً عن ترتيب الأدوار بالأعلى
const SEAT_BY_ID = { ai1: "Left", ai2: "Top", ai3: "Right" };

const engine = new HandEngine(players);

// منع تكبير الشاشة بالكامل (نقرتين متتاليتين أو إصبعين) - بعض متصفحات iOS تتجاهل user-scalable=no
document.addEventListener("dblclick", (e) => e.preventDefault());
document.addEventListener("gesturestart", (e) => e.preventDefault());

let selectedCardIds = new Set();
let aiTimer = null;

// ===== أدوات DOM =====
const $ = (id) => document.getElementById(id);

const FACE_SUIT_NAME = {
  [Suit.HEARTS]: "heart",
  [Suit.DIAMONDS]: "diamond",
  [Suit.CLUBS]: "club",
  [Suit.SPADES]: "spade",
};
const RANK_FILE_NAME = { 11: "jack", 12: "queen", 13: "king", 14: "1" }; // الأص بترقيم المصدر = 1

function cardImagePath(card) {
  if (card.isJoker) return "assets/faces/joker.svg";
  const rankPart = RANK_FILE_NAME[card.rank] ?? String(card.rank);
  return `assets/faces/${FACE_SUIT_NAME[card.suit]}_${rankPart}.svg`;
}

function cardEl(card, { mini = false, selected = false } = {}) {
  const div = document.createElement("div");
  div.className = "card" + (mini ? " mini" : "");
  div.dataset.cardId = card.id;

  // صورة حقيقية لكل الورق (نفس مصدر الصور الاحترافي)، بحجم كامل أو مصغّر (mini) حسب السياق
  const img = document.createElement("img");
  img.src = cardImagePath(card);
  img.alt = card.isJoker ? "جوكر" : `${rankDisplayName(card.rank)} ${SUIT_SYMBOL[card.suit]}`;
  img.className = "face-card-img";
  img.draggable = false;
  div.appendChild(img);
  if (!card.isJoker && isRedSuit(card.suit)) div.classList.add("red");
  if (card.isJoker) div.classList.add("joker");

  if (selected) div.classList.add("selected");
  return div;
}

function showToast(message) {
  sounds.invalid();
  const toast = $("toast");
  toast.textContent = message;
  positionFloatingMessages();
  toast.classList.add("show");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove("show"), 2200);
}

// ===== الرسم =====

function render() {
  renderHandScorePanel();
  renderOpponents();
  renderMelds();
  fitAllMeldZones();
  renderPiles();
  renderHand();
  renderActionBar();
  renderTurnBubbles();
  positionFloatingMessages();
  alignSideOpponentsWithPiles();
}

/// كل منطقة بيرات (خالد/أنت/سالم/فهد) مساحتها ثابتة للأبد - لو ورق اللاعب احتاج أكثر من المساحة المتاحة،
/// يصغّر تلقائياً (transform:scale) بدل يقطع أو يكبّر الطاولة. كل لاعب يتصغّر لحاله حسب كمية بيراته بس.
function fitMeldZone(containerId, maxHeight, minScale = 0.45) {
  const el = $(containerId);
  if (!el) return;
  el.style.transform = "none";
  el.style.height = "";
  if (!el.firstElementChild) return; // فاضي - ما يحتاج تحجيم
  const natural = el.scrollHeight;
  if (natural <= maxHeight) return; // يتسع طبيعي بحجمه الكامل
  const scale = Math.max(minScale, maxHeight / natural);
  el.style.transformOrigin = "top center";
  el.style.transform = `scale(${scale})`;
  el.style.height = `${natural * scale}px`;
}
function fitAllMeldZones() {
  fitMeldZone("meldsTop", 100);
  fitMeldZone("meldsBottom", 100);
  fitMeldZone("meldsLeft", 130);
  fitMeldZone("meldsRight", 130);
}

/// يحدّد مكان فقاعة دورك وصندوق المجموع بالضبط تحت منطقة الطاولة (ثابتة الارتفاع) - عشان ظهورهم/اختفاءهم
/// ما يأثر إطلاقاً على باقي العناصر (كانوا قبل داخل التخطيط الطبيعي فيحرّكون يد اللاعب لفوق وتحت)
function positionFloatingMessages() {
  const tableArea = document.querySelector(".table-area");
  if (!tableArea) return;
  const rect = tableArea.getBoundingClientRect();
  if (rect.height === 0) return; // jsdom أو لسه ما رُسم
  const top = rect.bottom + 4;
  $("selfTurnBubble").style.top = `${top}px`;
  $("totalPointsBar").style.top = `${top + 30}px`;
  $("toast").style.top = `${top + 64}px`;
}
/// يمنع أي تراكب لو تغيّر ارتفاع منطقة الطاولة (مثلاً لما تختلف كمية البيرات المعروضة)
function alignSideOpponentsWithPiles() {
  const tableLayout = $("tableLayout");
  const pilesRow = $("pilesRow");
  const oppLeft = $("oppLeft");
  const oppRight = $("oppRight");
  if (!tableLayout || !pilesRow || !oppLeft || !oppRight) return;

  const layoutRect = tableLayout.getBoundingClientRect();
  const pilesRect = pilesRow.getBoundingClientRect();
  if (layoutRect.height === 0 || pilesRect.height === 0) return; // jsdom أو لسه ما رُسم

  const targetCenterY = pilesRect.top + pilesRect.height / 2 - layoutRect.top;
  for (const el of [oppLeft, oppRight]) {
    const elHeight = el.getBoundingClientRect().height || 90;
    el.style.top = `${targetCenterY - elHeight / 2}px`;
    el.style.transform = "none";
  }

  // نضمن عمود بيرات سالم/فهد ما يتداخل مع الأفاتار فعلياً - نقيس المكان الحقيقي بدل نخمّن بهامش ثابت
  const GAP = 6;
  const meldsLeft = $("meldsLeft");
  const meldsRight = $("meldsRight");
  if (meldsLeft) {
    meldsLeft.style.marginLeft = "0px"; // ريسيت قبل القياس عشان ما يتراكم الهامش مع كل render
    const overlap = oppLeft.getBoundingClientRect().right + GAP - meldsLeft.getBoundingClientRect().left;
    if (overlap > 0) meldsLeft.style.marginLeft = `${overlap}px`;
  }
  if (meldsRight) {
    meldsRight.style.marginRight = "0px";
    const overlap = meldsRight.getBoundingClientRect().right + GAP - oppRight.getBoundingClientRect().left;
    if (overlap > 0) meldsRight.style.marginRight = `${overlap}px`;
  }
}

let lastAnnouncedTurnKey = null;

function flashBubble(el, text, urgent) {
  if (!el) return;
  el.textContent = text;
  el.classList.toggle("urgent", !!urgent);
  el.classList.remove("show");
  void el.offsetWidth; // فورس reflow عشان الأنيميشن يبدأ من جديد لو نفس العنصر تفعّل مرتين بسرعة
  el.classList.add("show");
  clearTimeout(el._hideTimer);
  el._hideTimer = setTimeout(() => el.classList.remove("show"), 1500);
}

function renderTurnBubbles() {
  const s = engine.state;
  const isHuman = s.currentTurnPlayerID === HUMAN_ID;
  const key = isHuman ? `human:${s.hasDrawnThisTurn}` : s.currentTurnPlayerID;
  if (key === lastAnnouncedTurnKey) return; // نفس حالة الدور السابقة - ما نكرر الفقاعة
  lastAnnouncedTurnKey = key;

  if (isHuman) {
    const urgent = s.hasDrawnThisTurn;
    flashBubble($("selfTurnBubble"), urgent ? "⚠️ يجب الرمي" : "🎯 دورك - اسحب", urgent);
  } else {
    const player = s.player(s.currentTurnPlayerID);
    const seat = SEAT_BY_ID[s.currentTurnPlayerID];
    flashBubble($(`opp${seat}Bubble`), `دور ${player?.name ?? ""}`);
  }
}

function renderHandScorePanel() {
  const s = engine.state;
  $("roundBadge").textContent = `الجولة: ${s.roundNumber}/${s.totalRounds}`;
  const opponents = s.players.filter((p) => p.id !== HUMAN_ID);
  const scoreMap = [
    ...opponents.map((p) => ({ player: p, el: $(`score${SEAT_BY_ID[p.id]}`) })),
    { player: s.player(HUMAN_ID), el: $("scoreBottom") },
  ];
  const best = Math.min(...s.players.map((p) => s.cumulativeScores.get(p.id) ?? 0));
  for (const { player, el } of scoreMap) {
    if (!player) continue;
    const score = s.cumulativeScores.get(player.id) ?? 0;
    el.textContent = score;
    el.classList.toggle("leader", score === best);
  }
}

/// أول حرف من اسم اللاعب - يُستخدم بدل صورة شخصية حقيقية
function avatarLetter(name) {
  return name?.trim()?.charAt(0) ?? "؟";
}

function renderOpponents() {
  const s = engine.state;
  const opponents = s.players.filter((p) => p.id !== HUMAN_ID);
  const fanDirBySeat = { Left: "point-right", Top: "point-down", Right: "point-left" };
  const slotMap = opponents.map((player) => ({
    player,
    slotEl: $(`opp${SEAT_BY_ID[player.id]}`),
    el: $(`opp${SEAT_BY_ID[player.id]}Content`),
    fanDir: fanDirBySeat[SEAT_BY_ID[player.id]],
  }));

  for (const { player, slotEl, el, fanDir } of slotMap) {
    el.innerHTML = "";
    if (!player) continue;
    slotEl.classList.toggle("active", s.currentTurnPlayerID === player.id);

    const nameEl = document.createElement("div");
    nameEl.className = "opponent-name" + (s.declaration.isPlayerInRace(player.id) ? " in-race" : "");
    nameEl.textContent = player.name;

    const circle = document.createElement("div");
    circle.className = "opp-circle";
    circle.textContent = avatarLetter(player.name);

    const fan = document.createElement("div");
    fan.className = "opp-fan " + fanDir;
    const shown = Math.min(player.hand.length, 7); // نحدد المروحة بـ7 ورقات بصرياً بحد أقصى
    const spread = 16; // درجة بين كل ورقة وثانية
    const startAngle = -((shown - 1) * spread) / 2;
    for (let i = 0; i < shown; i++) {
      const back = document.createElement("div");
      back.className = "card-back fan";
      back.style.transform = `translateX(-50%) rotate(${startAngle + i * spread}deg)`;
      fan.appendChild(back);
    }

    const seat = SEAT_BY_ID[player.id];
    if (seat === "Top") {
      el.append(nameEl, circle, fan); // ترتيب خالد الأصلي - ما يتغيّر
    } else {
      const avatarRow = document.createElement("div");
      avatarRow.className = "avatar-row";
      avatarRow.append(fan, circle);
      el.append(avatarRow, nameEl); // سالم/فهد: الاسم تحت الأفاتار بوضوح
    }
  }
}

function meldsContainerFor(playerID) {
  if (playerID === HUMAN_ID) return $("meldsSelf");
  const seat = SEAT_BY_ID[playerID];
  return seat ? $(`melds${seat}`) : null;
}

function renderMelds() {
  const s = engine.state;
  for (const id of ["meldsTop", "meldsLeft", "meldsRight", "meldsSelf"]) {
    $(id).innerHTML = "";
  }
  const byOwner = new Map();
  for (const m of s.exposedMelds) {
    if (!byOwner.has(m.declaredByPlayerID)) byOwner.set(m.declaredByPlayerID, []);
    byOwner.get(m.declaredByPlayerID).push(m);
  }
  for (const player of s.players) {
    const melds = byOwner.get(player.id);
    if (!melds || melds.length === 0) continue; // ما نعرض شي للاعب لسه ما نزّل - يبقى مكانه فاضي
    const container = meldsContainerFor(player.id);
    if (!container) continue;
    const group = document.createElement("div");
    group.className = "meld-group";
    const label = document.createElement("div");
    label.className = "meld-owner";
    const points = s.declaration.declaredTotals.get(player.id);
    label.textContent = points != null ? `${player.name} - ${points}` : player.name;
    group.appendChild(label);
    for (const meld of melds) {
      const row = document.createElement("div");
      row.className = "meld-cards";
      for (const card of meld.cards) {
        const el = cardEl(card, { mini: true });
        el.dataset.meldId = meld.id;
        el.addEventListener("click", () => onMeldCardClick(meld));
        row.appendChild(el);
      }
      group.appendChild(row);
    }
    container.appendChild(group);
  }
}

function renderPiles() {
  const s = engine.state;
  $("stockCount").textContent = `الدِّستة (${s.drawPile.count})`;
  const stockPile = $("stockPile");
  stockPile.classList.toggle("disabled", !isHumanTurn() || s.hasDrawnThisTurn);

  const discardSlot = $("discardSlot");
  discardSlot.innerHTML = "";
  const top = s.discardPile[s.discardPile.length - 1];
  const locked = !s.isLeftDiscardUnlocked;
  discardSlot.classList.toggle("disabled", !isHumanTurn() || s.hasDrawnThisTurn || locked);
  if (top) {
    const el = cardEl(top);
    if (locked) el.style.filter = "grayscale(1) opacity(0.6)";
    discardSlot.appendChild(el);
  }
}

/// يكشف مجموعات متتالية بيد اللاعب تشكّل بيراً صحيحاً (Set/Run) لو رُصّت جنب بعضها
function detectMeldGroups(hand) {
  const groups = [];
  let i = 0;
  while (i < hand.length) {
    let bestLen = 0;
    const maxWindow = Math.min(hand.length - i, 8);
    for (let w = maxWindow; w >= 3; w--) {
      const slice = hand.slice(i, i + w);
      if (isValidSet(slice) || isValidRun(slice)) { bestLen = w; break; }
    }
    if (bestLen >= 3) {
      groups.push({ start: i, end: i + bestLen - 1 });
      i += bestLen;
    } else {
      i += 1;
    }
  }
  return groups;
}

let rowSplitIndex = null; // فهرس انقسام الصفين - يتغيّر فقط لما المستخدم يسحب ورقة بين الصفوف، مش بصيغة ثابتة

/// يرجع فهرس انقسام الصفين الحالي، ويصلحه لو طول اليد تغيّر (سحب/رمي/نزول) بشكل يخرجه عن النطاق
function currentSplit(handLength) {
  if (rowSplitIndex === null) {
    rowSplitIndex = Math.ceil(handLength / 2);
  }
  rowSplitIndex = Math.max(0, Math.min(rowSplitIndex, handLength));
  return rowSplitIndex;
}

function renderHand() {
  const s = engine.state;
  const human = s.player(HUMAN_ID);
  const topRow = $("handRowTop");
  const bottomRow = $("handRowBottom");
  if (!dragState) $("dragLayer").innerHTML = ""; // تنظيف دفاعي: أي نسخة طيف معلّقة من سحب سابق ما اكتمل تنظيفه
  topRow.innerHTML = "";
  bottomRow.innerHTML = "";
  const groups = detectMeldGroups(human.hand);
  const splitPoint = currentSplit(human.hand.length);

  human.hand.forEach((card, idx) => {
    const el = cardEl(card, { selected: selectedCardIds.has(card.id) });
    el.dataset.flatIndex = idx;
    el.style.zIndex = String(1000 - idx); // اليمين فوق اليسار (idx0 = أقصى اليمين = أعلى زيندكس)
    const groupIdx = groups.findIndex((g) => idx >= g.start && idx <= g.end);
    if (groupIdx !== -1) {
      const colorClass = ["meld-hint-a", "meld-hint-b", "meld-hint-c", "meld-hint-d", "meld-hint-e"][groupIdx % 5];
      el.classList.add("meld-hint", colorClass);
    }
    el.addEventListener("pointerdown", (e) => onCardPointerDown(e, card, el));
    (idx < splitPoint ? topRow : bottomRow).appendChild(el);
  });

  fitRowCards(topRow);
  fitRowCards(bottomRow);
}

const CARD_WIDTH = 64;
const NORMAL_OVERLAP = 16; // التراكب الطبيعي (الورق مجمّع جنب بعضه، مش متباعد) لأي عدد قليل/متوسط
const MAX_OVERLAP = 28;    // أقصى تراكب لو الورق كثير جداً (يضيق أكثر بدل ما يطلع برّا الشاشة)

/// يضبط التراكب بين الورق بصف معيّن - مجمّع دايماً (تراكب طبيعي)، ويزيد التراكب فقط لو الورق كثير وما يدخل بعرض الشاشة
function fitRowCards(rowEl) {
  const cards = [...rowEl.children];
  const n = cards.length;
  if (n === 0) return;
  const available = rowEl.clientWidth;
  let overlap = NORMAL_OVERLAP;
  if (n > 1 && available > 0) {
    const naturalWidth = CARD_WIDTH + (n - 1) * (CARD_WIDTH - 2 * NORMAL_OVERLAP);
    if (naturalWidth > available) {
      // الورق كثير وما يدخل بالتراكب الطبيعي - نضيّق أكثر بالحد الأدنى اللازم
      const idealSpacing = (available - CARD_WIDTH) / (n - 1);
      const neededOverlap = (CARD_WIDTH - idealSpacing) / 2;
      overlap = Math.min(neededOverlap, MAX_OVERLAP);
    }
  }
  for (const c of cards) c.style.margin = `0 ${-overlap}px`;
}

/// يومّض الورقة (بالـid) بتمييز ذهبي قصير - تُستخدم بعد إسقاطها بمكانها الجديد حتى ما تضيع وسط الورق
function flashCard(cardId) {
  const el = document.querySelector(`[data-card-id="${cardId}"]`);
  if (!el) return;
  el.classList.add("just-moved");
  setTimeout(() => el.classList.remove("just-moved"), 700);
}

// ===== نظام السحب الحر (نسخة طيف مستقلة) + نقرتين للرمي =====
let dragState = null; // { cardId, fromIndex, startX, startY, isDragging, el, ghost, width, height }
let lastTap = { cardId: null, time: 0 };
const DOUBLE_TAP_MS = 350;
const DRAG_THRESHOLD = 8;

function onCardPointerDown(e, card, el) {
  e.preventDefault();
  const fromIndex = Number(el.dataset.flatIndex);
  dragState = {
    cardId: card.id, fromIndex, startX: e.clientX, startY: e.clientY,
    isDragging: false, el, ghost: null, originRect: null,
  };
  el.classList.add("pressing");
  el.setPointerCapture?.(e.pointerId);
  el.addEventListener("pointermove", onCardPointerMove);
  el.addEventListener("pointerup", onCardPointerUp);
  el.addEventListener("pointercancel", onCardPointerCancel);
}

function startGhostDrag() {
  const { el } = dragState;
  const rect = el.getBoundingClientRect();
  dragState.originRect = rect;
  el.classList.remove("pressing");
  el.classList.add("drag-placeholder"); // الأصل يختفي بصرياً بس يحافظ على فجوته بالصف

  const ghost = el.cloneNode(true);
  ghost.classList.remove("pressing", "drag-placeholder");
  ghost.style.left = `${rect.left}px`;
  ghost.style.top = `${rect.top}px`;
  ghost.style.width = `${rect.width}px`;
  ghost.style.height = `${rect.height}px`;
  ghost.style.transform = "scale(1.08)";
  $("dragLayer").appendChild(ghost);
  dragState.ghost = ghost;
}

function onCardPointerMove(e) {
  if (!dragState) return;
  const dx = e.clientX - dragState.startX;
  const dy = e.clientY - dragState.startY;
  if (!dragState.isDragging && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
    dragState.isDragging = true;
    startGhostDrag();
  }
  if (dragState.isDragging && dragState.ghost) {
    const r = dragState.originRect;
    dragState.ghost.style.left = `${r.left + dx}px`;
    dragState.ghost.style.top = `${r.top + dy}px`;
  }
}

function cleanupDragVisuals() {
  if (!dragState) return;
  dragState.el.classList.remove("pressing", "drag-placeholder");
  dragState.ghost?.remove();
}

function onCardPointerCancel() {
  cleanupDragVisuals();
  dragState = null;
}

// شبكة أمان: لو لأي سبب ما وصل pointerup/pointercancel للعنصر نفسه (انقطاع لمس، تعارض إيماءات...)
// نتأكد ما يفضى سحب معلّق للأبد - أي رفع إصبع بأي مكان بالصفحة ينظّف السحب النشط
window.addEventListener("pointerup", () => {
  if (dragState) { cleanupDragVisuals(); dragState = null; }
});
window.addEventListener("pointercancel", () => {
  if (dragState) { cleanupDragVisuals(); dragState = null; }
});

function onCardPointerUp(e) {
  if (!dragState) return;
  const { cardId, fromIndex, isDragging } = dragState;
  cleanupDragVisuals();
  dragState = null;

  if (isDragging) {
    const dropEl = document.elementFromPoint(e.clientX, e.clientY);
    const meldCardEl = dropEl?.closest("[data-meld-id]");
    if (meldCardEl) {
      const meldId = meldCardEl.dataset.meldId;
      const meld = engine.state.exposedMelds.find((m) => m.id === meldId);
      const human = engine.state.player(HUMAN_ID);
      const draggedCard = human.hand.find((c) => c.id === cardId);
      if (meld && draggedCard && isHumanTurn() && engine.state.hasDrawnThisTurn) {
        try {
          engine.addCardToExposedMeld(HUMAN_ID, meld.id, draggedCard);
          selectedCardIds.delete(draggedCard.id);
          afterHumanAction();
        } catch (e2) {
          if (!(e2 instanceof HandRuleError)) console.error("[drag-to-meld] addCard unexpected:", e2);
          // لو فشلت كإضافة عادية (تمديد من طرف)، نجرّب تبديل جوكر بمكانه بالضبط لو البير تسلسل وفيه جوكر
          const hasJoker = meld.kind === MeldKind.RUN && meld.cards.some((c) => c.isJoker);
          if (hasJoker) {
            try {
              engine.swapJokerInRun(HUMAN_ID, meld.id, draggedCard);
              selectedCardIds.delete(draggedCard.id);
              afterHumanAction();
              return;
            } catch (e3) {
              if (!(e3 instanceof HandRuleError)) console.error("[drag-to-meld] swapJoker unexpected:", e3);
              showToast(e3.message ?? "حركة غير صحيحة");
              renderHand();
              return;
            }
          }
          showToast(e2.message ?? "حركة غير صحيحة");
          renderHand(); // نرجّع الورقة لمكانها بصرياً (ما تغيّر شي فعلياً باليد)
        }
      } else {
        renderHand();
      }
      return;
    }
    performCardDrop(fromIndex, e.clientX, e.clientY);
    return;
  }

  // تاب عادي (بدون سحب) - نتحقق هل هذي نقرة ثانية متتالية (رمي) أو نقرة أولى (تحديد)
  const now = Date.now();
  if (lastTap.cardId === cardId && now - lastTap.time < DOUBLE_TAP_MS) {
    lastTap = { cardId: null, time: 0 };
    discardCardDirectly(cardId);
    return;
  }
  lastTap = { cardId, time: now };
  const human = engine.state.player(HUMAN_ID);
  const card = human.hand.find((c) => c.id === cardId);
  if (card) toggleSelect(card);
}

function discardCardDirectly(cardId) {
  const human = engine.state.player(HUMAN_ID);
  const idx = human.hand.findIndex((c) => c.id === cardId);
  if (idx === -1) return;
  const splitPoint = currentSplit(human.hand.length);
  const wasInTop = idx < splitPoint;
  try {
    engine.discardCard(HUMAN_ID, human.hand[idx]);
    if (wasInTop && rowSplitIndex !== null) rowSplitIndex -= 1; // صف فوق خسر ورقة بالحذف، نحدّث الانقسام
    selectedCardIds.delete(cardId);
    afterHumanAction();
    sounds.discard();
    const slot = $("discardSlot");
    slot.classList.add("just-discarded");
    setTimeout(() => slot.classList.remove("just-discarded"), 200);
  } catch (e) {
    showToast(e.message);
  }
}

/// يحدد موضع الإدراج المناسب بصف معيّن حسب موضع الإفراج الأفقي (نظام RTL: index0 = أقصى اليمين)
function computeDropIndexInRow(rowEl, pointerX, rowStartIdx, rowEndIdxExclusive, excludeFlatIndex) {
  const cards = [...rowEl.children]
    .filter((c) => Number(c.dataset.flatIndex) !== excludeFlatIndex)
    .map((c) => {
      const r = c.getBoundingClientRect();
      return { flatIndex: Number(c.dataset.flatIndex), centerX: r.left + r.width / 2 };
    })
    .sort((a, b) => a.flatIndex - b.flatIndex);

  for (const c of cards) {
    if (pointerX >= c.centerX) return c.flatIndex;
  }
  return rowEndIdxExclusive;
}

function performCardDrop(fromIndex, pointerX, pointerY) {
  const human = engine.state.player(HUMAN_ID);
  const movedCardId = human.hand[fromIndex].id;
  const total = human.hand.length;
  const splitPoint = currentSplit(total);
  const wasInTop = fromIndex < splitPoint;
  const topRow = $("handRowTop");
  const bottomRow = $("handRowBottom");
  const topRect = topRow.getBoundingClientRect();
  const bottomRect = bottomRow.getBoundingClientRect();

  // نحدد الصف الهدف حسب الأقرب لموضع الإفراج عمودياً
  const distToTop = Math.abs(pointerY - (topRect.top + topRect.height / 2));
  const distToBottom = Math.abs(pointerY - (bottomRect.top + bottomRect.height / 2));
  const targetIsTop = distToTop <= distToBottom;

  let targetIndex;
  if (targetIsTop) {
    targetIndex = computeDropIndexInRow(topRow, pointerX, 0, splitPoint, fromIndex);
  } else {
    targetIndex = computeDropIndexInRow(bottomRow, pointerX, splitPoint, total, fromIndex);
  }

  const [movedCard] = human.hand.splice(fromIndex, 1);
  let insertAt = targetIndex;
  if (insertAt > fromIndex) insertAt -= 1; // تعديل الفهرس بعد إزالة الورقة الأصلية
  human.hand.splice(insertAt, 0, movedCard);

  // الانقسام بين الصفين مرن حقيقي: يتغيّر فقط لما الورقة تعدّت من صف لصف الثاني فعلياً
  if (wasInTop && !targetIsTop) rowSplitIndex = Math.max(0, splitPoint - 1);
  else if (!wasInTop && targetIsTop) rowSplitIndex = Math.min(total, splitPoint + 1);

  renderHand();
  flashCard(movedCardId);
}

/// يحسب معاينة التير المتوقع (الاسم + النقاط) لو ضغطت هذا الزر الآن بنفس التحديد الحالي - أو null لو التحديد غير صالح لهذي الطريقة بعد
function previewEndingTier(type, sel, remainingHand) {
  if (sel.length > 2) return null;
  if (sel.length === 2 && !sel.every((c) => c.isJoker)) return null;
  const groups = detectMeldGroups(remainingHand);
  const coveredCount = groups.reduce((sum, g) => sum + (g.end - g.start + 1), 0);
  if (coveredCount !== remainingHand.length) return null; // لسه فيه ورق غير منظّم ببيرات صحيحة

  if (type === EndingType.COLOR || type === EndingType.QARINQ) {
    const allCards = [...remainingHand, ...sel].filter((c) => !c.isJoker);
    if (type === EndingType.COLOR) {
      const allRed = allCards.every((c) => isRedSuit(c.suit));
      const allBlack = allCards.every((c) => !isRedSuit(c.suit));
      if (!(allRed || allBlack)) return null;
    } else {
      const firstSuit = allCards[0]?.suit;
      if (!firstSuit || !allCards.every((c) => c.suit === firstSuit)) return null;
    }
  }

  const jokerCount = sel.filter((c) => c.isJoker).length;
  const tier = scoreTier(type, jokerCount);
  return { label: tierLabel(type, jokerCount), score: tier.winnerScore };
}

function renderActionBar() {
  const s = engine.state;
  const actionBar = $("actionBar");
  const totalBar = $("totalPointsBar");

  if (!isHumanTurn()) {
    actionBar.style.visibility = "hidden";
    totalBar.classList.remove("show");
    return;
  }
  actionBar.style.visibility = "visible";

  const drawnAndTurn = s.hasDrawnThisTurn;
  const tookFire = s.lastDrawSource === DrawSource.LEFT_DISCARD; // شرط النزول/الخالص
  const tookStock = s.lastDrawSource === DrawSource.STOCK; // شرط الهند
  const human = s.player(HUMAN_ID);
  const sel = selectedCards();
  const selGroups = sel.length >= 3 ? splitIntoValidMelds(sel) : null;
  const selPoints = selGroups ? selGroups.reduce((sum, g) => sum + totalPoints(g.cards, g.kind), 0) : 0;

  // صندوق المجموع: يطلع بس وقت ما عندك 3 ورق فأكثر محددة، ويختفي تماماً غير كذا (الأخطاء تطلع Toast)
  if (sel.length >= 3) {
    const threshold = s.declaration.isPlayerInRace(HUMAN_ID)
      ? null
      : (s.declaration.currentThreshold ?? 91);
    if (!selGroups) {
      totalBar.textContent = "التحديد ما يشكّل بيرات صحيحة - رتّب كل بير جنب بعضه";
      totalBar.classList.remove("ready");
    } else if (drawnAndTurn && !tookFire) {
      totalBar.textContent = `المجموع: ${selPoints} - بس النزول يحتاج تاخذ ورقة النار 🔥 هذا الدور أول`;
      totalBar.classList.remove("ready");
    } else {
      totalBar.textContent = threshold
        ? `المجموع: ${selPoints} (لازم أعلى من ${threshold})`
        : `المجموع: ${selPoints}`;
      totalBar.classList.toggle("ready", !threshold || selPoints > threshold);
    }
    totalBar.classList.add("show");
  } else {
    totalBar.classList.remove("show");
  }

  const declareBtn = $("btnDeclare");
  const showDeclare = !!(selGroups && tookFire);
  declareBtn.style.display = showDeclare ? "" : "none";
  if (showDeclare) declareBtn.textContent = `نزول (${selPoints})`;

  const remainingForEnding = human.hand.filter((c) => !selectedCardIds.has(c.id));
  const handBtn = $("btnHand");
  handBtn.style.display = (drawnAndTurn && tookStock) ? "" : "none";
  const handPreview = previewEndingTier(EndingType.HAND, sel, remainingForEnding);
  handBtn.textContent = handPreview ? `${handPreview.label} (${handPreview.score})` : "هند";

  const khalesBtn = $("btnKhales");
  // استثناء: لو بيدك ورقة وحدة (الخالص الأخير بعد نزول كامل) → الخالص يطلع بغض النظر عن مصدر السحب
  const isLastCard = drawnAndTurn && human.hand.length === 1;
  khalesBtn.style.display = (drawnAndTurn && (tookFire || isLastCard)) ? "" : "none";
  khalesBtn.textContent = "خالص (-30)"; // الخالص ثابتة دايماً، بكل أنواعها، بغض النظر عن ورقة الإعلان

  const colorBtn = $("btnColor");
  colorBtn.style.display = drawnAndTurn ? "" : "none";
  const colorPreview = previewEndingTier(EndingType.COLOR, sel, remainingForEnding);
  colorBtn.textContent = colorPreview ? `${colorPreview.label} (${colorPreview.score})` : "لون";

  const qarinqBtn = $("btnQarinq");
  qarinqBtn.style.display = drawnAndTurn ? "" : "none";
  const qarinqPreview = previewEndingTier(EndingType.QARINQ, sel, remainingForEnding);
  qarinqBtn.textContent = qarinqPreview ? `${qarinqPreview.label} (${qarinqPreview.score})` : "قرينق";

  const showUndoNar = drawnAndTurn && tookFire && !s.hasMadeProgressThisTurn;
  $("btnUndoNar").style.display = showUndoNar ? "" : "none";
}

// ===== أدوات منطقية =====

function isHumanTurn() {
  return engine.state.currentTurnPlayerID === HUMAN_ID;
}

function selectedCards() {
  const human = engine.state.player(HUMAN_ID);
  return human.hand.filter((c) => selectedCardIds.has(c.id));
}

function inferKind(cards) {
  const ranks = new Set(cards.map((c) => c.rank).filter((r) => r != null));
  return ranks.size <= 1 ? MeldKind.SET : MeldKind.RUN;
}

function orderForRun(cards) {
  const sorted = [...cards].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
  const hasAce = sorted.some((c) => c.rank === 14);
  const hasTwo = sorted.some((c) => c.rank === 2);
  if (hasAce && hasTwo) {
    const idx = sorted.findIndex((c) => c.rank === 14);
    const [ace] = sorted.splice(idx, 1);
    sorted.unshift(ace);
  }
  return sorted;
}

/// يقسّم الورق المحدد (بترتيبه باليد) إلى بيرات صحيحة متعددة - كل بير لازم يكون مجموعة (Set) أو تسلسل (Run) صحيح
/// لو فيه أي ورق زايد ما يكمّل بير صحيح، يرجّع null (التحديد غير صالح للنزول)
function splitIntoValidMelds(cards) {
  const groups = [];
  let i = 0;
  while (i < cards.length) {
    let matched = null;
    const maxWindow = cards.length - i;
    for (let w = maxWindow; w >= 3; w--) {
      const slice = cards.slice(i, i + w);
      if (isValidSet(slice)) { matched = { cards: slice, kind: MeldKind.SET }; break; }
      if (isValidRun(slice)) { matched = { cards: orderForRun(slice), kind: MeldKind.RUN }; break; }
    }
    if (!matched) return null;
    groups.push(matched);
    i += matched.cards.length;
  }
  return groups;
}

function toggleSelect(card) {
  if (!isHumanTurn()) return;
  sounds.select();
  if (selectedCardIds.has(card.id)) selectedCardIds.delete(card.id);
  else selectedCardIds.add(card.id);
  render();
}

function onMeldCardClick(meld) {
  if (!isHumanTurn() || !engine.state.hasDrawnThisTurn) return;
  const sel = selectedCards();
  if (sel.length !== 1) {
    showToast("حدّد ورقة واحدة من يدك بس عشان تضيفها على هذا البير");
    return;
  }
  try {
    engine.addCardToExposedMeld(HUMAN_ID, meld.id, sel[0]);
    selectedCardIds.clear();
    afterHumanAction();
  } catch (e) {
    if (!(e instanceof HandRuleError)) console.error("[onMeldCardClick]:", e);
    showToast(e.message ?? "حركة غير صحيحة");
  }
}

// ===== أزرار وأحداث =====

$("stockPile").addEventListener("click", () => {
  if (!isHumanTurn() || engine.state.hasDrawnThisTurn) return;
  try {
    engine.drawCard(HUMAN_ID, DrawSource.STOCK);
    sounds.draw();
    const pile = $("stockPile");
    pile.classList.add("drawing");
    setTimeout(() => pile.classList.remove("drawing"), 180);
    render();
  } catch (e) {
    showToast(e.message);
  }
});

$("discardSlot").addEventListener("click", () => {
  if (!isHumanTurn() || engine.state.hasDrawnThisTurn) return;
  if (engine.state.discardPile.length === 0) return;
  try {
    engine.drawCard(HUMAN_ID, DrawSource.LEFT_DISCARD);
    sounds.draw();
    render();
  } catch (e) {
    showToast(e.message);
  }
});

$("btnUndoNar").addEventListener("click", () => {
  try {
    engine.undoLeftDiscardDraw(HUMAN_ID);
    selectedCardIds.clear();
    render();
  } catch (e) {
    showToast(e.message);
  }
});

$("btnDeclare").addEventListener("click", () => {
  const cards = selectedCards();
  const groups = splitIntoValidMelds(cards);
  if (!groups) {
    showToast("التحديد ما يشكّل بيرات صحيحة - رتّب كل بير جنب بعضه قبل النزول");
    return;
  }
  try {
    engine.declareMelds(HUMAN_ID, groups);
    selectedCardIds.clear();
    afterHumanAction();
    sounds.declare();
  } catch (e) {
    if (!(e instanceof HandRuleError)) console.error("[btnDeclare]:", e);
    showToast(e.message);
  }
});

function endingHandler(type) {
  return () => {
    const human = engine.state.player(HUMAN_ID);
    const finalDiscards = selectedCards();
    // نبني البيرات تلقائياً من ترتيب يدك الحالي (رتّب ورقك بالسحب حتى تصف كل بير جنب بعضه - يتلوّن تلقائياً لو صحيح)
    // لو سبق ونزّلت بيراتك على مراحل (خالص بعد النزول)، الباقي بيدك يكون 1-2 ورقة بس فيخرج بدون أي بيرات تلقائياً
    const remainingHand = human.hand.filter((c) => !selectedCardIds.has(c.id));
    const groups = detectMeldGroups(remainingHand);
    const melds = groups.map((g) => {
      const cards = remainingHand.slice(g.start, g.end + 1);
      return { cards, kind: inferKind(cards) };
    });
    try {
      engine.endRound(HUMAN_ID, type, finalDiscards, melds);
      selectedCardIds.clear();
      onRoundOver();
    } catch (e) {
      if (!(e instanceof HandRuleError)) console.error("[endingHandler]:", e);
      showToast(e.message);
    }
  };
}
$("btnHand").addEventListener("click", endingHandler(EndingType.HAND));
$("btnKhales").addEventListener("click", endingHandler(EndingType.KHALES));
$("btnColor").addEventListener("click", endingHandler(EndingType.COLOR));
$("btnQarinq").addEventListener("click", endingHandler(EndingType.QARINQ));

// الرمي صار بنقرتين متتاليتين على الورقة (discardCardDirectly) - بدل زر مخصص

// ===== تتابع الأدوار =====

function afterHumanAction() {
  render();
  if (engine.state.isRoundOver) { onRoundOver(); return; }
  runAILoop();
}

const AI_SPEEDS = { slow: 1200, medium: 500, fast: 150 };
let aiSpeed = "medium";

function oppSlotElementFor(playerID) {
  const seat = SEAT_BY_ID[playerID];
  return seat ? $(`opp${seat}`) : null;
}

function runAILoop() {
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

// ===== نوافذ النهاية =====

function fillScoreTable(tableEl) {
  tableEl.innerHTML = "";
  const sorted = engine.state.leaderboardSorted();
  const best = sorted[0]?.[1];
  for (const [player, score] of sorted) {
    const tr = document.createElement("tr");
    if (score === best) tr.classList.add("leader");
    const nameTd = document.createElement("td");
    nameTd.textContent = player.name;
    const scoreTd = document.createElement("td");
    scoreTd.textContent = score;
    tr.append(nameTd, scoreTd);
    tableEl.appendChild(tr);
  }
}

function onRoundOver() {
  $("roundEndTitle").textContent = engine.state.roundEndedReason ?? "انتهت الجولة";
  $("roundEndDetails").textContent = "النقاط بعد هذي الجولة:";
  fillScoreTable($("roundEndScoreTable"));
  $("roundEndOverlay").classList.remove("hidden");
  const human = engine.state.player(HUMAN_ID);
  const reason = engine.state.roundEndedReason ?? "";
  if (human && reason.includes(human.name)) sounds.win();
  else sounds.lose();
  triggerCelebration(engine.state.lastEndingTier);
}

/// تأثير احتفالي بصري يتدرّج حسب قوة طريقة الإنهاء (خالص/هند خفيف، قرينق+جوكرين احتفال كامل) - يطلع لأي فايز
const CONFETTI_COLORS = ["#f3d27a", "#e8b73f", "#2ecc71", "#3498db", "#e74c3c", "#e84393", "#fbf6ea"];
function triggerCelebration(tier) {
  if (!tier) return;
  const absScore = Math.abs(tier.winnerScore);
  // مستويات الشدة بنفس تدرّج جدول النقاط: 30=خالص، 60=هند، 120=جوكر/لون، 240=جوكرين/قرينق، 480، 960=الأقوى
  let pieceCount, durationRange, shake;
  if (absScore <= 30) { pieceCount = 16; durationRange = [1.6, 2.2]; shake = false; }
  else if (absScore <= 60) { pieceCount = 28; durationRange = [1.8, 2.4]; shake = false; }
  else if (absScore <= 120) { pieceCount = 45; durationRange = [2.0, 2.7]; shake = false; }
  else if (absScore <= 240) { pieceCount = 65; durationRange = [2.2, 3.0]; shake = true; }
  else if (absScore <= 480) { pieceCount = 95; durationRange = [2.4, 3.2]; shake = true; }
  else { pieceCount = 140; durationRange = [2.6, 3.5]; shake = true; }

  const layer = $("celebrationLayer");
  for (let i = 0; i < pieceCount; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    const duration = durationRange[0] + Math.random() * (durationRange[1] - durationRange[0]);
    piece.style.animationDuration = `${duration}s`;
    piece.style.animationDelay = `${Math.random() * 0.5}s`;
    layer.appendChild(piece);
    setTimeout(() => piece.remove(), (duration + 0.5) * 1000);
  }

  if (shake) {
    const appEl = $("app");
    appEl.classList.remove("screen-shake");
    void appEl.offsetWidth;
    appEl.classList.add("screen-shake");
    setTimeout(() => appEl.classList.remove("screen-shake"), 500);
  }

  sounds.celebrate(absScore);
}

function onStuck() {
  $("stuckOverlay").classList.remove("hidden");
}

$("redealBtn").addEventListener("click", () => {
  $("stuckOverlay").classList.add("hidden");
  engine.startNewRound();
  rowSplitIndex = null;
  selectedCardIds.clear();
  render();
  runAILoop();
});

$("nextRoundBtn").addEventListener("click", () => {
  $("roundEndOverlay").classList.add("hidden");
  engine.advanceToNextRound();
  rowSplitIndex = null;
  if (engine.state.isGameOver) {
    showGameEnd();
    return;
  }
  selectedCardIds.clear();
  render();
  runAILoop();
});

function showGameEnd() {
  const sorted = engine.state.leaderboardSorted();
  $("gameEndWinner").textContent = `🏆 الفائز: ${sorted[0][0].name}`;
  fillScoreTable($("gameEndScoreTable"));
  $("gameEndOverlay").classList.remove("hidden");
}

$("newGameBtn").addEventListener("click", () => {
  $("gameEndOverlay").classList.add("hidden");
  location.reload();
});

$("muteBtn").addEventListener("click", () => {
  const newMuted = !sounds.isMuted();
  sounds.setMuted(newMuted);
  $("muteBtn").textContent = newMuted ? "🔇" : "🔊";
  if (!newMuted) sounds.button();
});

$("scoreBtn").addEventListener("click", () => {
  fillScoreTable($("scoreTable"));
  $("scoreOverlay").classList.remove("hidden");
});
$("closeScoreBtn").addEventListener("click", () => {
  $("scoreOverlay").classList.add("hidden");
});

// ===== شاشة البداية =====
document.querySelectorAll(".speed-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".speed-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    aiSpeed = btn.dataset.speed;
  });
});

$("startPlayBtn").addEventListener("click", () => {
  sounds.button();
  $("startScreen").classList.add("hidden");
  engine.startNewRound();
  render();
  runAILoop();
});

// تعريض المحرك للتشخيص والتجربة (مفيد بمتصفح Console كمان)
window.__engine = engine;
window.__render = render; // للاختبارات فقط - يفرض إعادة رسم بعد تعديل مباشر بحالة الـ engine
