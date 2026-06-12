import { Scene, Mesh, MeshBuilder, StandardMaterial, Color3, TransformNode, Vector3, AbstractMesh } from '@babylonjs/core';
import { CONFIG } from './config';
import { loadModel } from './model-loader';
import { Obstacle, resolveObstacles } from './obstacles';
import { BossHazards } from './boss-hazards';
import { hitSpark } from './effects';

/** 王的招式種類 */
type BossSkill = 'charge' | 'aimed' | 'shockwave' | 'poison' | 'radial';

interface BossDef {
  name: string;
  model: string;
  radius: number;
  speed: number;
  contactDps: number;
  hpMul: number;
  skill: BossSkill;
  skillInterval: number;
  /** 招式說明（顯示於王血條） */
  skillName: string;
}

/** 依序登場的 5 隻王，打完第 5 隻即破關 */
const BOSS_DEFS: BossDef[] = [
  {
    name: '巨胖殭屍',
    model: '/models/zombie/zombie_chubby.gltf',
    radius: 3,
    speed: 6,
    contactDps: 32,
    hpMul: 1,
    skill: 'charge',
    skillInterval: 5,
    skillName: '蓄力衝撞',
  },
  {
    name: '狂暴肋骨怪',
    model: '/models/zombie/zombie_ribcage.gltf',
    radius: 2.4,
    speed: 9,
    contactDps: 28,
    hpMul: 0.9,
    skill: 'aimed',
    skillInterval: 2.6,
    skillName: '骨刺連射',
  },
  {
    name: '斷臂巨怪',
    model: '/models/zombie/zombie_arm.gltf',
    radius: 3.2,
    speed: 5.5,
    contactDps: 34,
    hpMul: 1.3,
    skill: 'shockwave',
    skillInterval: 4,
    skillName: '震地波',
  },
  {
    name: '腐毒殭屍',
    model: '/models/zombie/zombie_basic.gltf',
    radius: 3,
    speed: 7,
    contactDps: 30,
    hpMul: 1.2,
    skill: 'poison',
    skillInterval: 4.5,
    skillName: '毒池',
  },
  {
    name: '終極殭屍王',
    model: '/models/zombie/zombie_chubby.gltf',
    radius: 4,
    speed: 6.5,
    contactDps: 40,
    hpMul: 1.9,
    skill: 'radial',
    skillInterval: 3,
    skillName: '環形彈幕',
  },
];

/** 王的總數（打完即破關） */
export const BOSS_COUNT = BOSS_DEFS.length;

/** 受擊白光持續時間（秒） */
const FLASH_DUR = 0.16;
const WHITE = new Color3(1, 1, 1);

/**
 * 王：依序登場的 5 隻巨型殭屍，各有特殊招式。
 * 5 種模型於建構時預先載入，spawn 時啟用對應的一隻。
 */
export class Boss {
  active = false;
  hp = 0;
  maxHp = 0;
  x = 0;
  z = 0;
  justDied = false;
  /** 目前這隻王的索引（0-based）；用於判斷是否為最終王 */
  index = 0;
  name = '';
  skillName = '';
  radius = BOSS_DEFS[0].radius;
  contactDps = BOSS_DEFS[0].contactDps;

  private scene: Scene;
  private root: TransformNode;
  private fallback: Mesh;
  private models: (TransformNode | null)[];
  /** 各王模型的實際網格（白光 overlay 用） */
  private modelMeshes: AbstractMesh[][];
  /** 目前顯示中的網格 */
  private currentMeshes: AbstractMesh[] = [];
  private readonly resolved = { x: 0, z: 0 };
  /** 受擊白光計時 */
  private hitFlash = 0;
  /** 地形高度查詢（貼地用） */
  private heightAt: (x: number, z: number) => number = () => 0;

  private skill: BossSkill = 'charge';
  private skillInterval = 5;
  private speed = 6;
  private skillTimer = 0;

  /** 衝撞子狀態機 */
  private phase: 'chase' | 'windup' | 'dash' = 'chase';
  private phaseT = 0;
  private dashX = 0;
  private dashZ = 0;

  constructor(scene: Scene) {
    this.scene = scene;
    this.root = new TransformNode('boss', scene);

    /** 單位球體 fallback（半徑 1），spawn 時依王體型縮放 */
    this.fallback = MeshBuilder.CreateSphere('boss-body', { diameter: 2, segments: 14 }, scene);
    this.fallback.parent = this.root;
    const material = new StandardMaterial('boss-material', scene);
    material.diffuseColor = new Color3(0.4, 0.55, 0.3);
    material.emissiveColor = new Color3(0.2, 0.4, 0.15);
    material.specularColor = Color3.Black();
    this.fallback.material = material;
    this.fallback.overlayColor = WHITE;
    this.fallback.renderOverlay = false;
    this.currentMeshes = [this.fallback];

    this.root.setEnabled(false);

    /** 預先載入 5 隻王的模型，各自正規化大小並停用 */
    this.models = new Array(BOSS_DEFS.length).fill(null);
    this.modelMeshes = new Array(BOSS_DEFS.length).fill(null).map(() => []);
    BOSS_DEFS.forEach((def, i) => {
      void loadModel(scene, def.model, def.radius * 2.2, true).then((node) => {
        if (!node) return;
        node.parent = this.root;
        node.setEnabled(false);
        this.models[i] = node;
        const ms = node.getChildMeshes(false);
        for (const m of ms) {
          m.overlayColor = WHITE;
          m.renderOverlay = false;
        }
        this.modelMeshes[i] = ms;
      });
    });
  }

  setHeightFn(fn: (x: number, z: number) => number) {
    this.heightAt = fn;
  }

  spawn(index: number, playerX: number, playerZ: number) {
    const def = BOSS_DEFS[index];
    this.index = index;
    this.name = def.name;
    this.skillName = def.skillName;
    this.skill = def.skill;
    this.skillInterval = def.skillInterval;
    this.speed = def.speed;
    this.radius = def.radius;
    this.contactDps = def.contactDps;

    const hp = (CONFIG.boss.hpBase + CONFIG.boss.hpPerSpawn * index) * def.hpMul;
    this.hp = hp;
    this.maxHp = hp;

    const angle = Math.random() * Math.PI * 2;
    const dist = 42;
    this.x = playerX + Math.cos(angle) * dist;
    this.z = playerZ + Math.sin(angle) * dist;

    this.skillTimer = 0;
    this.phase = 'chase';
    this.phaseT = 0;
    this.hitFlash = 0;
    this.active = true;
    this.justDied = false;

    /** 視覺：啟用對應模型，否則退回 fallback */
    const hasModel = !!this.models[index];
    for (let i = 0; i < this.models.length; i++) this.models[i]?.setEnabled(i === index);
    this.fallback.setEnabled(!hasModel);
    this.fallback.scaling.set(this.radius, this.radius, this.radius);
    this.fallback.position.y = this.radius;

    /** 白光 overlay 套用對象：目前顯示中的網格 */
    this.currentMeshes = hasModel && this.modelMeshes[index].length ? this.modelMeshes[index] : [this.fallback];
    for (const m of this.currentMeshes) m.renderOverlay = false;

    this.root.position.set(this.x, this.heightAt(this.x, this.z), this.z);
    this.root.setEnabled(true);
  }

  update(dt: number, playerX: number, playerZ: number, obstacles: Obstacle[], hazards: BossHazards) {
    if (!this.active) return;
    this.skillTimer += dt;

    if (this.skill === 'charge') {
      this.updateCharge(dt, playerX, playerZ, obstacles);
    } else {
      this.moveToward(dt, playerX, playerZ, this.speed, obstacles);
      if (this.skillTimer >= this.skillInterval) {
        this.skillTimer = 0;
        this.fireSkill(playerX, playerZ, hazards);
      }
    }

    /** 受擊白光回饋 */
    if (this.hitFlash > 0) {
      this.hitFlash = Math.max(0, this.hitFlash - dt);
      const a = (this.hitFlash / FLASH_DUR) * 0.9;
      for (const m of this.currentMeshes) {
        m.renderOverlay = true;
        m.overlayAlpha = a;
      }
    } else if (this.currentMeshes.length && this.currentMeshes[0].renderOverlay) {
      for (const m of this.currentMeshes) m.renderOverlay = false;
    }
  }

  /** 朝目標移動一步，套用障礙物阻擋並面向移動方向 */
  private moveToward(dt: number, tx: number, tz: number, speed: number, obstacles: Obstacle[]) {
    const dx = tx - this.x;
    const dz = tz - this.z;
    const len = Math.hypot(dx, dz) || 1;
    this.x += (dx / len) * speed * dt;
    this.z += (dz / len) * speed * dt;
    resolveObstacles(obstacles, this.x, this.z, this.radius, this.resolved);
    this.x = this.resolved.x;
    this.z = this.resolved.z;
    this.root.position.x = this.x;
    this.root.position.z = this.z;
    this.root.position.y = this.heightAt(this.x, this.z);
    this.root.rotation.y = Math.atan2(dx, dz);
  }

  /** 衝撞：追擊 → 蓄力（停步） → 高速衝刺 */
  private updateCharge(dt: number, px: number, pz: number, obstacles: Obstacle[]) {
    if (this.phase === 'chase') {
      this.moveToward(dt, px, pz, this.speed, obstacles);
      if (this.skillTimer >= this.skillInterval) {
        this.skillTimer = 0;
        this.phase = 'windup';
        this.phaseT = 0;
      }
    } else if (this.phase === 'windup') {
      this.phaseT += dt;
      this.root.rotation.y = Math.atan2(px - this.x, pz - this.z);
      if (this.phaseT >= 0.7) {
        const dx = px - this.x;
        const dz = pz - this.z;
        const len = Math.hypot(dx, dz) || 1;
        this.dashX = dx / len;
        this.dashZ = dz / len;
        this.phase = 'dash';
        this.phaseT = 0;
      }
    } else {
      this.phaseT += dt;
      this.x += this.dashX * this.speed * 4 * dt;
      this.z += this.dashZ * this.speed * 4 * dt;
      resolveObstacles(obstacles, this.x, this.z, this.radius, this.resolved);
      this.x = this.resolved.x;
      this.z = this.resolved.z;
      this.root.position.x = this.x;
      this.root.position.z = this.z;
      this.root.position.y = this.heightAt(this.x, this.z);
      this.root.rotation.y = Math.atan2(this.dashX, this.dashZ);
      if (this.phaseT >= 0.45) this.phase = 'chase';
    }
  }

  private fireSkill(px: number, pz: number, hazards: BossHazards) {
    switch (this.skill) {
      case 'aimed':
        hazards.aimedBarrage(this.x, this.z, px, pz, 4);
        break;
      case 'shockwave':
        hazards.shockwave(this.x, this.z);
        break;
      case 'poison':
        hazards.poison(px, pz);
        break;
      case 'radial':
        hazards.radialBarrage(this.x, this.z, 14);
        break;
    }
  }

  hitTest(px: number, pz: number, hitRadius: number, amount: number): boolean {
    if (!this.active) return false;
    const dx = px - this.x;
    const dz = pz - this.z;
    const r = this.radius + hitRadius;
    if (dx * dx + dz * dz > r * r) return false;
    this.hp -= amount;
    /** 受擊回饋：火花 + 白光 */
    this.hitFlash = FLASH_DUR;
    hitSpark(this.scene, new Vector3(px, this.radius * 0.7, pz));
    if (this.hp <= 0) {
      this.active = false;
      this.root.setEnabled(false);
      this.justDied = true;
    }
    return true;
  }

  contactsPlayer(px: number, pz: number, playerRadius: number): boolean {
    if (!this.active) return false;
    const dx = px - this.x;
    const dz = pz - this.z;
    const r = this.radius + playerRadius;
    return dx * dx + dz * dz <= r * r;
  }

  reset() {
    this.active = false;
    this.justDied = false;
    this.skillTimer = 0;
    this.phase = 'chase';
    this.root.setEnabled(false);
  }
}
