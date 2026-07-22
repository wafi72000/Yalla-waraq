// state.js — الحالة المشتركة الوحيدة بين app.js وai-scheduler.js: مرجع المباراة الحالية
// export let يصنع "ربط حي" - أي ملف يستورد match يشوف آخر قيمة محدَّثة دايماً بدون الحاجة لتمريرها كمعامل بكل مكان

export let match = null;

export function setMatch(newMatch) {
  match = newMatch;
}
