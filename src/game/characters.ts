import type { RunState } from './upgrades';

export interface Character {
  id: string;
  name: string;
  emoji: string;
  /** 解鎖所需金幣，0 為預設已解鎖 */
  cost: number;
  /** 一句話特性 */
  trait: string;
  /** 身體顏色（程序化模型用） */
  bodyColor: [number, number, number];
  /** 套用至起始 RunState 的角色差異 */
  apply: (s: RunState) => void;
}

export const CHARACTERS: Character[] = [
  {
    id: 'penguin',
    name: '企鵝',
    emoji: '🐧',
    cost: 0,
    trait: '均衡，無明顯弱點',
    bodyColor: [0.2, 0.3, 0.45],
    apply: () => {},
  },
  {
    id: 'fox',
    name: '狐狸',
    emoji: '🦊',
    cost: 300,
    trait: '高速但脆皮',
    bodyColor: [0.95, 0.45, 0.15],
    apply: (s) => {
      s.moveSpeed *= 1.2;
      s.maxHp -= 25;
    },
  },
  {
    id: 'chick',
    name: '小雞',
    emoji: '🐤',
    cost: 300,
    trait: '高攻速、輸出爆發',
    bodyColor: [1, 0.85, 0.2],
    apply: (s) => {
      s.fireInterval *= 0.78;
      s.maxHp -= 15;
    },
  },
  {
    id: 'mouse',
    name: '老鼠',
    emoji: '🐭',
    cost: 200,
    trait: '拾取範圍大、經驗多',
    bodyColor: [0.6, 0.6, 0.65],
    apply: (s) => {
      s.pickupRadius *= 1.7;
      s.xpMultiplier *= 1.2;
    },
  },
];

export function getCharacter(id: string): Character {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
}
