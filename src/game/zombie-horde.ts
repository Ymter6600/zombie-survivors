import { Scene, TransformNode, SceneLoader, AnimationGroup, AbstractMesh, Color3 } from '@babylonjs/core';
import '@babylonjs/loaders';
import { CONFIG } from './config';
import { SpatialGrid } from './spatial-grid';
import { Obstacle, resolveObstacles } from './obstacles';
import { BossHazards } from './boss-hazards';

interface ZombieType {
  path: string;
  hp: number;
  speed: number;
  /** 相對基準身高的縮放 */
  scale: number;
  /** 遠程射手：保持距離並朝玩家發射彈丸 */
  ranged?: boolean;
}

/** 遠程怪：發射間隔、開火距離、保持距離、彈丸傷害 */
const FIRE_INTERVAL = 2.2;
const FIRE_RANGE = 26;
const KEEP_DIST = 13;

const ZOMBIE_TYPES: ZombieType[] = [
  { path: '/models/zombie/zombie_basic.glb', hp: 3, speed: 5.5, scale: 1 },
  { path: '/models/zombie/zombie_ribcage.glb', hp: 2, speed: 8, scale: 0.95 }, // 快速
  { path: '/models/zombie/zombie_chubby.glb', hp: 12, speed: 3.2, scale: 1.35 }, // 坦克
  { path: '/models/zombie/zombie_arm.glb', hp: 4, speed: 5, scale: 1 },
  { path: '/models/zombie/zombie_skeleton.glb', hp: 4, speed: 6, scale: 1 }, // 不死骷髏
  { path: '/models/zombie/zombie_skeleton_headless.glb', hp: 6, speed: 5, scale: 1, ranged: true }, // 無頭骷髏（遠程）
];

/** 怪物圖鑑資訊（供選單顯示） */
export const ZOMBIE_INFO = [
  { name: '基本殭屍', role: '雜兵', desc: '數量最多、血量普通的基本殭屍，靠數量淹沒你。', model: '/models/zombie/zombie_basic.glb' },
  { name: '肋骨怪', role: '快速', desc: '移動速度極快、血量低，會迅速貼近，優先處理。', model: '/models/zombie/zombie_ribcage.glb' },
  { name: '胖殭屍', role: '坦克', desc: '血量厚、移動慢的肉盾，需要較多火力才打得倒。', model: '/models/zombie/zombie_chubby.glb' },
  { name: '斷臂殭屍', role: '一般', desc: '中規中矩的近戰殭屍，速度與血量都中等。', model: '/models/zombie/zombie_arm.glb' },
  { name: '骷髏兵', role: '不死', desc: '海盜骷髏，移動偏快、血量普通，成群出現。', model: '/models/zombie/zombie_skeleton.glb' },
  { name: '無頭骷髏', role: '遠程', desc: '保持距離朝你發射彈丸的不死射手，會被逼近時後退。', model: '/models/zombie/zombie_skeleton_headless.glb' },
];

const BASE_HEIGHT = 2.4;
/** 每種類型預先 instantiate 的數量（總和為怪海上限；6 類型 × 9 = 54 ≥ director.maxCount） */
const PER_TYPE = 9;
/** 怪物血量全域倍率 */
const HP_SCALE = 0.75;
/** 受擊白光持續時間（秒） */
const FLASH_DUR = 0.16;
const WHITE = new Color3(1, 1, 1);

interface Entry {
  root: TransformNode;
  anim?: AnimationGroup;
  baseSpeed: number;
  /** 實際渲染的網格，用於受擊白光 overlay */
  meshes: AbstractMesh[];
}

/**
 * 殭屍怪群：預先 instantiate 一池「有骨架動畫」的殭屍，導演以 setCount 啟用前 N 隻。
 * 介面對齊原 EnemySystem（count/getX/getZ/isAlive/damage/update/insertAll/reset）。
 */
export class ZombieHorde {
  count = 0;
  hpMul = 1;
  speedMul = 1;
  tier = 0;

  private scene: Scene;
  private ready = false;
  private pool: Entry[] = [];
  private posX: Float32Array;
  private posZ: Float32Array;
  private hp: Float32Array;
  /** 受擊回饋計時（>0 時縮放彈跳） */
  private hitFlash: Float32Array;
  /** 冰凍剩餘時間（>0 時不動） */
  private freezeTimer: Float32Array;
  /** 遠程開火計時 */
  private fireTimer: Float32Array;
  private capacity = ZOMBIE_TYPES.length * PER_TYPE;
  /** 遠程怪彈丸傷害（依難度調整） */
  rangedDamage = 7;
  private hazards?: BossHazards;
  /** 地形高度查詢（貼地用） */
  private heightAt: (x: number, z: number) => number = () => 0;

  constructor(scene: Scene) {
    this.scene = scene;
    this.posX = new Float32Array(this.capacity);
    this.posZ = new Float32Array(this.capacity);
    this.hp = new Float32Array(this.capacity);
    this.hitFlash = new Float32Array(this.capacity);
    this.freezeTimer = new Float32Array(this.capacity);
    this.fireTimer = new Float32Array(this.capacity);
    void this.init();
  }

  private async init() {
    const containers = await Promise.all(
      ZOMBIE_TYPES.map((t) => {
        const slash = t.path.lastIndexOf('/');
        return SceneLoader.LoadAssetContainerAsync(t.path.slice(0, slash + 1), t.path.slice(slash + 1), this.scene);
      }),
    );

    /** 交錯各類型，啟用前 N 隻時自然會有多樣性 */
    for (let k = 0; k < PER_TYPE; k++) {
      for (let ti = 0; ti < ZOMBIE_TYPES.length; ti++) {
        const t = ZOMBIE_TYPES[ti];
        const inst = containers[ti].instantiateModelsToScene(undefined, false);
        const modelRoot = inst.rootNodes[0] as TransformNode;
        this.normalize(modelRoot, BASE_HEIGHT * t.scale);

        /** 以自有 holder 包住 glTF 根（其帶有 rotationQuaternion，直接設 rotation.y 無效）
         *  之後旋轉 holder 來轉向 */
        const holder = new TransformNode('zombie', this.scene);
        modelRoot.parent = holder;
        holder.setEnabled(false);

        inst.animationGroups.forEach((a) => a.stop());
        const anim =
          inst.animationGroups.find((a) => /walk|run|move/i.test(a.name)) ??
          inst.animationGroups.find((a) => /idle/i.test(a.name)) ??
          inst.animationGroups[0];

        /** 取出實際網格，預設關閉白光 overlay */
        const meshes = modelRoot.getChildMeshes(false);
        for (const m of meshes) {
          m.overlayColor = WHITE;
          m.overlayAlpha = 0;
          m.renderOverlay = false;
        }

        this.pool.push({ root: holder, anim, baseSpeed: t.speed, meshes });
      }
    }

    this.ready = true;
  }

  setHeightFn(fn: (x: number, z: number) => number) {
    this.heightAt = fn;
  }

  /** 提供遠程怪發射彈丸用的危險物系統 */
  setHazards(hazards: BossHazards) {
    this.hazards = hazards;
  }

  private normalize(root: TransformNode, targetHeight: number) {
    const { min, max } = root.getHierarchyBoundingVectors();
    const h = max.y - min.y || 1;
    const scale = targetHeight / h;
    root.scaling.x *= scale;
    root.scaling.y *= scale;
    root.scaling.z *= scale;
    root.position.y = -min.y * scale;
  }

  private spawn(i: number, playerX: number, playerZ: number) {
    const entry = this.pool[i];
    const angle = Math.random() * Math.PI * 2;
    const dist =
      CONFIG.enemy.spawnRingMin + Math.random() * (CONFIG.enemy.spawnRingMax - CONFIG.enemy.spawnRingMin);
    this.posX[i] = playerX + Math.cos(angle) * dist;
    this.posZ[i] = playerZ + Math.sin(angle) * dist;
    /** 依 index 對應的類型血量（pool 交錯排列） */
    this.hp[i] = ZOMBIE_TYPES[i % ZOMBIE_TYPES.length].hp * HP_SCALE * this.hpMul;
    this.hitFlash[i] = 0;
    this.freezeTimer[i] = 0;
    this.fireTimer[i] = Math.random() * FIRE_INTERVAL;
    for (const m of entry.meshes) m.renderOverlay = false;
    entry.root.position.x = this.posX[i];
    entry.root.position.z = this.posZ[i];
    entry.root.position.y = this.heightAt(this.posX[i], this.posZ[i]);
    entry.root.setEnabled(true);
    entry.anim?.start(true, 0.8 + Math.random() * 0.4);
  }

  setCount(next: number, playerX: number, playerZ: number) {
    if (!this.ready) return;
    const clamped = Math.max(0, Math.min(this.capacity, Math.floor(next)));
    for (let i = this.count; i < clamped; i++) this.spawn(i, playerX, playerZ);
    for (let i = clamped; i < this.count; i++) {
      this.pool[i].root.setEnabled(false);
      this.pool[i].anim?.stop();
    }
    this.count = clamped;
  }

  reset(_playerX: number, _playerZ: number) {
    this.hpMul = 1;
    this.speedMul = 1;
    this.tier = 0;
    if (!this.ready) {
      this.count = 0;
      return;
    }
    for (let i = 0; i < this.pool.length; i++) {
      this.pool[i].root.setEnabled(false);
      this.pool[i].anim?.stop();
    }
    this.count = 0;
  }

  insertAll(grid: SpatialGrid) {
    for (let i = 0; i < this.count; i++) grid.insert(i, this.posX[i], this.posZ[i]);
  }

  getX(i: number) {
    return this.posX[i];
  }
  getZ(i: number) {
    return this.posZ[i];
  }
  isAlive(i: number) {
    return i < this.count;
  }

  /** 冰凍指定殭屍一段時間 */
  freeze(i: number, dur: number) {
    if (i < this.count) this.freezeTimer[i] = Math.max(this.freezeTimer[i], dur);
  }

  damage(i: number, amount: number, playerX: number, playerZ: number): boolean {
    if (i >= this.count) return false;
    this.hp[i] -= amount;
    /** 被扣血即觸發受擊白光 */
    this.hitFlash[i] = FLASH_DUR;
    if (this.hp[i] <= 0) {
      this.spawn(i, playerX, playerZ);
      return true;
    }
    return false;
  }

  update(
    dt: number,
    playerX: number,
    playerZ: number,
    grid: SpatialGrid,
    obstacles: Obstacle[],
    slowRadius = 0,
    slowFactor = 1,
  ) {
    if (!this.ready) return;
    const { separationRadius, separationForce, radius } = CONFIG.enemy;
    const sepR2 = separationRadius * separationRadius;
    const half = CONFIG.arenaHalf;
    const scratch = { x: 0, z: 0 };
    const slowR2 = slowRadius * slowRadius;

    for (let i = 0; i < this.count; i++) {
      const x = this.posX[i];
      const z = this.posZ[i];

      let dirX = playerX - x;
      let dirZ = playerZ - z;
      const dlen = Math.hypot(dirX, dirZ) || 1;
      dirX /= dlen;
      dirZ /= dlen;

      let sepX = 0;
      let sepZ = 0;
      grid.query(x, z, (j) => {
        if (j === i) return;
        const ox = x - this.posX[j];
        const oz = z - this.posZ[j];
        const d2 = ox * ox + oz * oz;
        if (d2 > 0 && d2 < sepR2) {
          const d = Math.sqrt(d2);
          const w = (separationRadius - d) / separationRadius;
          sepX += (ox / d) * w;
          sepZ += (oz / d) * w;
        }
      });

      let spd = this.pool[i].baseSpeed * this.speedMul;
      /** 冰凍：完全不動；減速光環：範圍內降速 */
      if (this.freezeTimer[i] > 0) {
        this.freezeTimer[i] -= dt;
        spd = 0;
      } else if (slowR2 > 0) {
        const ddx = playerX - x;
        const ddz = playerZ - z;
        if (ddx * ddx + ddz * ddz < slowR2) spd *= slowFactor;
      }

      /** 遠程射手：保持距離並開火（dlen 為與玩家距離） */
      if (ZOMBIE_TYPES[i % ZOMBIE_TYPES.length].ranged && this.freezeTimer[i] <= 0) {
        if (dlen < KEEP_DIST) {
          dirX = -dirX; // 太近則後退
          dirZ = -dirZ;
        } else if (dlen <= FIRE_RANGE) {
          spd = 0; // 在射程內站定射擊
        }
        this.fireTimer[i] -= dt;
        if (dlen <= FIRE_RANGE && this.fireTimer[i] <= 0 && this.hazards) {
          this.hazards.enemyShot(x, z, playerX, playerZ, this.rangedDamage);
          this.fireTimer[i] = FIRE_INTERVAL;
        }
      }

      let nx = x + (dirX * spd + sepX * separationForce) * dt;
      let nz = z + (dirZ * spd + sepZ * separationForce) * dt;
      if (nx > half) nx = half;
      else if (nx < -half) nx = -half;
      if (nz > half) nz = half;
      else if (nz < -half) nz = -half;

      /** 障礙物阻擋 */
      if (obstacles.length > 0) {
        resolveObstacles(obstacles, nx, nz, radius, scratch);
        nx = scratch.x;
        nz = scratch.z;
      }

      this.posX[i] = nx;
      this.posZ[i] = nz;

      const root = this.pool[i].root;
      root.position.x = nx;
      root.position.z = nz;
      root.position.y = this.heightAt(nx, nz);
      /** 面向玩家（模型前方 +Z） */
      root.rotation.y = Math.atan2(dirX, dirZ);

      /** 受擊白光回饋：整隻殭屍閃白（per-mesh overlay，不影響其他殭屍） */
      const meshes = this.pool[i].meshes;
      if (this.hitFlash[i] > 0) {
        this.hitFlash[i] = Math.max(0, this.hitFlash[i] - dt);
        const a = (this.hitFlash[i] / FLASH_DUR) * 0.9;
        for (let m = 0; m < meshes.length; m++) {
          meshes[m].renderOverlay = true;
          meshes[m].overlayAlpha = a;
        }
      } else if (meshes.length > 0 && meshes[0].renderOverlay) {
        for (let m = 0; m < meshes.length; m++) meshes[m].renderOverlay = false;
      }
    }
  }
}
