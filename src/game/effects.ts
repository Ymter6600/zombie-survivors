import {
  Scene,
  Vector3,
  Color3,
  Color4,
  ParticleSystem,
  DynamicTexture,
  MeshBuilder,
  StandardMaterial,
  Mesh,
} from '@babylonjs/core';

let glowTexture: DynamicTexture | undefined;

function getGlow(scene: Scene): DynamicTexture {
  if (glowTexture) return glowTexture;
  const size = 64;
  const texture = new DynamicTexture('glow', size, scene, false);
  const ctx = texture.getContext();
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  texture.update();
  glowTexture = texture;
  scene.onDisposeObservable.add(() => (glowTexture = undefined));
  return texture;
}

/** 一次性粒子爆發後自動清除 */
function burst(
  scene: Scene,
  pos: Vector3,
  color: Color3,
  count: number,
  power: number,
  size: number,
  life: number,
) {
  const sys = new ParticleSystem('burst', count, scene);
  sys.particleTexture = getGlow(scene);
  sys.emitter = pos.clone();
  sys.color1 = color.toColor4(1);
  sys.color2 = color.toColor4(1);
  sys.colorDead = new Color4(color.r, color.g, color.b, 0);
  sys.minSize = size * 0.5;
  sys.maxSize = size;
  sys.minLifeTime = life * 0.6;
  sys.maxLifeTime = life;
  sys.blendMode = ParticleSystem.BLENDMODE_ADD;
  sys.gravity = new Vector3(0, -6, 0);
  sys.createSphereEmitter(0.6);
  sys.minEmitPower = power * 0.5;
  sys.maxEmitPower = power;
  sys.minAngularSpeed = -5;
  sys.maxAngularSpeed = 5;
  sys.updateSpeed = 0.016;
  sys.manualEmitCount = count;
  sys.start();
  setTimeout(() => sys.dispose(), (life + 0.3) * 1000);
}

/** 升級時玩家周圍的金光爆發 */
export function levelUpBurst(scene: Scene, pos: Vector3) {
  burst(scene, pos, new Color3(1, 0.85, 0.3), 40, 9, 0.7, 0.7);
}

/** 王被擊敗的大爆炸 */
export function bossDeathBurst(scene: Scene, pos: Vector3) {
  burst(scene, pos, new Color3(1, 0.5, 0.2), 80, 16, 1.1, 0.9);
  burst(scene, pos, new Color3(1, 0.9, 0.4), 50, 10, 0.7, 1.1);
}

/** 玩家受擊的小火花 */
export function hurtBurst(scene: Scene, pos: Vector3) {
  burst(scene, pos, new Color3(1, 0.3, 0.3), 14, 7, 0.5, 0.35);
}

/** 子彈命中敵人的小火花（傷害回饋） */
export function hitSpark(scene: Scene, pos: Vector3) {
  burst(scene, pos, new Color3(1, 0.95, 0.55), 6, 9, 0.3, 0.22);
}

/** 殭屍死亡的綠色噴濺 */
export function enemyDeathBurst(scene: Scene, pos: Vector3) {
  burst(scene, pos, new Color3(0.45, 0.8, 0.3), 16, 8, 0.55, 0.45);
  burst(scene, pos, new Color3(0.25, 0.5, 0.2), 8, 5, 0.4, 0.5);
}

/** 飄字（增益名稱、回血量）：billboard 文字向上飄並淡出 */
export function spawnText(scene: Scene, pos: Vector3, text: string, colorHex: string, scale = 1) {
  const width = 512;
  const height = 128;
  const texture = new DynamicTexture('text', { width, height }, scene, false);
  texture.hasAlpha = true;
  const ctx = texture.getContext() as unknown as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, width, height);
  ctx.font = '900 72px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 9;
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.fillStyle = colorHex;
  ctx.strokeText(text, width / 2, height / 2);
  ctx.fillText(text, width / 2, height / 2);
  texture.update();

  const plane = MeshBuilder.CreatePlane('text-plane', { width: 4 * scale, height: 1 * scale }, scene);
  plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
  plane.isPickable = false;
  plane.position = new Vector3(pos.x, pos.y + 2.5, pos.z);
  const material = new StandardMaterial('text-material', scene);
  material.emissiveTexture = texture;
  material.opacityTexture = texture;
  material.emissiveColor = Color3.White();
  material.disableLighting = true;
  material.backFaceCulling = false;
  plane.material = material;

  const start = performance.now();
  const duration = 1100;
  const startY = plane.position.y;
  const observer = scene.onBeforeRenderObservable.add(() => {
    const progress = (performance.now() - start) / duration;
    if (progress >= 1) {
      scene.onBeforeRenderObservable.remove(observer);
      plane.dispose();
      material.dispose();
      texture.dispose();
      return;
    }
    plane.position.y = startY + progress * 1.8;
    material.alpha = 1 - progress;
  });
}
