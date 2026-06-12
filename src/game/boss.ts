import { Scene, Mesh, MeshBuilder, StandardMaterial, Color3, TransformNode } from '@babylonjs/core';
import { CONFIG } from './config';
import { loadModel } from './model-loader';

/** 王：定時出現的巨型敵人（單一實體）。視覺為航空母雞 GLB，載入失敗則用球體。 */
export class Boss {
  active = false;
  hp = 0;
  maxHp = 0;
  x = 0;
  z = 0;
  justDied = false;
  readonly radius = CONFIG.boss.radius;

  private root: TransformNode;
  private fallback: Mesh;

  constructor(scene: Scene) {
    this.root = new TransformNode('boss', scene);

    this.fallback = MeshBuilder.CreateSphere('boss-body', { diameter: CONFIG.boss.radius * 2, segments: 14 }, scene);
    this.fallback.parent = this.root;
    this.fallback.position.y = CONFIG.boss.radius;
    const material = new StandardMaterial('boss-material', scene);
    material.diffuseColor = new Color3(0.97, 0.95, 0.9);
    material.emissiveColor = new Color3(0.55, 0.12, 0.12);
    material.specularColor = Color3.Black();
    this.fallback.material = material;

    this.root.setEnabled(false);

    /** 載入航空母雞模型（放大） */
    void loadModel(scene, '/models/chicken.glb', CONFIG.boss.radius * 2.2).then((node) => {
      if (node) {
        node.parent = this.root;
        this.fallback.setEnabled(false);
      }
    });
  }

  spawn(playerX: number, playerZ: number, hp: number) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 42;
    this.x = playerX + Math.cos(angle) * dist;
    this.z = playerZ + Math.sin(angle) * dist;
    this.hp = hp;
    this.maxHp = hp;
    this.active = true;
    this.root.position.set(this.x, 0, this.z);
    this.root.setEnabled(true);
  }

  update(dt: number, playerX: number, playerZ: number) {
    if (!this.active) return;
    const dx = playerX - this.x;
    const dz = playerZ - this.z;
    const len = Math.hypot(dx, dz) || 1;
    this.x += (dx / len) * CONFIG.boss.speed * dt;
    this.z += (dz / len) * CONFIG.boss.speed * dt;
    this.root.position.x = this.x;
    this.root.position.z = this.z;
  }

  hitTest(px: number, pz: number, hitRadius: number, amount: number): boolean {
    if (!this.active) return false;
    const dx = px - this.x;
    const dz = pz - this.z;
    const r = this.radius + hitRadius;
    if (dx * dx + dz * dz > r * r) return false;
    this.hp -= amount;
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
    this.root.setEnabled(false);
  }
}
