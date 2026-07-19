// sounds.js — مؤثرات صوتية مولّدة بالكود (Web Audio API) - صفر ملفات خارجية، صفر مشاكل ترخيص

let ctx = null;
let muted = false;

function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

/// نغمة بسيطة (sine/triangle) بمدة وتردد وحجم محددين، مع خفوت تدريجي طبيعي
function tone({ freq = 440, duration = 0.1, type = "sine", volume = 0.15, delay = 0, glideTo = null }) {
  if (muted) return;
  try {
    const c = getCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime + delay);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, c.currentTime + delay + duration);
    gain.gain.setValueAtTime(volume, c.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + duration);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(c.currentTime + delay);
    osc.stop(c.currentTime + delay + duration + 0.02);
  } catch (e) { /* تجاهل لو المتصفح ما يدعم الصوت */ }
}

/// ضجيج قصير (لمحاكاة صوت "فرفشة" الورق) عبر ضوضاء بيضاء مفلترة
function noiseClick({ duration = 0.05, volume = 0.12, delay = 0, filterFreq = 2200 }) {
  if (muted) return;
  try {
    const c = getCtx();
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
  draw() { noiseClick({ duration: 0.06, volume: 0.1, filterFreq: 1800 }); },
  discard() { noiseClick({ duration: 0.08, volume: 0.13, filterFreq: 1200 }); },
  select() { tone({ freq: 700, duration: 0.04, type: "triangle", volume: 0.06 }); },
  invalid() { tone({ freq: 180, duration: 0.18, type: "sawtooth", volume: 0.1, glideTo: 120 }); },
  declare() {
    tone({ freq: 523, duration: 0.1, volume: 0.12 });
    tone({ freq: 659, duration: 0.12, volume: 0.12, delay: 0.08 });
    tone({ freq: 784, duration: 0.16, volume: 0.12, delay: 0.16 });
  },
  win() {
    [523, 659, 784, 1046].forEach((f, i) => tone({ freq: f, duration: 0.18, volume: 0.13, delay: i * 0.1 }));
  },
  celebrate(absScore = 60) {
    // مستويات متدرّجة بنفس تسلسل جدول النقاط - الأقوى صوتاً كلما زاد absScore
    if (absScore <= 30) {
      // خالص - نغمة قصيرة ومبهجة
      [523, 659].forEach((f, i) => tone({ freq: f, duration: 0.15, volume: 0.12, delay: i * 0.09 }));
    } else if (absScore <= 60) {
      // هند - 4 نغمات صاعدة
      [523, 659, 784, 1046].forEach((f, i) => tone({ freq: f, duration: 0.18, volume: 0.14, delay: i * 0.1 }));
    } else if (absScore <= 120) {
      // جوكر/لون - 4 نغمات + تكرار أعلى
      [523, 659, 784, 1046].forEach((f, i) => tone({ freq: f, duration: 0.18, volume: 0.16, delay: i * 0.09 }));
      [784, 1046, 1318].forEach((f, i) => tone({ freq: f, duration: 0.2, volume: 0.14, delay: 0.4 + i * 0.1 }));
    } else if (absScore <= 240) {
      // جوكرين/قرينق - صعود سريع + قفلة مزدوجة
      [392, 494, 659, 784, 1046, 1318].forEach((f, i) => tone({ freq: f, duration: 0.16, volume: 0.17, delay: i * 0.07 }));
      [1046, 1318].forEach((f, i) => tone({ freq: f, duration: 0.25, volume: 0.15, delay: 0.5 + i * 0.12 }));
    } else if (absScore <= 480) {
      // المستوى الكبير - صعود كامل + ثلاث نغمات قفلة
      [261, 330, 392, 494, 659, 784, 1046, 1318].forEach((f, i) =>
        tone({ freq: f, duration: 0.15, volume: 0.18, delay: i * 0.06 }));
      [880, 1046, 1318].forEach((f, i) => tone({ freq: f, duration: 0.3, volume: 0.16, delay: 0.55 + i * 0.13 }));
    } else {
      // قرينق+جوكرين - أقصى احتفال، موجتان كاملتان
      [261, 330, 392, 494, 659, 784, 1046, 1318].forEach((f, i) =>
        tone({ freq: f, duration: 0.14, volume: 0.19, delay: i * 0.055 }));
      [523, 659, 784, 1046, 1318].forEach((f, i) =>
        tone({ freq: f, duration: 0.2, volume: 0.17, delay: 0.5 + i * 0.1 }));
      [1046, 1318, 1568].forEach((f, i) =>
        tone({ freq: f, duration: 0.3, volume: 0.16, delay: 1.05 + i * 0.13 }));
    }
  },
  lose() {
    [392, 330, 261].forEach((f, i) => tone({ freq: f, duration: 0.22, volume: 0.1, delay: i * 0.12 }));
  },
  button() { tone({ freq: 880, duration: 0.03, type: "triangle", volume: 0.05 }); },
  setMuted(value) { muted = value; },
  isMuted() { return muted; },
};
