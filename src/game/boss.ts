import { Scene, Mesh, MeshBuilder, StandardMaterial, Color3 } from '@babylonjs/core';
import { CONFIG } from './config';

/** 王：定時出現的巨型敵人（單一實體，獨立於 instanced 小怪）。之後可換成航空母雞 GLB。 */
export class Boss {
  active = false;
  hp = 0;
  maxHp = 0;
  x = 0;
  z = 0;
  /** 本幀剛被擊敗（供遊戲層處理獎勵） */
  justDied = false;
  readonly radius = CONFIG.boss.radius;

  private mesh: Mesh;

  constructor(scene: Scene) {
    const mesh = MeshBuilder.CreateSphere('boss', { diameter: CONFIG.boss.radius * 2, segments: 14 }, scene);
    const material = new StandardMaterial('boss-material', scene);
    material.diffuseColor = new Color3(0.97, 0.95, 0.9);
    material.emissiveColor = new Color3(0.55, 0.12, 0.12);
    material.specularColor = Color3.Black();
    mesh.material = material;
    mesh.position.y = CONFIG.boss.radius;
    mesh.setEnabled(false);
    this.mesh = mesh;
  }

  spawn(playerX: number, playerZ: number, hp: number) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 42;
    this.x = playerX + Math.cos(angle) * dist;
    this.z = playerZ + Math.sin(angle) * dist;
    this.hp = hp;
    this.maxHp = hp;
    this.active = true;
    this.mesh.position.set(this.x, CONFIG.boss.radius, this.z);
    this.mesh.setEnabled(true);
  }

  update(dt: number, playerX: number, playerZ: number) {
    if (!this.active) return;
    const dx = playerX - this.x;
    const dz = playerZ - this.z;
    const len = Math.hypot(dx, dz) || 1;
    this.x += (dx / len) * CONFIG.boss.speed * dt;
    this.z += (dz / len) * CONFIG.boss.speed * dt;
    this.mesh.position.x = this.x;
    this.mesh.position.z = this.z;
  }

  /** 投射物命中測試並造成傷害；回傳是否命中 */
  hitTest(px: number, pz: number, hitRadius: number, amount: number): boolean {
    if (!this.active) return false;
    const dx = px - this.x;
    const dz = pz - this.z;
    const r = this.radius + hitRadius;
    if (dx * dx + dz * dz > r * r) return false;
    this.hp -= amount;
    if (this.hp <= 0) {
      this.active = false;
      this.mesh.setEnabled(false);
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
    this.mesh.setEnabled(false);
  }
}
