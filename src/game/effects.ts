import {
  Scene,
  Vector3,
  Color3,
  Color4,
  ParticleSystem,
  DynamicTexture,
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
