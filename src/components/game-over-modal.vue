<template>
  <div class="absolute inset-0 z-20 flex items-center justify-center bg-black/65 backdrop-blur-sm">
    <div class="w-[min(90vw,26rem)] rounded-3xl bg-[#1a2236] p-8 text-center text-white shadow-2xl ring-1 ring-white/10">
      <div class="text-4xl font-black text-rose-400">你被淹沒了！</div>

      <div class="my-5 grid grid-cols-3 gap-3">
        <div class="rounded-2xl bg-white/5 p-3">
          <div class="text-xs text-white/60">存活</div>
          <div class="text-2xl font-black">{{ timeText }}</div>
        </div>
        <div class="rounded-2xl bg-white/5 p-3">
          <div class="text-xs text-white/60">擊殺</div>
          <div class="text-2xl font-black">{{ stats.kills }}</div>
        </div>
        <div class="rounded-2xl bg-white/5 p-3">
          <div class="text-xs text-white/60">等級</div>
          <div class="text-2xl font-black">{{ stats.level }}</div>
        </div>
      </div>

      <div class="mb-6 rounded-2xl bg-amber-400/15 py-2 text-xl font-black text-amber-300">
        獲得 💰 {{ stats.goldEarned }}
      </div>

      <div class="flex gap-3">
        <button
          class="flex-1 rounded-full bg-white/10 px-4 py-3 text-lg font-black transition hover:bg-white/20 active:scale-95"
          @click="emit('menu')"
        >
          主選單
        </button>
        <button
          class="flex-1 rounded-full bg-amber-400 px-4 py-3 text-lg font-black text-black transition hover:bg-amber-300 active:scale-95"
          @click="emit('restart')"
        >
          再玩一次
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { GameStats } from '../game/game';

const props = defineProps<{ stats: GameStats }>();
const emit = defineEmits<{ (e: 'restart'): void; (e: 'menu'): void }>();

const timeText = computed(() => {
  const total = Math.floor(props.stats.time);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
});
</script>
