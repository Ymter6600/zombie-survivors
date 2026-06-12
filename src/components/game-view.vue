<template>
  <div class="relative w-full h-full overflow-hidden bg-[#0b1020]">
    <canvas ref="canvasRef" class="w-full h-full block outline-none touch-none" />

    <hud :stats="stats" />

    <!-- 右上控制：debug（經驗 x10）＋ 暫停 -->
    <div v-show="stats.state === 'running'" class="absolute right-4 top-4 z-10 flex items-center gap-2">
      <button
        class="rounded-full px-3 py-2 text-xs font-black backdrop-blur-md transition active:scale-95"
        :class="xpDebug ? 'bg-lime-400 text-black' : 'bg-black/40 text-white/70'"
        @click="onToggleXpDebug"
      >
        🐞 EXP×10 {{ xpDebug ? 'ON' : 'OFF' }}
      </button>
      <button
        class="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-xl text-white backdrop-blur-md transition hover:bg-black/60 active:scale-95"
        @click="onToggleMute"
      >
        {{ muted ? '🔇' : '🔊' }}
      </button>
      <button
        class="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-xl text-white backdrop-blur-md transition hover:bg-black/60 active:scale-95"
        @click="onTogglePause"
      >
        ⏸
      </button>
      <button
        class="flex h-11 w-11 items-center justify-center rounded-full text-xl text-white backdrop-blur-md transition active:scale-95"
        :class="showStats ? 'bg-cyan-500' : 'bg-black/40 hover:bg-black/60'"
        @click="onToggleStats"
      >
        📊
      </button>
      <button
        class="flex h-11 w-11 items-center justify-center rounded-full text-xl text-white backdrop-blur-md transition active:scale-95"
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
import type { RunState } from '../game/upgrades';
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
});

let game: GameHandle | undefined;

const XP_DEBUG_KEY = 'animal-survivors:xpDebug';
const xpDebug = ref(localStorage.getItem(XP_DEBUG_KEY) === '1');

const MUTE_KEY = 'animal-survivors:muted';
const muted = ref(localStorage.getItem(MUTE_KEY) === '1');

const showStats = ref(false);
const upgradeStatus = ref<UpgradeStatusView[]>([]);

const showDebug = ref(false);
const debugParams = ref<DebugParamView[]>([]);
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
    onStats: (s) => {
      Object.assign(stats, s);
      if (showStats.value && game) upgradeStatus.value = game.getUpgradeStatus();
    },
    onGameOver: (r) => emit('gameover', r),
  });
  game.setXpDebug(xpDebug.value);
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
function onToggleXpDebug() {
  xpDebug.value = !xpDebug.value;
  localStorage.setItem(XP_DEBUG_KEY, xpDebug.value ? '1' : '0');
  game?.setXpDebug(xpDebug.value);
}
function onToggleMute() {
  muted.value = !muted.value;
  localStorage.setItem(MUTE_KEY, muted.value ? '1' : '0');
  game?.setMuted(muted.value);
}
function onToggleStats() {
  showStats.value = !showStats.value;
  if (showStats.value && game) upgradeStatus.value = game.getUpgradeStatus();
}
function onToggleDebug() {
  showDebug.value = !showDebug.value;
  if (showDebug.value && game) debugParams.value = game.getDebugParams();
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
