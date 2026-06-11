import {
  Scene,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
  Quaternion,
  Matrix,
} from '@babylonjs/core';
import { CONFIG, ENEMY_TYPES, type EnemyType } from './config';
import { SpatialGrid } from './spatial-grid';

/**
 * 敵人系統（效能核心）：SoA + thin instances。
 * 類型（一般／快速／坦克）影響血量、速度、體型、配色；難度乘數由導演逐幀更新。
 * 死亡即於環狀邊界依當前難度重生，維持壓力。
 */
export class EnemySystem {
  readonly mesh: Mesh;
  count: number;

  /** 難度乘數與類型權重（由導演更新） */
  hpMul = 1;
  speedMul = 1;
  /** 0~1，越大越容易生成快速／坦克 */
  tier = 0;

  private posX: Float32Array;
  private posZ: Float32Array;
  private hp: Float32Array;
  private speed: Float32Array;
  private scale: Float32Array;

  private matrixBuffer: Float32Array;
  private colorBuffer: Float32Array;

  private readonly scaleV = new Vector3(1, 1, 1);
  private readonly rotQ = Quaternion.Identity();
  private readonly posV = new Vector3();
  private readonly mat = new Matrix();
  private readonly y = CONFIG.enemy.y;

  constructor(scene: Scene) {
    const cap = CONFIG.enemy.capacity;
    this.count = CONFIG.director.baseCount;
    this.posX = new Float32Array(cap);
    this.posZ = new Float32Array(cap);
    this.hp = new Float32Array(cap);
    this.speed = new Float32Array(cap);
    this.scale = new Float32Array(cap);
    this.matrixBuffer = new Float32Array(cap * 16);
    this.colorBuffer = new Float32Array(cap * 4);

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

    for (let i = 0; i < this.count; i++) this.spawn(i, 0, 0);

    base.thinInstanceSetBuffer('matrix', this.matrixBuffer, 16, false);
    base.thinInstanceSetBuffer('color', this.colorBuffer, 4, false);
    base.thinInstanceCount = this.count;
    base.alwaysSelectAsActiveMesh = true;
  }

  /** 依當前 tier 權重挑類型 */
  private pickType(): EnemyType {
    const wBasic = 1;
    const wFast = this.tier;
    const wTank = this.tier * 0.6;
    const total = wBasic + wFast + wTank;
    const r = Math.random() * total;
    if (r < wFast) return ENEMY_TYPES.fast;
    if (r < wFast + wTank) return ENEMY_TYPES.tank;
    return ENEMY_TYPES.basic;
  }

  private spawn(i: number, playerX: number, playerZ: number) {
    const type = this.pickType();
    const angle = Math.random() * Math.PI * 2;
    const dist =
      CONFIG.enemy.spawnRingMin +
      Math.random() * (CONFIG.enemy.spawnRingMax - CONFIG.enemy.spawnRingMin);
    this.posX[i] = playerX + Math.cos(angle) * dist;
    this.posZ[i] = playerZ + Math.sin(angle) * dist;
    this.hp[i] = type.hp * this.hpMul;
    this.speed[i] = type.speed;
    this.scale[i] = type.scale;

    this.colorBuffer[i * 4] = type.color[0];
    this.colorBuffer[i * 4 + 1] = type.color[1];
    this.colorBuffer[i * 4 + 2] = type.color[2];
    this.colorBuffer[i * 4 + 3] = 1;
  }

  /** 導演調整存活數量（只增不主動減；多餘交由戰鬥消耗） */
  setCount(next: number, playerX: number, playerZ: number) {
    const clamped = Math.max(0, Math.min(CONFIG.enemy.capacity, Math.floor(next)));
    if (clamped > this.count) {
      for (let i = this.count; i < clamped; i++) this.spawn(i, playerX, playerZ);
      this.mesh.thinInstanceBufferUpdated('color');
    }
    this.count = clamped;
    this.mesh.thinInstanceCount = clamped;
  }

  reset(playerX: number, playerZ: number) {
    this.hpMul = 1;
    this.speedMul = 1;
    this.tier = 0;
    this.count = CONFIG.director.baseCount;
    for (let i = 0; i < this.count; i++) this.spawn(i, playerX, playerZ);
    this.mesh.thinInstanceCount = this.count;
    this.mesh.thinInstanceBufferUpdated('color');
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

  /** 造成傷害；血量歸零即依當前難度重生，回傳是否擊殺 */
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

  update(dt: number, playerX: number, playerZ: number, grid: SpatialGrid) {
    const { separationRadius, separationForce } = CONFIG.enemy;
    const sepR2 = separationRadius * separationRadius;
    const half = CONFIG.arenaHalf;

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

      const spd = this.speed[i] * this.speedMul;
      const vx = dirX * spd + sepX * separationForce;
      const vz = dirZ * spd + sepZ * separationForce;

      let nx = x + vx * dt;
      let nz = z + vz * dt;
      if (nx > half) nx = half;
      else if (nx < -half) nx = -half;
      if (nz > half) nz = half;
      else if (nz < -half) nz = -half;

      this.posX[i] = nx;
      this.posZ[i] = nz;

      const s = this.scale[i];
      this.scaleV.set(s, s, s);
      this.posV.set(nx, this.y * s, nz);
      Matrix.ComposeToRef(this.scaleV, this.rotQ, this.posV, this.mat);
      this.mat.copyToArray(this.matrixBuffer, i * 16);
    }

    this.mesh.thinInstanceBufferUpdated('matrix');
  }
}
