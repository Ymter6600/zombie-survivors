<template>
  <div class="relative w-full h-full overflow-hidden bg-[#0b1020]">
    <canvas ref="canvasRef" class="w-full h-full block outline-none touch-none" />

    <hud :stats="stats" />

    <joystick
      v-show="stats.state === 'running'"
      class="absolute bottom-8 left-8 z-10"
      @move="onJoyMove"
      @end="onJoyEnd"
    />

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
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { createGame, type GameHandle, type GameStats, type RunResult } from '../game/game';
import type { RunState } from '../game/upgrades';
import Hud from './hud.vue';
import Joystick from './joystick.vue';
import LevelUpModal from './level-up-modal.vue';
import GameOverModal from './game-over-modal.vue';

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
  goldEarned: 0,
});

let game: GameHandle | undefined;

onMounted(() => {
  if (!canvasRef.value) return;
  game = createGame(canvasRef.value, {
    startRunState: props.startRunState,
    characterColor: props.characterColor,
    characterModel: props.characterModel,
    goldMultiplier: props.goldMultiplier,
    onStats: (s) => Object.assign(stats, s),
    onGameOver: (r) => emit('gameover', r),
  });
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
</script>
