<template>
  <menu-screen v-if="screen === 'menu'" :meta="meta" @start="onStart" @buy="onBuy" @unlock="onUnlock" />
  <game-view
    v-else
    :character-color="characterColor"
    :start-run-state="startRun"
    :gold-multiplier="goldMul"
    @gameover="onGameOver"
    @menu="onMenu"
  />
</template>

<script setup lang="ts">
import { reactive, ref, shallowRef } from 'vue';
import MenuScreen from './components/menu-screen.vue';
import GameView from './components/game-view.vue';
import { loadMeta, saveMeta, computeStartRunState, goldMultiplier, PERMA, permaCost } from './game/meta';
import { getCharacter } from './game/characters';
import type { RunState } from './game/upgrades';
import type { RunResult } from './game/game';

const meta = reactive(loadMeta());
const screen = ref<'menu' | 'game'>('menu');

const startRun = shallowRef<RunState>();
const characterColor = ref<[number, number, number]>([1, 1, 1]);
const goldMul = ref(1);

function onStart(charId: string) {
  startRun.value = computeStartRunState(charId, meta.perma);
  characterColor.value = getCharacter(charId).bodyColor;
  goldMul.value = goldMultiplier(meta.perma);
  screen.value = 'game';
}

function onGameOver(result: RunResult) {
  meta.gold += result.gold;
  saveMeta(meta);
}

function onMenu() {
  screen.value = 'menu';
}

function onBuy(permaId: string) {
  const p = PERMA.find((x) => x.id === permaId);
  if (!p) return;
  const lvl = meta.perma[permaId] ?? 0;
  if (lvl >= p.maxLevel) return;
  const c = permaCost(p, lvl);
  if (meta.gold < c) return;
  meta.gold -= c;
  meta.perma[permaId] = lvl + 1;
  saveMeta(meta);
}

function onUnlock(charId: string) {
  const ch = getCharacter(charId);
  if (meta.unlocked.includes(charId) || meta.gold < ch.cost) return;
  meta.gold -= ch.cost;
  meta.unlocked.push(charId);
  saveMeta(meta);
}
</script>
