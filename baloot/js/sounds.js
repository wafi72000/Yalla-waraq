// sounds.js — مؤثرات صوتية مولّدة بالكود (Web Audio API) - صفر ملفات خارجية، صفر مشاكل ترخيص

let ctx = null;
let muted = false;

function getCtx() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

/// نغمة بسيطة (sine/triangle) بمدة وتردد وحجم محددين، مع خفوت تدريجي طبيعي
function tone({ freq = 440, duration = 0.1, type = "sine", volume = 0.15, delay = 0 }) {
  if (muted) return;
  try {
    const c = getCtx();
    if (!c) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime + delay);
    gain.gain.setValueAtTime(volume, c.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + duration);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(c.currentTime + delay);
    osc.stop(c.currentTime + delay + duration + 0.02);
  } catch (e) { /* تجاهل لو المتصفح ما يدعم الصوت */ }
}

/// ضجيج قصير (يحاكي صوت "فرفشة/رمي" ورقة) عبر ضوضاء بيضاء مفلترة
function noiseClick({ duration = 0.05, volume = 0.12, delay = 0, filterFreq = 2200 }) {
  if (muted) return;
  try {
    const c = getCtx();
    if (!c) return;
    const bufferSize = Math.floor(c.sampleRate * duration);
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const src = c.createBufferSource();
    src.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = filterFreq;
    const gain = c.createGain();
    gain.gain.setValueAtTime(volume, c.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);
    src.start(c.currentTime + delay);
  } catch (e) { /* تجاهل */ }
}

export const sounds = {
  /// صوت توزيع ورقة وحدة (فرفشة قصيرة وخفيفة) - يُستدعى لكل ورقة أثناء أنيميشن التوزيع
  dealCard() { noiseClick({ duration: 0.05, volume: 0.09, filterFreq: 2600 }); },

  /// صوت رمي/وضع ورقة بالميدان (طقّة أثقل شوي من التوزيع)
  playCard() { noiseClick({ duration: 0.07, volume: 0.13, filterFreq: 1500 }); },

  /// صوت أخذ الشوط (جمع الورق) - نغمة قصيرة صاعدة بسيطة
  takeTrick() {
    tone({ freq: 440, duration: 0.09, type: "triangle", volume: 0.1 });
    tone({ freq: 587, duration: 0.12, type: "triangle", volume: 0.1, delay: 0.06 });
  },

  setMuted(value) { muted = value; },
  isMuted() { return muted; },
};
