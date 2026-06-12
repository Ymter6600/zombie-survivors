import {
  Engine,
  Scene,
  ArcRotateCamera,
  HemisphericLight,
  DirectionalLight,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Color4,
  Vector3,
  TransformNode,
} from '@babylonjs/core';
import { loadModel } from './model-loader';
import { CONFIG } from './config';
import { Input } from './input';
import { SpatialGrid } from './spatial-grid';
import { EnemySystem } from './enemy-system';
import { WeaponSystem } from './weapon-system';
import { GemSystem } from './gem-system';
import { Boss } from './boss';
import { createRunState, rollChoices, xpForLevel, type RunState, type Upgrade } from './upgrades';
import { levelUpBurst, bossDeathBurst, hurtBurst } from './effects';

export type GameState = 'running' | 'levelup' | 'dead';

export interface ChoiceView {
  id: string;
  name: string;
  desc: string;
  emoji: string;
}

export interface GameStats {
  fps: number;
  enemies: number;
  kills: number;
  time: number;
  hp: number;
  maxHp: number;
  level: number;
  xp: number;
  xpToNext: number;
  state: GameState;
  choices: ChoiceView[];
  bossActive: boolean;
  bossHp: number;
  bossMaxHp: number;
  goldEarned: number;
}

export interface RunResult {
  gold: number;
  kills: number;
  time: number;
  level: number;
}

export interface GameOptions {
  onStats?: (stats: GameStats) => void;
  onGameOver?: (result: RunResult) => void;
  /** 角色與永久升級算出的起始數值（範本，每輪複製使用） */
  startRunState?: RunState;
  /** 角色身體顏色（fallback 造型用） */
  characterColor?: [number, number, number];
  /** 角色 GLB 模型路徑 */
  characterModel?: string;
  /** 金幣加成倍率（貪婪） */
  goldMultiplier?: number;
}

export interface GameHandle {
  dispose: () => void;
  setJoystick: (x: number, z: number) => void;
  chooseUpgrade: (index: number) => void;
  restart: () => void;
}

export function createGame(canvas: HTMLCanvasElement, options: GameOptions = {}): GameHandle {
  const engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: false });

  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.05, 0.07, 0.13, 1);
  /** 線性霧增加遠處深度感 */
  scene.fogMode = Scene.FOGMODE_LINEAR;
  scene.fogColor = new Color3(0.05, 0.07, 0.13);
  scene.fogStart = 55;
  scene.fogEnd = 110;

  const camera = new ArcRotateCamera('camera', -Math.PI / 2, Math.PI / 3.2, 50, Vector3.Zero(), scene);
  const light = new HemisphericLight('light', new Vector3(0.4, 1, 0.3), scene);
  light.intensity = 0.85;
  light.groundColor = new Color3(0.25, 0.28, 0.4);
  const sun = new DirectionalLight('sun', new Vector3(-0.5, -1, -0.3), scene);
  sun.intensity = 0.6;

  createGround(scene);
  scatterProps(scene);

  /** 玩家根節點（移動此節點，視覺為其子物件：GLB 或 fallback 膠囊） */
  const player = new TransformNode('player', scene);
  player.position.set(0, 0, 0);

  const fallbackBody = MeshBuilder.CreateCapsule(
    'player-body',
    { radius: CONFIG.player.radius, height: CONFIG.player.radius * 2.4 },
    scene,
  );
  fallbackBody.parent = player;
  fallbackBody.position.y = CONFIG.player.radius * 1.2;
  const playerMaterial = new StandardMaterial('player-material', scene);
  const pc = options.characterColor ?? [1, 0.95, 0.4];
  playerMaterial.diffuseColor = new Color3(pc[0], pc[1], pc[2]);
  playerMaterial.emissiveColor = new Color3(pc[0] * 0.3, pc[1] * 0.3, pc[2] * 0.3);
  playerMaterial.specularColor = Color3.Black();
  fallbackBody.material = playerMaterial;

  /** 非同步載入角色模型，成功即取代 fallback（不阻塞遊戲開始） */
  if (options.characterModel) {
    void loadModel(scene, options.characterModel, 2.4).then((node) => {
      if (node) {
        node.parent = player;
        fallbackBody.setEnabled(false);
      }
    });
  }

  const goldMul = options.goldMultiplier ?? 1;
  const runTemplate: RunState = options.startRunState ?? createRunState();

  const input = new Input();
  input.attach();

  const grid = new SpatialGrid(CONFIG.gridCellSize);
  const enemies = new EnemySystem(scene);
  const weapon = new WeaponSystem(scene);
  const gems = new GemSystem(scene);
  const boss = new Boss(scene);
  let bossTimer = 0;
  let bossCount = 0;

  /** 一輪狀態 */
  let run: RunState = { ...runTemplate };
  let levels: Record<string, number> = {};
  let level = 1;
  let xp = 0;
  let xpToNext = xpForLevel(level);
  let hp = run.maxHp;
  let kills = 0;
  let time = 0;
  let goldEarned = 0;
  let hurtTimer = 0;
  let state: GameState = 'running';
  let choices: Upgrade[] = [];

  const contactRange = CONFIG.player.radius + CONFIG.enemy.radius + 0.2;
  const contactRange2 = contactRange * contactRange;

  const stats: GameStats = {
    fps: 0,
    enemies: enemies.count,
    kills: 0,
    time: 0,
    hp,
    maxHp: run.maxHp,
    level,
    xp: 0,
    xpToNext,
    state,
    choices: [],
    bossActive: false,
    bossHp: 0,
    bossMaxHp: 0,
    goldEarned: 0,
  };

  function pushStats() {
    stats.fps = Math.round(engine.getFps());
    stats.enemies = enemies.count;
    stats.kills = kills;
    stats.time = time;
    stats.hp = Math.max(0, Math.ceil(hp));
    stats.maxHp = run.maxHp;
    stats.level = level;
    stats.xp = Math.floor(xp);
    stats.xpToNext = xpToNext;
    stats.state = state;
    stats.choices = choices.map((c) => ({ id: c.id, name: c.name, desc: c.desc, emoji: c.emoji }));
    stats.bossActive = boss.active;
    stats.bossHp = Math.max(0, Math.ceil(boss.hp));
    stats.bossMaxHp = boss.maxHp;
    stats.goldEarned = goldEarned;
    options.onStats?.(stats);
  }

  const clampArena = (v: number) => Math.max(-CONFIG.arenaHalf, Math.min(CONFIG.arenaHalf, v));

  function enterLevelUp() {
    const rolled = rollChoices(levels);
    if (rolled.length === 0) return; // 全滿級，略過暫停
    choices = rolled;
    state = 'levelup';
    levelUpBurst(scene, new Vector3(player.position.x, 1, player.position.z));
    pushStats();
  }

  function gameplay(dt: number) {
    const dir = input.getDirection();
    player.position.x = clampArena(player.position.x + dir.x * run.moveSpeed * dt);
    player.position.z = clampArena(player.position.z + dir.z * run.moveSpeed * dt);

    const px = player.position.x;
    const pz = player.position.z;
    camera.target.set(px, 1.2, pz);

    /** 生成導演：隨時間升壓 */
    enemies.hpMul = 1 + time * CONFIG.director.hpGrowthPerSec;
    enemies.speedMul = 1 + time * CONFIG.director.speedGrowthPerSec;
    enemies.tier = Math.min(1, time / 120);
    const target = Math.min(
      CONFIG.director.maxCount,
      CONFIG.director.baseCount + Math.floor(time / CONFIG.director.stepIntervalSec) * CONFIG.director.addPerStep,
    );
    enemies.setCount(target, px, pz);

    grid.clear();
    enemies.insertAll(grid);
    enemies.update(dt, px, pz, grid);

    /** 王：定時出現 */
    bossTimer += dt;
    if (!boss.active && bossTimer >= CONFIG.boss.intervalSec) {
      bossTimer = 0;
      bossCount += 1;
      boss.spawn(px, pz, CONFIG.boss.hpBase + CONFIG.boss.hpPerSpawn * (bossCount - 1));
    }

    kills += weapon.update(dt, px, pz, enemies, boss, grid, run, (x, z) => gems.spawn(x, z));

    /** 王被擊敗：噴出大量經驗 + 爆炸特效 */
    if (boss.justDied) {
      boss.justDied = false;
      kills += 1;
      bossDeathBurst(scene, new Vector3(boss.x, 1.5, boss.z));
      for (let n = 0; n < CONFIG.boss.xpGems; n++) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * 3;
        gems.spawn(boss.x + Math.cos(a) * d, boss.z + Math.sin(a) * d);
      }
    }

    boss.update(dt, px, pz);

    const collected = gems.update(dt, px, pz, run.pickupRadius);
    if (collected > 0) {
      xp += collected * run.xpMultiplier;
      if (xp >= xpToNext) {
        xp -= xpToNext;
        level += 1;
        xpToNext = xpForLevel(level);
        enterLevelUp();
      }
    }

    /** 接觸傷害（小怪 + 王） */
    let touching = false;
    grid.query(px, pz, (j) => {
      if (touching || !enemies.isAlive(j)) return;
      const dx = enemies.getX(j) - px;
      const dz = enemies.getZ(j) - pz;
      if (dx * dx + dz * dz <= contactRange2) touching = true;
    });
    const contactDps = CONFIG.player.contactDps * (1 + time * CONFIG.director.contactGrowthPerSec);
    const bossTouch = boss.contactsPlayer(px, pz, CONFIG.player.radius);
    const hurt = touching || bossTouch;
    if (touching) hp -= contactDps * dt;
    if (bossTouch) hp -= CONFIG.boss.contactDps * dt;

    /** 受擊回饋：間歇火花 */
    hurtTimer -= dt;
    if (hurt && hurtTimer <= 0) {
      hurtTimer = 0.35;
      hurtBurst(scene, new Vector3(px, 1, pz));
    }

    if (hp <= 0) {
      hp = 0;
      goldEarned = Math.floor((kills * 0.6 + time) * goldMul);
      state = 'dead';
      pushStats();
      options.onGameOver?.({ gold: goldEarned, kills, time, level });
    }

    time += dt;
  }

  let throttle = 0;
  engine.runRenderLoop(() => {
    const dt = Math.min(engine.getDeltaTime() / 1000, 0.05);
    if (state === 'running') gameplay(dt);
    scene.render();

    throttle += dt;
    if (throttle >= 0.1) {
      throttle = 0;
      pushStats();
    }
  });

  const onResize = () => engine.resize();
  window.addEventListener('resize', onResize);

  pushStats();

  return {
    dispose() {
      window.removeEventListener('resize', onResize);
      input.detach();
      engine.dispose();
    },
    setJoystick(x: number, z: number) {
      input.setJoystick(x, z);
    },
    chooseUpgrade(index: number) {
      if (state !== 'levelup') return;
      const upgrade = choices[index];
      if (!upgrade) return;
      upgrade.apply(run);
      levels[upgrade.id] = (levels[upgrade.id] ?? 0) + 1;
      if (upgrade.id === 'maxhp') hp = run.maxHp;
      else hp = Math.min(hp, run.maxHp);
      choices = [];
      state = 'running';
      pushStats();
    },
    restart() {
      run = { ...runTemplate };
      levels = {};
      level = 1;
      xp = 0;
      xpToNext = xpForLevel(level);
      hp = run.maxHp;
      kills = 0;
      time = 0;
      goldEarned = 0;
      hurtTimer = 0;
      choices = [];
      state = 'running';
      player.position.set(0, 0, 0);
      enemies.reset(0, 0);
      gems.reset();
      weapon.reset();
      boss.reset();
      bossTimer = 0;
      bossCount = 0;
      pushStats();
    },
  };
}

function createGround(scene: Scene) {
  const size = CONFIG.arenaHalf * 2.4;
  const ground = MeshBuilder.CreateGround('ground', { width: size, height: size }, scene);
  const material = new StandardMaterial('ground-material', scene);
  material.diffuseColor = new Color3(0.16, 0.22, 0.32);
  material.specularColor = Color3.Black();
  ground.material = material;
  return ground;
}

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
