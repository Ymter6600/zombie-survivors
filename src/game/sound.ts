/** Web Audio 程式合成音效（零音檔）。模組層級單例，由遊戲事件呼叫。 */

let ctx: AudioContext | undefined;
let master: GainNode | undefined;
let muted = false;

function ensure(): AudioContext | undefined {
  if (typeof window === 'undefined' || !window.AudioContext) return undefined;
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

interface ToneOpts {
  freq: number;
  freqTo?: number;
  type?: OscillatorType;
  dur: number;
  gain?: number;
  delay?: number;
}

function tone(o: ToneOpts) {
  const c = ensure();
  if (!c || !master || muted) return;
  const t = c.currentTime + (o.delay ?? 0);
  const osc = c.createOscillator();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.freq, t);
  if (o.freqTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.freqTo), t + o.dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(o.gain ?? 0.25, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t);
  osc.stop(t + o.dur + 0.02);
}

function noise(dur: number, gain: number, type: BiquadFilterType, freq: number) {
  const c = ensure();
  if (!c || !master || muted) return;
  const t = c.currentTime;
  const len = Math.floor(c.sampleRate * dur);
  const buffer = c.createBuffer(1, len, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(master);
  src.start(t);
  src.stop(t + dur);
}

/** ===== 背景音樂（程序合成，三首可切換） ===== */
let musicGain: GainNode | undefined;
let musicTimer: ReturnType<typeof setTimeout> | undefined;
let nextBarTime = 0;
let bar = 0;
/** 預設曲目：暗潮（隨擊敗王數自動切換） */
let currentTrack = 0;

function musicNote(freq: number, type: OscillatorType, t: number, dur: number, gain: number, filterFreq?: number) {
  const c = ensure();
  if (!c || !musicGain) return;
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + dur * 0.25);
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  if (filterFreq) {
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq;
    osc.connect(f);
    f.connect(g);
  } else {
    osc.connect(g);
  }
  g.connect(musicGain);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

interface Track {
  name: string;
  barDur: number;
  build: (t: number, bar: number) => void;
}

/** 第一首「暗潮」：A 小調 i–VI–III–VII 緩拍琶音 */
function trackDark(t: number, bar: number) {
  const roots = [110, 87.31, 130.81, 98];
  const root = roots[bar % roots.length];
  const B = 0.5;
  musicNote(root * 2, 'triangle', t, 2, 0.14);
  musicNote(root * 3, 'sine', t, 2, 0.09);
  const mel = [2, 3, 4, 3];
  for (let b = 0; b < 4; b++) {
    musicNote(root, 'sawtooth', t + b * B, 0.4, 0.24, 600);
    musicNote(root * mel[b], 'triangle', t + b * B, 0.45, 0.13);
  }
}

/** 第二首「獵殺」：快速驅動八分音符低音 + 攻擊性旋律 */
function trackHunt(t: number, bar: number) {
  const roots = [110, 110, 146.83, 130.81]; // A A D C
  const root = roots[bar % roots.length];
  const S = 0.15;
  musicNote(root * 2, 'sawtooth', t, 1.2, 0.08, 1400);
  const mel = [4, 0, 3, 0, 4, 5, 0, 3];
  for (let s = 0; s < 8; s++) {
    musicNote(root, 'square', t + s * S, 0.13, 0.18, 700);
    if (mel[s]) musicNote(root * mel[s], 'triangle', t + s * S, 0.16, 0.12);
  }
}

/** 「狂亂」：高速十六分音符、緊張驅動（追逐感） */
function trackFrenzy(t: number, bar: number) {
  const roots = [110, 98, 130.81, 116.54]; // A G C A#
  const root = roots[bar % roots.length];
  const S = 0.1;
  musicNote(root, 'sawtooth', t, 1.6, 0.07, 1300); // 持續低音鋪底
  const mel = [4, 5, 4, 6, 4, 5, 8, 6, 4, 5, 4, 6, 8, 10, 8, 6];
  for (let s = 0; s < 16; s++) {
    if (s % 2 === 0) musicNote(root, 'square', t + s * S, 0.09, 0.16, 850); // 急促脈衝低音
    musicNote(root * mel[s], 'triangle', t + s * S, 0.11, 0.09);
  }
}

/** 「肅殺」：行軍式中速、沉重壓迫 */
function trackGrim(t: number, bar: number) {
  const roots = [73.42, 73.42, 82.41, 65.41]; // D D E C（低音行軍）
  const root = roots[bar % roots.length];
  const B = 0.4;
  const mel = [4, 5, 6, 5];
  for (let b = 0; b < 4; b++) {
    musicNote(root, 'square', t + b * B, 0.18, 0.22, 420); // 沉重腳步
    musicNote(root * mel[b], 'sawtooth', t + b * B, 0.34, 0.12, 950); // 陰暗旋律
  }
  if (bar % 2 === 1) musicNote(root * 8, 'sine', t + 1.2, 0.6, 0.06); // 高處不安泛音
}

const TRACKS: Track[] = [
  { name: '暗潮', barDur: 2, build: trackDark }, // 0
  { name: '獵殺', barDur: 1.2, build: trackHunt }, // 1
  { name: '狂亂', barDur: 1.6, build: trackFrenzy }, // 2
  { name: '肅殺', barDur: 1.6, build: trackGrim }, // 3
];

function scheduler() {
  const c = ensure();
  if (!c) return;
  const track = TRACKS[currentTrack];
  while (nextBarTime < c.currentTime + 0.3) {
    if (!muted) track.build(nextBarTime, bar);
    nextBarTime += track.barDur;
    bar++;
  }
  musicTimer = setTimeout(scheduler, 120);
}

export const sound = {
  setMuted(v: boolean) {
    muted = v;
  },
  /** 解鎖音訊（於使用者互動時呼叫） */
  enable() {
    ensure();
  },
  /** 開始背景音樂迴圈 */
  startMusic() {
    const c = ensure();
    if (!c || musicTimer) return;
    if (!musicGain) {
      musicGain = c.createGain();
      musicGain.gain.value = 0.7;
      if (master) musicGain.connect(master);
    }
    bar = 0;
    nextBarTime = c.currentTime + 0.1;
    scheduler();
  },
  /** 停止背景音樂 */
  stopMusic() {
    if (musicTimer) {
      clearTimeout(musicTimer);
      musicTimer = undefined;
    }
  },
  /** 可選曲目名稱 */
  musicTrackNames: TRACKS.map((t) => t.name),
  /** 切換曲目（下一小節生效） */
  setMusicTrack(i: number) {
    if (i >= 0 && i < TRACKS.length) currentTrack = i;
  },
  /** 開槍 */
  shoot() {
    tone({ freq: 880, freqTo: 280, type: 'square', dur: 0.08, gain: 0.12 });
    noise(0.05, 0.08, 'highpass', 2000);
  },
  /** 命中／擊殺殭屍 */
  hit() {
    tone({ freq: 200, freqTo: 70, type: 'square', dur: 0.1, gain: 0.16 });
    noise(0.08, 0.12, 'lowpass', 600);
  },
  /** 升級 */
  levelUp() {
    [523, 659, 784, 1046].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.16, gain: 0.22, delay: i * 0.09 }));
  },
  /** 玩家受擊 */
  hurt() {
    tone({ freq: 300, freqTo: 90, type: 'sawtooth', dur: 0.18, gain: 0.22 });
  },
  /** 王登場：威壓號角（基頻拉進可聽範圍，中頻層確保小喇叭聽得到） */
  bossSpawn() {
    tone({ freq: 165, freqTo: 110, type: 'sawtooth', dur: 1.0, gain: 0.42 }); // 主號角 E3→A2
    tone({ freq: 247, freqTo: 165, type: 'square', dur: 0.9, gain: 0.22 }); // 不協和疊音增加壓迫
    tone({ freq: 440, freqTo: 330, type: 'triangle', dur: 0.45, gain: 0.2, delay: 0.04 }); // 明亮中頻層
    tone({ freq: 660, type: 'triangle', dur: 0.18, gain: 0.16, delay: 0.0 }); // 起頭的尖銳衝擊
    noise(0.8, 0.3, 'lowpass', 900);
  },
  /** 王施放招式：吼叫 + 下掃（彈幕／衝撞／震波） */
  bossSkill() {
    tone({ freq: 760, freqTo: 180, type: 'sawtooth', dur: 0.3, gain: 0.3 });
    tone({ freq: 380, freqTo: 150, type: 'square', dur: 0.3, gain: 0.2 });
    noise(0.25, 0.26, 'bandpass', 1200);
  },
  /** 王被擊敗 */
  bossDown() {
    tone({ freq: 160, freqTo: 40, type: 'sawtooth', dur: 0.6, gain: 0.32 });
    noise(0.5, 0.3, 'lowpass', 800);
  },
  /** 玩家死亡 */
  playerDeath() {
    tone({ freq: 420, freqTo: 60, type: 'sawtooth', dur: 0.7, gain: 0.28 });
  },
  /** 開寶箱獲得增益 */
  buff() {
    [659, 880, 1175].forEach((f, i) => tone({ freq: f, type: 'square', dur: 0.12, gain: 0.18, delay: i * 0.07 }));
  },
  /** 回血 */
  heal() {
    tone({ freq: 784, type: 'sine', dur: 0.14, gain: 0.18 });
    tone({ freq: 1046, type: 'sine', dur: 0.16, gain: 0.18, delay: 0.1 });
  },
};
