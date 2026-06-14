<template>
  <div class="absolute inset-0 overflow-auto text-white">
    <background-polygons />

    <div class="relative mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <div class="flex items-center gap-3 pt-4">
        <button
          class="rounded-full bg-white/10 px-4 py-2 font-black backdrop-blur-md transition hover:bg-white/20 active:scale-95"
          @click="emit('back')"
        >
          ← 返回
        </button>
        <h1 class="text-3xl font-black tracking-wider">🏆 排行榜</h1>
        <span
          class="rounded-full px-2 py-0.5 text-xs font-black"
          :class="isGlobal ? 'bg-lime-400 text-black' : 'bg-white/15 text-white/70'"
        >
          {{ isGlobal ? '全球' : '本機' }}
        </span>
      </div>

      <!-- 子榜切換 -->
      <div class="flex gap-2">
        <button
          v-for="m in modes"
          :key="m.id"
          class="flex-1 rounded-full px-3 py-2 text-sm font-black backdrop-blur-md transition active:scale-95"
          :class="mode === m.id ? 'bg-lime-400 text-black' : 'bg-black/40 text-white/70 hover:bg-black/60'"
          @click="selectMode(m.id)"
        >
          {{ m.label }}
        </button>
      </div>

      <p class="-mt-1 text-center text-xs text-white/45">{{ modeHint }}</p>

      <!-- 難度分頁 -->
      <div class="flex flex-wrap gap-2">
        <button
          v-for="t in tabs"
          :key="t.id"
          class="rounded-full px-3 py-1 text-sm font-black backdrop-blur-md transition active:scale-95"
          :class="selected === t.id ? 'bg-amber-400 text-black' : 'bg-black/40 text-white/70 hover:bg-black/60'"
          @click="selectTab(t.id)"
        >
          {{ t.label }}
        </button>
      </div>

      <div v-if="records.length === 0" class="rounded-2xl bg-white/5 p-8 text-center text-white/60">
        {{ emptyHint }}
      </div>

      <div v-else class="overflow-hidden rounded-2xl bg-black/40 backdrop-blur-md ring-1 ring-white/10">
        <div class="grid grid-cols-[2.5rem_1fr_4.5rem_3.5rem_3rem] gap-2 border-b border-white/10 px-4 py-2 text-xs font-black text-white/50">
          <span>#</span>
          <span>玩家</span>
          <span class="text-right">{{ mode === 'cleared' ? '破關' : '存活' }}</span>
          <span class="text-right">擊殺</span>
          <span class="text-right">等級</span>
        </div>
        <div
          v-for="(r, i) in records"
          :key="i"
          class="grid grid-cols-[2.5rem_1fr_4.5rem_3.5rem_3rem] items-center gap-2 px-4 py-2 text-sm"
          :class="i % 2 ? 'bg-white/0' : 'bg-white/5'"
        >
          <span class="font-black" :class="rankClass(i)">{{ i + 1 }}</span>
          <span class="min-w-0 truncate font-bold">
            {{ r.name || '玩家' }}
            <span class="text-[0.66rem] font-normal text-white/45">{{ r.character }}</span>
            <span v-if="selected === ''" class="ml-1 text-[0.62rem]" :style="{ color: diffColor(r.difficulty) }">
              {{ diffLabel(r.difficulty) }}
            </span>
          </span>
          <span class="text-right font-mono" :class="mode === 'cleared' ? 'text-amber-300' : ''">{{ timeText(r.time) }}</span>
          <span class="text-right">{{ r.kills }}</span>
          <span class="text-right">{{ r.level }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import BackgroundPolygons from './background-polygons.vue';
import { loadRecords, type RunRecord } from '../game/leaderboard';
import { fetchLeaderboard } from '../game/api';
import { DIFFICULTIES, getDifficulty } from '../game/difficulty';

const emit = defineEmits<{ (e: 'back'): void }>();

type Mode = 'cleared' | 'survival';
const modes: { id: Mode; label: string }[] = [
  { id: 'cleared', label: '🏆 破關榜' },
  { id: 'survival', label: '🛡️ 生存榜' },
];
const tabs = [{ id: '', label: '全部' }, ...DIFFICULTIES.map((d) => ({ id: d.id, label: `${d.emoji} ${d.name}` }))];

const mode = ref<Mode>('cleared');
const selected = ref('');
const records = ref<RunRecord[]>([]);
const isGlobal = ref(false);

const modeHint = computed(() =>
  mode.value === 'cleared' ? '擊敗全部 7 王者，比誰破關最快' : '未破關者，比誰活得最久',
);
const emptyHint = computed(() =>
  mode.value === 'cleared' ? '此難度尚無人破關，來搶頭香！' : '此難度尚無紀錄，快去拚一場！',
);

async function refresh() {
  const diff = selected.value;
  const cleared = mode.value === 'cleared';
  /** 先顯示本機（過濾難度＋破關狀態，依子榜排序），抓到全球榜就覆蓋 */
  records.value = loadRecords()
    .filter((r) => (!diff || r.difficulty === diff) && !!r.won === cleared)
    .sort((a, b) => (cleared ? a.time - b.time : b.time - a.time))
    .slice(0, 10);
  isGlobal.value = false;
  const global = await fetchLeaderboard(10, diff || undefined, mode.value);
  if (global) {
    records.value = global;
    isGlobal.value = true;
  }
}
function selectMode(m: Mode) {
  mode.value = m;
  void refresh();
}
function selectTab(id: string) {
  selected.value = id;
  void refresh();
}
onMounted(refresh);

function timeText(t: number) {
  const total = Math.floor(t);
  return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, '0')}`;
}
function rankClass(i: number) {
  return ['text-amber-300', 'text-slate-200', 'text-orange-400'][i] ?? 'text-white/50';
}
function diffLabel(id: string) {
  const d = getDifficulty(id || 'easy');
  return `${d.emoji}${d.name}`;
}
function diffColor(id: string) {
  return getDifficulty(id || 'easy').color;
}
</script>
