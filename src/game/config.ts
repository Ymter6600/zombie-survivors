/** 里程碑 1（效能原型）可調參數 */
export const CONFIG = {
  /** 場地半徑（玩家活動範圍與敵人邊界） */
  arenaHalf: 70,

  player: {
    speed: 16,
    radius: 0.9,
    maxHp: 100,
    /** 接觸敵人時每秒受到的傷害 */
    contactDps: 12,
  },

  enemy: {
    /** 同時存活的敵人數，可在 HUD 調整以壓測 */
    count: 600,
    /** 上限容量（thin instance 緩衝大小） */
    capacity: 3000,
    speed: 5.5,
    radius: 0.6,
    /** 視覺與站立高度 */
    y: 0.7,
    hp: 3,
    /** 彼此分離的半徑與力度 */
    separationRadius: 1.3,
    separationForce: 9,
    /** 從玩家周圍環狀生成的距離 */
    spawnRingMin: 38,
    spawnRingMax: 60,
  },

  weapon: {
    /** 自動發射間隔（秒） */
    fireInterval: 0.45,
    projectileSpeed: 34,
    projectileRadius: 0.6,
    damage: 1,
    /** 鎖定範圍 */
    range: 45,
    maxProjectiles: 300,
    lifetime: 1.4,
  },

  /** 空間網格 cell 大小（約等於敵人分離半徑量級） */
  gridCellSize: 3,
};
