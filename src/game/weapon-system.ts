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
import { CONFIG } from './config';
import { SpatialGrid } from './spatial-grid';
import { EnemySystem } from './enemy-system';

/** 自動武器系統：定時朝最近敵人發射投射物，命中造成傷害。投射物以物件池 + thin instances 管理。 */
export class WeaponSystem {
  readonly mesh: Mesh;

  private px: Float32Array;
  private pz: Float32Array;
  private vx: Float32Array;
  private vz: Float32Array;
  private life: Float32Array;
  private active: Uint8Array;
  private cap: number;

  private matrixBuffer: Float32Array;
  private timer = 0;

  private readonly scaleActive: Vector3;
  private readonly scaleHidden = new Vector3(0, 0, 0);
  private readonly rotQ = Quaternion.Identity();
  private readonly posV = new Vector3();
  private readonly mat = new Matrix();
  private readonly y = 1;

  constructor(scene: Scene) {
    this.cap = CONFIG.weapon.maxProjectiles;
    this.px = new Float32Array(this.cap);
    this.pz = new Float32Array(this.cap);
    this.vx = new Float32Array(this.cap);
    this.vz = new Float32Array(this.cap);
    this.life = new Float32Array(this.cap);
    this.active = new Uint8Array(this.cap);
    this.matrixBuffer = new Float32Array(this.cap * 16);
    this.scaleActive = new Vector3(1, 1, 1);

    const base = MeshBuilder.CreateSphere(
      'projectile',
      { diameter: CONFIG.weapon.projectileRadius * 2, segments: 6 },
      scene,
    );
    const material = new StandardMaterial('projectile-material', scene);
    material.diffuseColor = new Color3(0.95, 0.98, 1);
    material.emissiveColor = new Color3(0.4, 0.7, 1);
    material.specularColor = Color3.Black();
    base.material = material;
    this.mesh = base;

    /** 初始全部隱藏 */
    for (let i = 0; i < this.cap; i++) this.writeMatrix(i);
    base.thinInstanceSetBuffer('matrix', this.matrixBuffer, 16, false);
    base.thinInstanceCount = this.cap;
    base.alwaysSelectAsActiveMesh = true;
  }

  private writeMatrix(i: number) {
    const scale = this.active[i] ? this.scaleActive : this.scaleHidden;
    this.posV.set(this.px[i], this.y, this.pz[i]);
    Matrix.ComposeToRef(scale, this.rotQ, this.posV, this.mat);
    this.mat.copyToArray(this.matrixBuffer, i * 16);
  }

  private spawnProjectile(x: number, z: number, dirX: number, dirZ: number) {
    for (let i = 0; i < this.cap; i++) {
      if (this.active[i]) continue;
      this.active[i] = 1;
      this.px[i] = x;
      this.pz[i] = z;
      this.vx[i] = dirX * CONFIG.weapon.projectileSpeed;
      this.vz[i] = dirZ * CONFIG.weapon.projectileSpeed;
      this.life[i] = CONFIG.weapon.lifetime;
      return;
    }
  }

  /** 朝最近且在射程內的敵人發射 */
  private fire(playerX: number, playerZ: number, enemies: EnemySystem) {
    const range2 = CONFIG.weapon.range * CONFIG.weapon.range;
    let bestIndex = -1;
    let bestDist = range2;
    for (let i = 0; i < enemies.count; i++) {
      const dx = enemies.getX(i) - playerX;
      const dz = enemies.getZ(i) - playerZ;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestDist) {
        bestDist = d2;
        bestIndex = i;
      }
    }
    if (bestIndex < 0) return;
    const dx = enemies.getX(bestIndex) - playerX;
    const dz = enemies.getZ(bestIndex) - playerZ;
    const len = Math.hypot(dx, dz) || 1;
    this.spawnProjectile(playerX, playerZ, dx / len, dz / len);
  }

  /** 每幀更新：發射、移動、命中判定。回傳本幀擊殺數。 */
  update(
    dt: number,
    playerX: number,
    playerZ: number,
    enemies: EnemySystem,
    grid: SpatialGrid,
  ): number {
    this.timer += dt;
    while (this.timer >= CONFIG.weapon.fireInterval) {
      this.timer -= CONFIG.weapon.fireInterval;
      this.fire(playerX, playerZ, enemies);
    }

    const hitR = CONFIG.weapon.projectileRadius + CONFIG.enemy.radius;
    const hitR2 = hitR * hitR;
    let kills = 0;

    for (let i = 0; i < this.cap; i++) {
      if (!this.active[i]) {
        continue;
      }

      this.px[i] += this.vx[i] * dt;
      this.pz[i] += this.vz[i] * dt;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.active[i] = 0;
        this.writeMatrix(i);
        continue;
      }

      /** 命中查詢（取網格內第一個命中目標） */
      let hitEnemy = -1;
      grid.query(this.px[i], this.pz[i], (j) => {
        if (hitEnemy >= 0 || !enemies.isAlive(j)) return;
        const dx = this.px[i] - enemies.getX(j);
        const dz = this.pz[i] - enemies.getZ(j);
        if (dx * dx + dz * dz <= hitR2) hitEnemy = j;
      });

      if (hitEnemy >= 0) {
        if (enemies.damage(hitEnemy, CONFIG.weapon.damage, playerX, playerZ)) kills++;
        this.active[i] = 0;
      }

      this.writeMatrix(i);
    }

    this.mesh.thinInstanceBufferUpdated('matrix');
    return kills;
  }
}
