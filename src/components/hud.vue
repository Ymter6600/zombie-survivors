<template>
  <div class="pointer-events-none absolute inset-0 z-10 select-none">
    <!-- 左上：狀態 -->
    <div class="absolute top-4 left-4 flex flex-col gap-2 text-white">
      <div class="flex items-center gap-3 rounded-2xl bg-black/40 px-4 py-2 backdrop-blur-md">
        <span class="text-3xl font-black tracking-wider">動物大逃殺</span>
        <span class="text-xs opacity-60">效能原型</span>
      </div>

      <div class="flex flex-wrap gap-2 text-sm font-bold">
        <span class="rounded-xl bg-black/40 px-3 py-1 backdrop-blur-md" :class="fpsClass">
          FPS {{ stats.fps }}
        </span>
        <span class="rounded-xl bg-black/40 px-3 py-1 backdrop-blur-md">敵人 {{ stats.enemies }}</span>
        <span class="rounded-xl bg-black/40 px-3 py-1 backdrop-blur-md">擊殺 {{ stats.kills }}</span>
        <span class="rounded-xl bg-black/40 px-3 py-1 backdrop-blur-md">時間 {{ timeText }}</span>
      </div>

      <!-- 血量 -->
      <div class="h-4 w-56 overflow-hidden rounded-full bg-black/40 backdrop-blur-md">
        <div
          class="h-full rounded-full bg-gradient-to-r from-red-500 to-rose-400 transition-[width] duration-100"
          :style="{ width: hpPercent + '%' }"
        />
      </div>
    </div>

    <!-- 右上：壓測敵人數 -->
    <div class="pointer-events-auto absolute top-4 right-4 flex flex-col items-end gap-2 text-white">
      <div class="rounded-2xl bg-black/40 px-4 py-3 backdrop-blur-md">
        <div class="mb-1 text-xs font-bold opacity-70">敵人數量（壓測）</div>
        <div class="flex items-center gap-3">
          <input
            type="range"
            min="0"
            max="2500"
            step="100"
            :value="count"
            class="w-44 accent-amber-400"
            @input="onInput"
          />
          <span class="w-12 text-right font-black">{{ count }}</span>
        </div>
      </div>
    </div>

    <!-- 操作提示 -->
    <div class="absolute bottom-4 right-4 rounded-xl bg-black/30 px-3 py-1 text-xs text-white/70 backdrop-blur-md">
      WASD／方向鍵移動・左下搖桿（觸控）・武器自動攻擊
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { GameStats } from '../game/game';

const props = defineProps<{ stats: GameStats }>();
const emit = defineEmits<{ (e: 'set-count', n: number): void }>();

const count = ref(props.stats.enemies || 600);

const hpPercent = computed(() =>
  props.stats.maxHp > 0 ? (props.stats.hp / props.stats.maxHp) * 100 : 0,
);
const timeText = computed(() => {
  const total = Math.floor(props.stats.time);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
});
const fpsClass = computed(() =>
  props.stats.fps >= 55 ? 'text-green-300' : props.stats.fps >= 30 ? 'text-amber-300' : 'text-red-300',
);

function onInput(e: Event) {
  const value = Number((e.target as HTMLInputElement).value);
  count.value = value;
  emit('set-count', value);
}
</script>
