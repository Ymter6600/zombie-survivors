<template>
  <div class="relative w-full h-full overflow-hidden bg-[#0b1020]">
    <canvas ref="canvasRef" class="w-full h-full block outline-none touch-none" />

    <hud :stats="stats" @set-count="onSetCount" />

    <joystick class="absolute bottom-8 left-8 z-10" @move="onJoyMove" @end="onJoyEnd" />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { createGame, type GameHandle, type GameStats } from '../game/game';
import Hud from './hud.vue';
import Joystick from './joystick.vue';

const canvasRef = ref<HTMLCanvasElement>();
const stats = reactive<GameStats>({ fps: 0, enemies: 0, kills: 0, time: 0, hp: 0, maxHp: 0 });

let game: GameHandle | undefined;

onMounted(() => {
  if (!canvasRef.value) return;
  game = createGame(canvasRef.value, {
    onStats: (s) => Object.assign(stats, s),
  });
});

onBeforeUnmount(() => game?.dispose());

function onJoyMove(dir: { x: number; z: number }) {
  game?.setJoystick(dir.x, dir.z);
}
function onJoyEnd() {
  game?.setJoystick(0, 0);
}
function onSetCount(n: number) {
  game?.setEnemyCount(n);
}
</script>
