// state.js — الحالة المشتركة الوحيدة بين app.js وai-scheduler.js: كائن محرك اللعبة
// engine ثابت (const) وما يُعاد تعيينه أبداً طول عمر الصفحة - استيراده مباشرة كافٍ (بعكس match بالبلوت
// اللي يحتاج setter لأنه يُستبدل بمباراة جديدة كل مرة)

import { HandEngine } from "./engine.js";
import { players } from "./seats.js";

export const engine = new HandEngine(players);
