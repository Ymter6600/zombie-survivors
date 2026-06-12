import { CONFIG } from './config';

/** 一輪遊戲的可變數值（會被升級修改） */
export interface RunState {
  // 玩家
  moveSpeed: number;
  maxHp: number;
  /** 經驗吸取範圍 */
  pickupRadius: number;
  xpMultiplier: number;
  // 武器
  damage: number;
  fireInterval: number;
  projectileCount: number;
  range: number;
  projectileSpeed: number;
  // 環繞衛星
  orbitalCount: number;
  orbitalDamage: number;
  orbitalRadius: number;
  orbitalSpeed: number;
  // 傷害光環
  auraRadius: number;
  auraDamage: number;
  // 連鎖閃電
  lightningCount: number;
  lightningDamage: number;
  // 新星爆
  novaRadius: number;
  novaDamage: number;
  // 回力鏢
  boomerangCount: number;
  boomerangDamage: number;
}

export function createRunState(): RunState {
  return {
    moveSpeed: CONFIG.player.speed,
    maxHp: CONFIG.player.maxHp,
    pickupRadius: 5,
    xpMultiplier: 1,
    damage: CONFIG.weapon.damage,
    fireInterval: CONFIG.weapon.fireInterval,
    projectileCount: 1,
    range: CONFIG.weapon.range,
    projectileSpeed: CONFIG.weapon.projectileSpeed,
    orbitalCount: 0,
    orbitalDamage: 2,
    orbitalRadius: 4,
    orbitalSpeed: 2.4,
    auraRadius: 0,
    auraDamage: 1,
    lightningCount: 0,
    lightningDamage: 3,
    novaRadius: 0,
    novaDamage: 4,
    boomerangCount: 0,
    boomerangDamage: 4,
  };
}

export interface Upgrade {
  id: string;
  name: string;
  desc: string;
  emoji: string;
  maxLevel: number;
  apply: (s: RunState) => void;
}

export const UPGRADES: Upgrade[] = [
  { id: 'damage', name: '攻擊力', desc: '武器傷害 +1', emoji: '⚔️', maxLevel: 8, apply: (s) => (s.damage += 1) },
  { id: 'firerate', name: '攻速', desc: '發射間隔 −12%', emoji: '⚡', maxLevel: 8, apply: (s) => (s.fireInterval *= 0.88) },
  { id: 'multishot', name: '多重彈', desc: '投射物 +1', emoji: '🎯', maxLevel: 4, apply: (s) => (s.projectileCount += 1) },
  { id: 'range', name: '射程', desc: '鎖定範圍 +20%', emoji: '🔭', maxLevel: 5, apply: (s) => (s.range *= 1.2) },
  { id: 'projspeed', name: '彈速', desc: '投射物速度 +20%', emoji: '💨', maxLevel: 5, apply: (s) => (s.projectileSpeed *= 1.2) },
  { id: 'movespeed', name: '移動速度', desc: '移速 +10%', emoji: '👟', maxLevel: 5, apply: (s) => (s.moveSpeed *= 1.1) },
  { id: 'maxhp', name: '最大生命', desc: '生命上限 +20 並補滿', emoji: '❤️', maxLevel: 5, apply: (s) => (s.maxHp += 20) },
  { id: 'magnet', name: '拾取範圍', desc: '經驗吸取範圍 +30%', emoji: '🧲', maxLevel: 5, apply: (s) => (s.pickupRadius *= 1.3) },
  { id: 'xpgain', name: '經驗加成', desc: '經驗獲得 +15%', emoji: '⭐', maxLevel: 5, apply: (s) => (s.xpMultiplier *= 1.15) },
  {
    id: 'orbital',
    name: '環繞飛斧',
    desc: '召喚環繞身邊的旋轉斧頭，碰撞傷害敵人；已有則 +1 把並擴大環繞範圍',
    emoji: '🪓',
    maxLevel: 10,
    apply: (s) => {
      s.orbitalCount += 1;
      s.orbitalDamage += 1;
      s.orbitalRadius += 1.4;
    },
  },
  {
    id: 'aura',
    name: '傷害光環',
    desc: '展開持續傷害光環，自動灼燒靠近的敵人；已有則擴大並增傷',
    emoji: '🌀',
    maxLevel: 10,
    apply: (s) => {
      s.auraRadius = s.auraRadius === 0 ? 4 : s.auraRadius + 1.6;
      s.auraDamage += 1;
    },
  },
  {
    id: 'lightning',
    name: '連鎖閃電',
    desc: '定期電擊最近的敵人並向周圍連鎖；已有則 +1 連鎖數並增傷',
    emoji: '⚡',
    maxLevel: 10,
    apply: (s) => {
      s.lightningCount += 1;
      s.lightningDamage += 1;
    },
  },
  {
    id: 'nova',
    name: '新星爆',
    desc: '定期釋放向外擴張的衝擊波，炸傷周圍所有敵人；已有則擴大並增傷',
    emoji: '💥',
    maxLevel: 10,
    apply: (s) => {
      s.novaRadius = s.novaRadius === 0 ? 6 : s.novaRadius + 1;
      s.novaDamage += 2;
    },
  },
  {
    id: 'boomerang',
    name: '回力鏢',
    desc: '定期丟出長矛飛出再飛回，沿途貫穿傷害敵人；已有則 +1 支並增傷',
    emoji: '🪃',
    maxLevel: 10,
    apply: (s) => {
      s.boomerangCount += 1;
      s.boomerangDamage += 1;
    },
  },
];

/** 從尚未滿級的升級中隨機抽 n 個 */
export function rollChoices(levels: Record<string, number>, n = 3): Upgrade[] {
  const pool = UPGRADES.filter((u) => (levels[u.id] ?? 0) < u.maxLevel);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

/** 升到指定等級所需經驗 */
export function xpForLevel(level: number): number {
  return 5 + level * 4;
}
