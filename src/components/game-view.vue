<template>
  <div class="relative w-full h-full overflow-hidden bg-[#0b1020]">
    <canvas ref="canvasRef" class="w-full h-full block outline-none touch-none" />

    <hud :stats="stats" />

    <!-- 右上控制：靜音／暫停／技能等級／Debug -->
    <div v-show="stats.state === 'running'" class="absolute right-3 top-3 z-10 flex items-center gap-1.5 sm:right-4 sm:top-4 sm:gap-2">
      <button
        class="flex h-9 w-9 items-center justify-center rounded-full sm:h-11 sm:w-11 bg-black/40 text-base text-white backdrop-blur-md sm:text-xl transition hover:bg-black/60 active:scale-95"
        @click="onToggleMute"
      >
        {{ muted ? '🔇' : '🔊' }}
      </button>
      <select
        v-model.number="musicTrack"
        @change="onMusicTrack"
        title="背景音樂"
        class="h-9 rounded-full border-0 bg-black/40 px-2 text-xs text-white outline-none backdrop-blur-md transition hover:bg-black/60 sm:h-11 sm:px-3 sm:text-sm"
      >
        <option v-for="(n, i) in trackNames" :key="i" :value="i" class="bg-zinc-900 text-white">🎵 {{ n }}</option>
      </select>
      <button
        class="flex h-9 w-9 items-center justify-center rounded-full sm:h-11 sm:w-11 bg-black/40 text-base text-white backdrop-blur-md sm:text-xl transition hover:bg-black/60 active:scale-95"
        @click="onTogglePause"
      >
        ⏸
      </button>
      <button
        class="flex h-9 w-9 items-center justify-center rounded-full sm:h-11 sm:w-11 text-base text-white backdrop-blur-md sm:text-xl transition active:scale-95"
        :class="showStats ? 'bg-cyan-500' : 'bg-black/40 hover:bg-black/60'"
        @click="onToggleStats"
      >
        📊
      </button>
      <button
        class="flex h-9 w-9 items-center justify-center rounded-full sm:h-11 sm:w-11 text-base text-white backdrop-blur-md sm:text-xl transition active:scale-95"
        :class="showDebug ? 'bg-fuchsia-500' : 'bg-black/40 hover:bg-black/60'"
        @click="onToggleDebug"
      >
        🛠️
      </button>
    </div>

    <!-- 技能等級面板 -->
    <div
      v-if="showStats && stats.state === 'running'"
      class="absolute right-4 top-20 z-20 max-h-[78vh] w-60 overflow-y-auto rounded-2xl bg-black/75 p-3 text-xs text-white shadow-2xl ring-1 ring-white/10 backdrop-blur-md"
    >
      <div class="mb-2 text-sm font-black text-cyan-300">技能等級</div>
      <div
        v-for="(u, i) in upgradeStatus"
        :key="i"
        class="mb-1 flex items-center justify-between"
        :class="u.level === 0 ? 'text-white/40' : ''"
      >
        <span>{{ u.emoji }} {{ u.name }}</span>
        <span class="font-bold" :class="u.level >= u.maxLevel ? 'text-amber-300' : 'text-white/80'">
          Lv {{ u.level }}/{{ u.maxLevel }}
        </span>
      </div>
    </div>

    <!-- Debug 參數面板 -->
    <div
      v-if="showDebug && stats.state === 'running'"
      class="absolute right-4 top-20 z-20 max-h-[78vh] w-72 overflow-y-auto rounded-2xl bg-black/75 p-3 text-xs text-white shadow-2xl ring-1 ring-white/10 backdrop-blur-md"
    >
      <!-- 召喚王 -->
      <div class="mb-3 rounded-lg bg-white/5 p-2">
        <div class="mb-1 text-sm font-black text-fuchsia-300">召喚王</div>
        <div class="flex gap-2">
          <select v-model.number="summonIndex" class="min-w-0 flex-1 rounded bg-black/50 px-2 py-1 text-white outline-none">
            <option v-for="(n, i) in bossNames" :key="i" :value="i" class="text-black">{{ i + 1 }}. {{ n }}</option>
          </select>
          <button class="rounded bg-fuchsia-500 px-3 py-1 font-black active:scale-95" @click="onSummonBoss">召喚</button>
        </div>
      </div>

      <template v-for="g in debugGroups" :key="g.group">
        <div class="mb-1 mt-2 text-sm font-black text-fuchsia-300">{{ g.group }}</div>
        <div v-for="item in g.items" :key="item.index" class="mb-2">
          <label v-if="item.type === 'bool'" class="flex cursor-pointer items-center justify-between">
            <span>{{ item.label }}</span>
            <input
              type="checkbox"
              class="h-4 w-4 accent-fuchsia-400"
              :checked="item.value > 0.5"
              @change="onDebugToggle(item.index, $event)"
            />
          </label>
          <template v-else>
            <div class="flex justify-between">
              <span>{{ item.label }}</span>
              <span class="font-bold text-white/70">{{ fmt(item.value) }}</span>
            </div>
            <input
              type="range"
              class="w-full accent-fuchsia-400"
              :min="item.min"
              :max="item.max"
              :step="item.step"
              :value="item.value"
              @input="onDebugInput(item.index, $event)"
            />
          </template>
        </div>
      </template>
    </div>

    <joystick
      v-show="stats.state === 'running'"
      class="absolute bottom-8 left-8 z-10"
      @move="onJoyMove"
      @end="onJoyEnd"
    />

    <!-- 跳躍鈕（手機，遊玩中顯示） -->
    <button
      v-show="stats.state === 'running'"
      class="absolute bottom-12 right-10 z-10 flex h-20 w-20 items-center justify-center rounded-full bg-sky-500/70 text-base font-black text-white backdrop-blur-md transition active:scale-90"
      @pointerdown.prevent="onJump"
    >
      跳躍
    </button>

    <level-up-modal
      v-if="stats.state === 'levelup'"
      :level="stats.level"
      :choices="stats.choices"
      @choose="onChoose"
    />

    <game-over-modal
      v-if="stats.state === 'dead'"
      :stats="stats"
      @restart="onRestart"
      @menu="emit('menu')"
    />

    <victory-modal
      v-if="stats.state === 'won'"
      :stats="stats"
      @restart="onRestart"
      @menu="emit('menu')"
    />

    <pause-menu-modal
      v-if="stats.state === 'paused'"
      @resume="onTogglePause"
      @restart="onRestart"
      @menu="emit('menu')"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import {
  createGame,
  type GameHandle,
  type GameStats,
  type RunResult,
  type DebugParamView,
  type UpgradeStatusView,
} from '../game/game';
import { sound } from '../game/sound';
import type { RunState } from '../game/upgrades';
import type { Difficulty } from '../game/difficulty';
import Hud from './hud.vue';
import Joystick from './joystick.vue';
import LevelUpModal from './level-up-modal.vue';
import GameOverModal from './game-over-modal.vue';
import VictoryModal from './victory-modal.vue';
import PauseMenuModal from './pause-menu-modal.vue';

const props = defineProps<{
  characterColor: [number, number, number];
  characterModel?: string;
  startRunState?: RunState;
  goldMultiplier: number;
  difficulty?: Difficulty;
}>();
const emit = defineEmits<{
  (e: 'gameover', result: RunResult): void;
  (e: 'menu'): void;
}>();

const canvasRef = ref<HTMLCanvasElement>();
const stats = reactive<GameStats>({
  fps: 0,
  enemies: 0,
  kills: 0,
  time: 0,
  hp: 0,
  maxHp: 0,
  level: 1,
  xp: 0,
  xpToNext: 1,
  state: 'running',
  choices: [],
  bossActive: false,
  bossHp: 0,
  bossMaxHp: 0,
  bossName: '',
  bossSkill: '',
  bossDefeated: 0,
  bossTotal: 5,
  goldEarned: 0,
  musicTrack: 0,
});

let game: GameHandle | undefined;


const MUTE_KEY = 'animal-survivors:muted';
const muted = ref(localStorage.getItem(MUTE_KEY) === '1');

const trackNames = sound.musicTrackNames;
const musicTrack = ref(0); // 隨擊敗王數自動切換，下拉同步顯示目前曲目

const showStats = ref(false);
const upgradeStatus = ref<UpgradeStatusView[]>([]);

const showDebug = ref(false);
const debugParams = ref<DebugParamView[]>([]);
const bossNames = ref<string[]>([]);
const summonIndex = ref(0);
const debugGroups = computed(() => {
  const map = new Map<string, (DebugParamView & { index: number })[]>();
  debugParams.value.forEach((p, i) => {
    if (!map.has(p.group)) map.set(p.group, []);
    map.get(p.group)!.push({ ...p, index: i });
  });
  return [...map.entries()].map(([group, items]) => ({ group, items }));
});

onMounted(() => {
  if (!canvasRef.value) return;
  game = createGame(canvasRef.value, {
    startRunState: props.startRunState,
    characterColor: props.characterColor,
    characterModel: props.characterModel,
    goldMultiplier: props.goldMultiplier,
    difficulty: props.difficulty,
    onStats: (s) => {
      Object.assign(stats, s);
      musicTrack.value = s.musicTrack; // 同步自動切歌後的下拉顯示
      if (showStats.value && game) upgradeStatus.value = game.getUpgradeStatus();
    },
    onGameOver: (r) => emit('gameover', r),
  });
  game.setMuted(muted.value);
});

onBeforeUnmount(() => game?.dispose());

function onJoyMove(dir: { x: number; z: number }) {
  game?.setJoystick(dir.x, dir.z);
}
function onJoyEnd() {
  game?.setJoystick(0, 0);
}
function onChoose(index: number) {
  game?.chooseUpgrade(index);
}
function onRestart() {
  game?.restart();
}
function onTogglePause() {
  game?.togglePause();
}
function onJump() {
  game?.jump();
}
function onToggleMute() {
  muted.value = !muted.value;
  localStorage.setItem(MUTE_KEY, muted.value ? '1' : '0');
  game?.setMuted(muted.value);
}
function onMusicTrack() {
  game?.setMusicTrack(musicTrack.value);
}
function onToggleStats() {
  showStats.value = !showStats.value;
  if (showStats.value && game) upgradeStatus.value = game.getUpgradeStatus();
}
function onToggleDebug() {
  /** 每次開啟參數面板都需通過驗證（答對作者全名）；關閉不需要 */
  if (!showDebug.value) {
    const answer = window.prompt('請問作者的全名（三個字）？');
    if (answer === null) return;
    if (answer.trim() !== '黃國書') {
      window.alert('答錯了，無法開啟 Debug');
      return;
    }
  }
  showDebug.value = !showDebug.value;
  if (showDebug.value && game) {
    debugParams.value = game.getDebugParams();
    bossNames.value = game.getBossNames();
  }
}
function onSummonBoss() {
  game?.summonBoss(summonIndex.value);
}
function onDebugInput(index: number, e: Event) {
  const v = Number((e.target as HTMLInputElement).value);
  if (debugParams.value[index]) debugParams.value[index].value = v;
  game?.setDebugParam(index, v);
}
function onDebugToggle(index: number, e: Event) {
  const v = (e.target as HTMLInputElement).checked ? 1 : 0;
  if (debugParams.value[index]) debugParams.value[index].value = v;
  game?.setDebugParam(index, v);
}
function fmt(v: number) {
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}
</script>
