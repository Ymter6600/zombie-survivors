import {
  Scene,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Color4,
  Vector3,
  Quaternion,
  Matrix,
} from '@babylonjs/core';
import { CONFIG } from './config';
import { SpatialGrid } from './spatial-grid';

/** 敵人配色（派對色） */
const PALETTE = [
  new Color4(0.98, 0.27, 0.29, 1),
  new Color4(0.56, 0.32, 1, 1),
  new Color4(0, 0.65, 0.96, 1),
  new Color4(0, 0.79, 0.31, 1),
  new Color4(1, 0.72, 0, 1),
  new Color4(0.96, 0.29, 0, 1),
];

/**
 * 敵人系統（效能核心）：
 * - 以 SoA（Structure of Arrays）儲存位置／血量，配合 thin instances 單一 draw call 繪製整群。
 * - 移動 = 朝玩家 steering + 鄰近分離（透過空間網格查詢）。
 * - 死亡即於環狀邊界重生，維持壓測時的固定數量。
 */
export class EnemySystem {
  readonly mesh: Mesh;
  count: number;

  private posX: Float32Array;
  private posZ: Float32Array;
  private hp: Float32Array;

  private matrixBuffer: Float32Array;
  private colorBuffer: Float32Array;

  /** 重用的暫存物件，避免每幀配置 */
  private readonly scaleV: Vector3;
  private readonly rotQ = Quaternion.Identity();
  private readonly posV = new Vector3();
  private readonly mat = new Matrix();

  private readonly y = CONFIG.enemy.y;

  constructor(scene: Scene) {
    const cap = CONFIG.enemy.capacity;
    this.count = CONFIG.enemy.count;
    this.posX = new Float32Array(cap);
    this.posZ = new Float32Array(cap);
    this.hp = new Float32Array(cap);
    this.matrixBuffer = new Float32Array(cap * 16);
    this.colorBuffer = new Float32Array(cap * 4);
    this.scaleV = new Vector3(1, 1, 1);

    /** 低面數「小怪」基底 mesh（之後可替換成動物 GLB） */
    const base = MeshBuilder.CreateCapsule(
      'enemy',
      { radius: CONFIG.enemy.radius, height: CONFIG.enemy.radius * 2.4, tessellation: 8, subdivisions: 1 },
      scene,
    );
    const material = new StandardMaterial('enemy-material', scene);
    material.diffuseColor = Color3.White();
    material.specularColor = Color3.Black();
    base.material = material;
    this.mesh = base;

    /** 初始化所有存活敵人 */
    for (let i = 0; i < this.count; i++) this.spawn(i, 0, 0);

    base.thinInstanceSetBuffer('matrix', this.matrixBuffer, 16, false);
    base.thinInstanceSetBuffer('color', this.colorBuffer, 4, false);
    base.thinInstanceCount = this.count;
    /** 場地不大，關閉視錐剔除省下每幀計算 */
    base.alwaysSelectAsActiveMesh = true;
  }

  /** 於玩家周圍環狀生成（重設位置、血量、配色） */
  private spawn(i: number, playerX: number, playerZ: number) {
    const angle = Math.random() * Math.PI * 2;
    const dist =
      CONFIG.enemy.spawnRingMin +
      Math.random() * (CONFIG.enemy.spawnRingMax - CONFIG.enemy.spawnRingMin);
    this.posX[i] = playerX + Math.cos(angle) * dist;
    this.posZ[i] = playerZ + Math.sin(angle) * dist;
    this.hp[i] = CONFIG.enemy.hp;

    const color = PALETTE[i % PALETTE.length];
    this.colorBuffer[i * 4] = color.r;
    this.colorBuffer[i * 4 + 1] = color.g;
    this.colorBuffer[i * 4 + 2] = color.b;
    this.colorBuffer[i * 4 + 3] = 1;
  }

  /** 調整存活敵人數（HUD 壓測用） */
  setCount(next: number, playerX: number, playerZ: number) {
    const clamped = Math.max(0, Math.min(CONFIG.enemy.capacity, Math.floor(next)));
    for (let i = this.count; i < clamped; i++) this.spawn(i, playerX, playerZ);
    this.count = clamped;
    this.mesh.thinInstanceCount = clamped;
    this.mesh.thinInstanceBufferUpdated('color');
  }

  /** 將所有存活敵人寫入空間網格 */
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

  /** 造成傷害；血量歸零即重生，回傳是否擊殺 */
  damage(i: number, amount: number, playerX: number, playerZ: number): boolean {
    if (i >= this.count) return false;
    this.hp[i] -= amount;
    if (this.hp[i] <= 0) {
      this.spawn(i, playerX, playerZ);
      this.mesh.thinInstanceBufferUpdated('color');
      return true;
    }
    return false;
  }

  /** 每幀更新：朝玩家移動 + 鄰近分離，並寫入 instance 矩陣 */
  update(dt: number, playerX: number, playerZ: number, grid: SpatialGrid) {
    const { speed, separationRadius, separationForce } = CONFIG.enemy;
    const sepR2 = separationRadius * separationRadius;
    const half = CONFIG.arenaHalf;

    for (let i = 0; i < this.count; i++) {
      const x = this.posX[i];
      const z = this.posZ[i];

      /** 朝玩家方向 */
      let dirX = playerX - x;
      let dirZ = playerZ - z;
      const dlen = Math.hypot(dirX, dirZ) || 1;
      dirX /= dlen;
      dirZ /= dlen;

      /** 鄰近分離 */
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

      let vx = dirX * speed + sepX * separationForce;
      let vz = dirZ * speed + sepZ * separationForce;

      let nx = x + vx * dt;
      let nz = z + vz * dt;
      /** 限制在場地內 */
      if (nx > half) nx = half;
      else if (nx < -half) nx = -half;
      if (nz > half) nz = half;
      else if (nz < -half) nz = -half;

      this.posX[i] = nx;
      this.posZ[i] = nz;

      this.posV.set(nx, this.y, nz);
      Matrix.ComposeToRef(this.scaleV, this.rotQ, this.posV, this.mat);
      this.mat.copyToArray(this.matrixBuffer, i * 16);
    }

    this.mesh.thinInstanceBufferUpdated('matrix');
  }
}
