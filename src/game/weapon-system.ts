import {
  Scene,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
  Quaternion,
  Matrix,
  SceneLoader,
} from '@babylonjs/core';
import '@babylonjs/loaders';
import { CONFIG } from './config';
import { SpatialGrid } from './spatial-grid';
import { ZombieHorde } from './zombie-horde';
import { Boss } from './boss';
import { RunState } from './upgrades';
import { sound } from './sound';
import { hitSpark } from './effects';

/** 多重彈之間的角度間隔（弧度） */
const SPREAD_STEP = 0.16;
/** 飛刀自轉速度（弧度/秒） */
const KNIFE_SPIN = 20;
/** 冰凍持續時間（秒） */
const FREEZE_DUR = 1.2;

/** 自動武器：定時朝最近敵人發射投射物（數量／傷害／射程等讀取 RunState，隨升級變動）。 */
export class WeaponSystem {
  mesh: Mesh;

  private px: Float32Array;
  private pz: Float32Array;
  private vx: Float32Array;
  private vz: Float32Array;
  private life: Float32Array;
  private active: Uint8Array;
  private spin: Float32Array;
  /** 每發剩餘穿透數 */
  private pierce: Float32Array;
  private cap: number;

  private matrixBuffer: Float32Array;
  private timer = 0;
  private scene: Scene;

  private readonly scaleActive = new Vector3(1, 1, 1);
  private readonly scaleHidden = new Vector3(0, 0, 0);
  private readonly rotQ = new Quaternion();
  private readonly posV = new Vector3();
  private readonly mat = new Matrix();
  /** 子彈飛行高度（依玩家所在地形高度 + 1） */
  private y = 1;

  constructor(scene: Scene) {
    this.scene = scene;
    this.cap = CONFIG.weapon.maxProjectiles;
    this.px = new Float32Array(this.cap);
    this.pz = new Float32Array(this.cap);
    this.vx = new Float32Array(this.cap);
    this.vz = new Float32Array(this.cap);
    this.life = new Float32Array(this.cap);
    this.active = new Uint8Array(this.cap);
    this.spin = new Float32Array(this.cap);
    this.pierce = new Float32Array(this.cap);
    this.matrixBuffer = new Float32Array(this.cap * 16);

    /** 子彈 fallback：發光黃色小球（飛刀模型載入後替換） */
    const base = MeshBuilder.CreateSphere('bullet', { diameter: 0.6, segments: 8 }, scene);
    const material = new StandardMaterial('bullet-material', scene);
    material.diffuseColor = new Color3(1, 0.9, 0.4);
    material.emissiveColor = new Color3(1, 0.7, 0.1);
    material.specularColor = Color3.Black();
    material.disableLighting = true;
    base.material = material;
    this.mesh = base;

    for (let i = 0; i < this.cap; i++) this.writeMatrix(i);
    base.thinInstanceSetBuffer('matrix', this.matrixBuffer, 16, false);
    base.thinInstanceCount = this.cap;
    base.alwaysSelectAsActiveMesh = true;

    void this.loadKnife(scene);
  }

  /** 載入飛刀模型，合併為單一 mesh 並承接 thin instance 緩衝，替換球體 */
  private async loadKnife(scene: Scene) {
    try {
      const res = await SceneLoader.ImportMeshAsync('', '/models/zombie/', 'weapon_knife.glb', scene);
      res.animationGroups.forEach((g) => g.stop());
      const parts = res.meshes.filter((m): m is Mesh => m instanceof Mesh && m.getTotalVertices() > 0);
      const merged = Mesh.MergeMeshes(parts, true, true, undefined, false, true);
      res.meshes[0]?.dispose();
      if (!merged) return;
      /** 依最長邊正規化大小（放大一點更顯眼） */
      const { min, max } = merged.getHierarchyBoundingVectors();
      const size = Math.max(max.x - min.x, max.y - min.y, max.z - min.z) || 1;
      const s = 1.9 / size;
      this.scaleActive.set(s, s, s);
      /** 覆蓋為高亮發光材質（搭配 GlowLayer 泛光） */
      const glowMat = new StandardMaterial('knife-glow', scene);
      glowMat.diffuseColor = new Color3(1, 0.95, 0.5);
      glowMat.emissiveColor = new Color3(1, 0.8, 0.2);
      glowMat.specularColor = Color3.Black();
      glowMat.disableLighting = true;
      merged.material = glowMat;
      merged.isPickable = false;
      merged.alwaysSelectAsActiveMesh = true;
      merged.thinInstanceSetBuffer('matrix', this.matrixBuffer, 16, false);
      merged.thinInstanceCount = this.cap;
      this.mesh.dispose();
      this.mesh = merged;
      for (let i = 0; i < this.cap; i++) this.writeMatrix(i);
      merged.thinInstanceBufferUpdated('matrix');
    } catch {
      /* 載入失敗則保留球體 */
    }
  }

  private writeMatrix(i: number) {
    const scale = this.active[i] ? this.scaleActive : this.scaleHidden;
    Quaternion.RotationYawPitchRollToRef(this.spin[i], 0, 0, this.rotQ);
    this.posV.set(this.px[i], this.y, this.pz[i]);
    Matrix.ComposeToRef(scale, this.rotQ, this.posV, this.mat);
    this.mat.copyToArray(this.matrixBuffer, i * 16);
  }

  private spawnProjectile(x: number, z: number, dirX: number, dirZ: number, speed: number, pierce: number) {
    for (let i = 0; i < this.cap; i++) {
      if (this.active[i]) continue;
      this.active[i] = 1;
      this.px[i] = x;
      this.pz[i] = z;
      this.vx[i] = dirX * speed;
      this.vz[i] = dirZ * speed;
      this.life[i] = CONFIG.weapon.lifetime;
      this.spin[i] = Math.atan2(dirX, dirZ);
      this.pierce[i] = pierce;
      return;
    }
  }

  private fire(playerX: number, playerZ: number, enemies: ZombieHorde, run: RunState) {
    const range2 = run.range * run.range;
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

    const baseAngle = Math.atan2(enemies.getZ(bestIndex) - playerZ, enemies.getX(bestIndex) - playerX);
    sound.shoot();
    const count = run.projectileCount;
    for (let k = 0; k < count; k++) {
      const angle = baseAngle + (k - (count - 1) / 2) * SPREAD_STEP;
      this.spawnProjectile(playerX, playerZ, Math.cos(angle), Math.sin(angle), run.projectileSpeed, run.pierce);
    }
  }

  /** 每幀更新；命中擊殺時以死亡座標呼叫 onKill。回傳本幀擊殺數。 */
  update(
    dt: number,
    playerX: number,
    playerZ: number,
    enemies: ZombieHorde,
    boss: Boss,
    grid: SpatialGrid,
    run: RunState,
    onKill: (x: number, z: number) => void,
    baseY: number,
  ): number {
    this.y = baseY + 1;
    this.timer += dt;
    while (this.timer >= run.fireInterval) {
      this.timer -= run.fireInterval;
      this.fire(playerX, playerZ, enemies, run);
    }

    const hitR = CONFIG.weapon.projectileRadius + CONFIG.enemy.radius;
    const hitR2 = hitR * hitR;
    let kills = 0;

    for (let i = 0; i < this.cap; i++) {
      if (!this.active[i]) continue;

      this.px[i] += this.vx[i] * dt;
      this.pz[i] += this.vz[i] * dt;
      this.spin[i] += KNIFE_SPIN * dt;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.active[i] = 0;
        this.writeMatrix(i);
        continue;
      }

      let hitEnemy = -1;
      grid.query(this.px[i], this.pz[i], (j) => {
        if (hitEnemy >= 0 || !enemies.isAlive(j)) return;
        const dx = this.px[i] - enemies.getX(j);
        const dz = this.pz[i] - enemies.getZ(j);
        if (dx * dx + dz * dz <= hitR2) hitEnemy = j;
      });

      if (hitEnemy >= 0) {
        const hx = this.px[i];
        const hz = this.pz[i];
        const ex = enemies.getX(hitEnemy);
        const ez = enemies.getZ(hitEnemy);
        hitSpark(this.scene, new Vector3(hx, this.y, hz));
        /** 暴擊 */
        const dmg = run.critChance > 0 && Math.random() < run.critChance ? run.damage * run.critMult : run.damage;
        if (enemies.damage(hitEnemy, dmg, playerX, playerZ)) {
          kills++;
          onKill(ex, ez);
        }
        /** 冰凍 */
        if (run.freezeChance > 0 && Math.random() < run.freezeChance) enemies.freeze(hitEnemy, FREEZE_DUR);
        /** 爆裂彈 */
        if (run.explodeRadius > 0) kills += this.explode(hx, hz, enemies, boss, run, playerX, playerZ, onKill);
        /** 穿透：還有穿透數則繼續飛 */
        if (this.pierce[i] > 0) this.pierce[i]--;
        else this.active[i] = 0;
      } else {
        const bdmg = run.critChance > 0 && Math.random() < run.critChance ? run.damage * run.critMult : run.damage;
        if (boss.hitTest(this.px[i], this.pz[i], CONFIG.weapon.projectileRadius, bdmg)) {
          if (run.explodeRadius > 0) kills += this.explode(this.px[i], this.pz[i], enemies, boss, run, playerX, playerZ, onKill);
          if (this.pierce[i] > 0) this.pierce[i]--;
          else this.active[i] = 0;
        }
      }

      this.writeMatrix(i);
    }

    this.mesh.thinInstanceBufferUpdated('matrix');
    return kills;
  }

  /** 爆裂彈：對命中點周圍範圍造成傷害，回傳擊殺數 */
  private explode(
    x: number,
    z: number,
    enemies: ZombieHorde,
    boss: Boss,
    run: RunState,
    playerX: number,
    playerZ: number,
    onKill: (x: number, z: number) => void,
  ): number {
    let k = 0;
    const r2 = run.explodeRadius * run.explodeRadius;
    for (let j = 0; j < enemies.count; j++) {
      if (!enemies.isAlive(j)) continue;
      const dx = enemies.getX(j) - x;
      const dz = enemies.getZ(j) - z;
      if (dx * dx + dz * dz <= r2) {
        const ex = enemies.getX(j);
        const ez = enemies.getZ(j);
        if (enemies.damage(j, run.explodeDamage, playerX, playerZ)) {
          k++;
          onKill(ex, ez);
        }
      }
    }
    boss.hitTest(x, z, run.explodeRadius, run.explodeDamage);
    hitSpark(this.scene, new Vector3(x, this.y, z));
    return k;
  }

  reset() {
    this.timer = 0;
    this.active.fill(0);
    for (let i = 0; i < this.cap; i++) this.writeMatrix(i);
    this.mesh.thinInstanceBufferUpdated('matrix');
  }
}
