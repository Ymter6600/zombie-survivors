import {
  Engine,
  Scene,
  ArcRotateCamera,
  HemisphericLight,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Color4,
  Vector3,
} from '@babylonjs/core';
import { CONFIG } from './config';
import { Input } from './input';
import { SpatialGrid } from './spatial-grid';
import { EnemySystem } from './enemy-system';
import { WeaponSystem } from './weapon-system';

export interface GameStats {
  fps: number;
  enemies: number;
  kills: number;
  time: number;
  hp: number;
  maxHp: number;
}

export interface GameOptions {
  onStats?: (stats: GameStats) => void;
}

export interface GameHandle {
  dispose: () => void;
  setJoystick: (x: number, z: number) => void;
  setEnemyCount: (n: number) => void;
}

/** 建立並啟動遊戲（里程碑 1：效能原型） */
export function createGame(canvas: HTMLCanvasElement, options: GameOptions = {}): GameHandle {
  const engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: false });

  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.05, 0.07, 0.13, 1);

  const camera = new ArcRotateCamera('camera', -Math.PI / 2, Math.PI / 3.2, 50, Vector3.Zero(), scene);

  const light = new HemisphericLight('light', new Vector3(0.4, 1, 0.3), scene);
  light.intensity = 0.95;

  createGround(scene);
  scatterProps(scene);

  /** 玩家 */
  const player = MeshBuilder.CreateCapsule(
    'player',
    { radius: CONFIG.player.radius, height: CONFIG.player.radius * 2.4 },
    scene,
  );
  player.position.set(0, 1, 0);
  const playerMaterial = new StandardMaterial('player-material', scene);
  playerMaterial.diffuseColor = new Color3(1, 0.95, 0.4);
  playerMaterial.emissiveColor = new Color3(0.4, 0.35, 0.05);
  playerMaterial.specularColor = Color3.Black();
  player.material = playerMaterial;

  const input = new Input();
  input.attach();

  const grid = new SpatialGrid(CONFIG.gridCellSize);
  const enemies = new EnemySystem(scene);
  const weapon = new WeaponSystem(scene);

  const stats: GameStats = {
    fps: 0,
    enemies: enemies.count,
    kills: 0,
    time: 0,
    hp: CONFIG.player.maxHp,
    maxHp: CONFIG.player.maxHp,
  };
  let hp = CONFIG.player.maxHp;

  const contactRange = CONFIG.player.radius + CONFIG.enemy.radius + 0.2;
  const contactRange2 = contactRange * contactRange;

  let statsThrottle = 0;

  engine.runRenderLoop(() => {
    const dt = Math.min(engine.getDeltaTime() / 1000, 0.05);

    /** 移動玩家 */
    const dir = input.getDirection();
    const px = Math.max(
      -CONFIG.arenaHalf,
      Math.min(CONFIG.arenaHalf, player.position.x + dir.x * CONFIG.player.speed * dt),
    );
    const pz = Math.max(
      -CONFIG.arenaHalf,
      Math.min(CONFIG.arenaHalf, player.position.z + dir.z * CONFIG.player.speed * dt),
    );
    player.position.x = px;
    player.position.z = pz;

    /** 相機跟隨 */
    camera.target.copyFrom(player.position);

    /** 重建空間網格（敵人位置） */
    grid.clear();
    enemies.insertAll(grid);

    /** 敵人群湧 */
    enemies.update(dt, px, pz, grid);

    /** 自動武器 */
    stats.kills += weapon.update(dt, px, pz, enemies, grid);

    /** 接觸傷害 */
    let touching = false;
    grid.query(px, pz, (j) => {
      if (touching || !enemies.isAlive(j)) return;
      const dx = enemies.getX(j) - px;
      const dz = enemies.getZ(j) - pz;
      if (dx * dx + dz * dz <= contactRange2) touching = true;
    });
    if (touching) hp -= CONFIG.player.contactDps * dt;
    if (hp <= 0) {
      /** 原型階段：死亡即原地復活，維持壓測 */
      hp = CONFIG.player.maxHp;
      player.position.set(0, 1, 0);
    }

    scene.render();

    /** 更新 HUD（節流至約 10/s） */
    stats.time += dt;
    statsThrottle += dt;
    if (statsThrottle >= 0.1) {
      statsThrottle = 0;
      stats.fps = engine.getFps();
      stats.enemies = enemies.count;
      stats.hp = Math.max(0, Math.ceil(hp));
      options.onStats?.(stats);
    }
  });

  const onResize = () => engine.resize();
  window.addEventListener('resize', onResize);

  return {
    dispose() {
      window.removeEventListener('resize', onResize);
      input.detach();
      engine.dispose();
    },
    setJoystick(x: number, z: number) {
      input.setJoystick(x, z);
    },
    setEnemyCount(n: number) {
      enemies.setCount(n, player.position.x, player.position.z);
    },
  };
}

/** 場地地面 */
function createGround(scene: Scene) {
  const size = CONFIG.arenaHalf * 2.4;
  const ground = MeshBuilder.CreateGround('ground', { width: size, height: size }, scene);
  const material = new StandardMaterial('ground-material', scene);
  material.diffuseColor = new Color3(0.16, 0.22, 0.32);
  material.specularColor = Color3.Black();
  ground.material = material;
  return ground;
}

/** 散布靜態低面數裝飾，提供移動參考與氛圍 */
function scatterProps(scene: Scene) {
  const material = new StandardMaterial('prop-material', scene);
  material.diffuseColor = new Color3(0.3, 0.42, 0.55);
  material.specularColor = Color3.Black();

  const half = CONFIG.arenaHalf;
  for (let i = 0; i < 60; i++) {
    const box = MeshBuilder.CreateBox(`prop-${i}`, { size: 1 + Math.random() * 2 }, scene);
    box.position.set((Math.random() * 2 - 1) * half, 0.5, (Math.random() * 2 - 1) * half);
    box.rotation.y = Math.random() * Math.PI;
    box.material = material;
    box.freezeWorldMatrix();
  }
}
