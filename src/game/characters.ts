import type { RunState } from './upgrades';

export interface Character {
  id: string;
  name: string;
  emoji: string;
  /** 解鎖所需金幣，0 為預設已解鎖 */
  cost: number;
  /** 一句話特性 */
  trait: string;
  /** 身體顏色（程序化造型 fallback 用） */
  bodyColor: [number, number, number];
  /** GLB 模型路徑（無則用程序化造型） */
  model?: string;
  /** 套用至起始 RunState 的角色差異 */
  apply: (s: RunState) => void;
}

export const CHARACTERS: Character[] = [
  {
    id: 'matt',
    name: '麥特',
    emoji: '🔫',
    cost: 0,
    trait: '均衡｜起始攻擊：強化單發子彈',
    bodyColor: [0.3, 0.45, 0.6],
    model: '/models/zombie/survivor_matt_armed.gltf',
    apply: (s) => {
      s.damage += 1;
    },
  },
  {
    id: 'lis',
    name: '莉絲',
    emoji: '👟',
    cost: 300,
    trait: '高速脆皮｜起始攻擊：三連發散射',
    bodyColor: [0.8, 0.4, 0.5],
    model: '/models/zombie/survivor_lis_armed.gltf',
    apply: (s) => {
      s.moveSpeed *= 1.2;
      s.maxHp -= 25;
      s.projectileCount = 3;
    },
  },
  {
    id: 'sam',
    name: '山姆',
    emoji: '⚡',
    cost: 300,
    trait: '輸出爆發｜起始攻擊：極速連射',
    bodyColor: [0.85, 0.7, 0.3],
    model: '/models/zombie/survivor_sam_armed.gltf',
    apply: (s) => {
      s.fireInterval *= 0.55;
      s.maxHp -= 15;
    },
  },
  {
    id: 'shaun',
    name: '尚恩',
    emoji: '🧲',
    cost: 200,
    trait: '拾取廣｜起始攻擊：環繞飛斧',
    bodyColor: [0.5, 0.6, 0.45],
    model: '/models/zombie/survivor_shaun_armed.gltf',
    apply: (s) => {
      s.pickupRadius *= 1.7;
      s.xpMultiplier *= 1.2;
      s.orbitalCount = 1;
    },
  },
  {
    id: 'shepherd',
    name: '德國狼犬',
    emoji: '🐕',
    cost: 400,
    trait: '機動忠犬｜起始攻擊：連鎖閃電',
    bodyColor: [0.5, 0.35, 0.2],
    model: '/models/zombie/char_shepherd.gltf',
    apply: (s) => {
      s.moveSpeed *= 1.15;
      s.range *= 1.15;
      s.lightningCount = 1;
    },
  },
  {
    id: 'pug',
    name: '巴哥犬',
    emoji: '🐶',
    cost: 350,
    trait: '肉盾｜起始攻擊：傷害光環',
    bodyColor: [0.8, 0.7, 0.5],
    model: '/models/zombie/char_pug.gltf',
    apply: (s) => {
      s.maxHp += 40;
      s.moveSpeed *= 0.9;
      s.auraRadius = 4;
    },
  },
];

export function getCharacter(id: string): Character {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
}
