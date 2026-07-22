// seats.js — تهيئة ثابتة للمقاعد الأربعة: المعرّفات، الفرق، الأسماء المعروضة، ومواضع عناصر DOM

export const HUMAN_ID = "human";

// ترتيب فيزيائي بعقارب الساعة: أنت(أسفل) -> سالم(يسار) -> خالد(فوق، شريكك) -> فهد(يمين) -> رجوع لك
export const baseSeatOrder = [HUMAN_ID, "salem", "khaled", "fahad"];

export const teamOfPlayer = (id) => (id === HUMAN_ID || id === "khaled") ? "A" : "B";

export const AI_IDS = ["salem", "khaled", "fahad"];

export const SEAT_ELEMENT_ID = { salem: "seatLeft", khaled: "seatTop", fahad: "seatRight" };
export const SEAT_TRICK_POS = { human: "bottom", salem: "left", khaled: "top", fahad: "right" };

export function displayName(id) {
  if (id === HUMAN_ID) return "أنت";
  const names = { salem: "سالم", khaled: "خالد", fahad: "فهد" };
  return names[id] ?? id;
}
