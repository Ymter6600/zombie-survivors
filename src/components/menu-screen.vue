<template>
  <div class="absolute inset-0 overflow-auto bg-gradient-to-b from-[#0b1020] to-[#161f38] text-white">
    <div class="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <!-- 標題 -->
      <div class="pt-4 text-center">
        <div class="text-5xl font-black tracking-wider">動物大逃殺</div>
        <div class="mt-1 text-sm text-white/60">3D 倖存者類 roguelite</div>
        <div class="mt-3 inline-block rounded-full bg-amber-400/90 px-5 py-1 text-lg font-black text-black">
          💰 {{ meta.gold }}
        </div>
      </div>

      <!-- 角色 -->
      <div>
        <div class="mb-2 text-lg font-black">選擇角色</div>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div
            v-for="c in characters"
            :key="c.id"
            class="flex cursor-pointer flex-col items-center gap-1 rounded-2xl p-3 text-center ring-2 transition"
            :class="cardClass(c.id)"
            @click="onCard(c)"
          >
            <span class="text-4xl">{{ c.emoji }}</span>
            <span class="font-black">{{ c.name }}</span>
            <span class="text-[0.7rem] leading-tight text-white/60">{{ c.trait }}</span>
            <span
              v-if="!isUnlocked(c.id)"
              class="mt-1 rounded-full bg-amber-400 px-2 py-0.5 text-xs font-black text-black"
              :class="{ 'opacity-40': meta.gold < c.cost }"
            >
              解鎖 💰{{ c.cost }}
            </span>
          </div>
        </div>
      </div>

      <!-- 商店 -->
      <div>
        <div class="mb-2 text-lg font-black">永久強化</div>
        <div class="flex flex-col gap-2">
          <div
            v-for="p in perma"
            :key="p.id"
            class="flex items-center gap-3 rounded-2xl bg-white/5 p-3"
          >
            <span class="text-2xl">{{ p.emoji }}</span>
            <div class="flex-1">
              <div class="font-black">{{ p.name }} <span class="text-white/50">{{ level(p.id) }}/{{ p.maxLevel }}</span></div>
              <div class="text-xs text-white/60">{{ p.desc }}</div>
            </div>
            <button
              class="rounded-full px-4 py-2 text-sm font-black transition"
              :class="buyClass(p)"
              :disabled="!canBuy(p)"
              @click="emit('buy', p.id)"
            >
              {{ level(p.id) >= p.maxLevel ? '已滿' : `💰${cost(p)}` }}
            </button>
          </div>
        </div>
      </div>

      <!-- 開始 -->
      <button
        class="sticky bottom-4 mt-2 w-full rounded-full bg-amber-400 py-4 text-2xl font-black text-black shadow-lg transition hover:bg-amber-300 active:scale-95"
        @click="emit('start', selectedId)"
      >
        ▶ 開始（{{ selectedName }}）
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { CHARACTERS, getCharacter, type Character } from '../game/characters';
import { PERMA, permaCost, type MetaData, type PermaUpgrade } from '../game/meta';

const props = defineProps<{ meta: MetaData }>();
const emit = defineEmits<{
  (e: 'start', characterId: string): void;
  (e: 'buy', permaId: string): void;
  (e: 'unlock', characterId: string): void;
}>();

const characters = CHARACTERS;
const perma = PERMA;
const selectedId = ref('penguin');

const selectedName = computed(() => getCharacter(selectedId.value).name);

function isUnlocked(id: string) {
  return props.meta.unlocked.includes(id);
}
function level(id: string) {
  return props.meta.perma[id] ?? 0;
}
function cost(p: PermaUpgrade) {
  return permaCost(p, level(p.id));
}
function canBuy(p: PermaUpgrade) {
  return level(p.id) < p.maxLevel && props.meta.gold >= cost(p);
}
function buyClass(p: PermaUpgrade) {
  return canBuy(p) ? 'bg-amber-400 text-black hover:bg-amber-300' : 'bg-white/10 text-white/40';
}
function cardClass(id: string) {
  if (selectedId.value === id) return 'bg-amber-400/20 ring-amber-300';
  if (isUnlocked(id)) return 'bg-white/5 ring-white/10 hover:ring-white/30';
  return 'bg-black/30 ring-white/5 opacity-80';
}
function onCard(c: Character) {
  if (isUnlocked(c.id)) {
    selectedId.value = c.id;
  } else if (props.meta.gold >= c.cost) {
    emit('unlock', c.id);
    selectedId.value = c.id;
  }
}
</script>
