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
  Mesh,
  GlowLayer,
} from '@babylonjs/core';
import { loadModel, loadCharacter } from './model-loader';
import type { AnimationGroup } from '@babylonjs/core';
import { createTerrain } from './terrain';
import { scatterGroundDecals, buildRoads } from './ground-decals';
import { CONFIG } from './config';
import { Input } from './input';
import { SpatialGrid } from './spatial-grid';
import { ZombieHorde } from './zombie-horde';
import { WeaponSystem } from './weapon-system';
import { ExtraWeapons } from './extra-weapons';
import { GemSystem } from './gem-system';
import { Boss, BOSS_COUNT } from './boss';
import { BossHazards } from './boss-hazards';
import { BloodDecals } from './decals';
import { Obstacle, resolveObstacles } from './obstacles';
import { createRunState, rollChoices, xpForLevel, UPGRADES, type RunState, type Upgrade } from './upgrades';
import { levelUpBurst, bossDeathBurst, hurtBurst, enemyDeathBurst, spawnText, setGlowLayer } from './effects';
import { sound } from './sound';

export type GameState = 'running' | 'levelup' | 'dead' | 'paused' | 'won';

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
  /** 王名稱與招式（顯示於王血條） */
  bossName: string;
  bossSkill: string;
  /** 已擊敗王數 / 王總數 */
  bossDefeated: number;
  bossTotal: number;
  goldEarned: number;
}

export interface RunResult {
  gold: number;
  kills: number;
  time: number;
  level: number;
  /** 是否破關（擊敗最終王） */
  won: boolean;
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
  togglePause: () => void;
  jump: () => void;
  setXpDebug: (on: boolean) => void;
  setMuted: (on: boolean) => void;
  setMusicTrack: (i: number) => void;
  getDebugParams: () => DebugParamView[];
  setDebugParam: (index: number, value: number) => void;
  getUpgradeStatus: () => UpgradeStatusView[];
}

export interface UpgradeStatusView {
  name: string;
  emoji: string;
  level: number;
  maxLevel: number;
}

export interface DebugParamView {
  label: string;
  group: string;
  type: 'range' | 'bool';
  min: number;
  max: number;
  step: number;
  value: number;
}

export function createGame(canvas: HTMLCanvasElement, options: GameOptions = {}): GameHandle {
  const engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: true });
  sound.enable();
  sound.startMusic();

  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.05, 0.07, 0.13, 1);
  /** 輝光層：讓發光材質（子彈、衛星、閃電、火花等）泛光更顯眼 */
  const glow = new GlowLayer('glow', scene);
  glow.intensity = 0.8;
  setGlowLayer(glow);
  /** 線性霧增加遠處深度感 */
  scene.fogMode = Scene.FOGMODE_LINEAR;
  scene.fogColor = new Color3(0.05, 0.07, 0.13);
  scene.fogStart = 55;
  scene.fogEnd = 110;

  const camera = new ArcRotateCamera('camera', -Math.PI / 2, Math.PI / 3.2, 50, Vector3.Zero(), scene);
  /** 開放使用者調整：拖曳旋轉、滾輪／雙指縮放（仍自動跟隨玩家目標點） */
  camera.attachControl(canvas, true);
  camera.lowerRadiusLimit = 25; // 最近
  camera.upperRadiusLimit = 80; // 最遠
  camera.lowerBetaLimit = 0.35; // 最高俯角（避免看到天空）
  camera.upperBetaLimit = Math.PI / 2.2; // 最低俯角（避免穿到地底）
  camera.wheelPrecision = 3; // 滾輪縮放靈敏度
  camera.pinchPrecision = 60; // 手機雙指縮放靈敏度
  camera.panningSensibility = 0; // 停用平移（鎖定跟隨玩家）
  const light = new HemisphericLight('light', new Vector3(0.4, 1, 0.3), scene);
  light.intensity = 0.85;
  light.groundColor = new Color3(0.25, 0.28, 0.4);
  const sun = new DirectionalLight('sun', new Vector3(-0.5, -1, -0.3), scene);
  sun.intensity = 0.6;

  const { heightAt } = createTerrain(scene);
  void buildRoads(scene, heightAt);
  scatterGroundDecals(scene, heightAt);
  /** 實心障礙物（隨道具非同步載入逐步填入） */
  const obstacles: Obstacle[] = [];
  void scatterProps(scene, obstacles, heightAt);

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

  /** 角色 idle／walk 動畫群組（移動時切換成走路） */
  let playerWalk: AnimationGroup | undefined;
  let playerIdle: AnimationGroup | undefined;
  let playerMoving = false;

  /** 非同步載入角色模型，成功即取代 fallback（不阻塞遊戲開始） */
  if (options.characterModel) {
    void loadCharacter(scene, options.characterModel, 2.4).then((m) => {
      if (m) {
        m.root.parent = player;
        playerWalk = m.walk;
        playerIdle = m.idle;
        fallbackBody.setEnabled(false);
      }
    });
  }

  const goldMul = options.goldMultiplier ?? 1;
  const runTemplate: RunState = options.startRunState ?? createRunState();

  const input = new Input();
  input.attach();

  const grid = new SpatialGrid(CONFIG.gridCellSize);
  const enemies = new ZombieHorde(scene);
  enemies.setHeightFn(heightAt);
  const weapon = new WeaponSystem(scene);
  const extras = new ExtraWeapons(scene);
  const gems = new GemSystem(scene);
  const boss = new Boss(scene);
  boss.setHeightFn(heightAt);
  const hazards = new BossHazards(scene);
  const bloodDecals = new BloodDecals(scene);

  /** 寶箱模型範本（非同步載入，spawn 時複製；未就緒則退回程序化方塊） */
  let chestTemplate: TransformNode | null = null;
  void loadModel(scene, '/models/zombie/item_chest.gltf', 1.1).then((n) => {
    if (n) {
      n.setEnabled(false);
      /** 套上自發光材質，讓 GlowLayer 泛光（金色） */
      const chestMat = new StandardMaterial('chest-glow', scene);
      chestMat.diffuseColor = new Color3(1, 0.8, 0.3);
      chestMat.emissiveColor = new Color3(1, 0.7, 0.2);
      chestMat.specularColor = Color3.Black();
      chestMat.disableLighting = true;
      n.getChildMeshes(false).forEach((m) => (m.material = chestMat));
      chestTemplate = n;
    }
  });
  let bossTimer = 0;
  /** 已生成的王數（最多 BOSS_COUNT） */
  let bossCount = 0;
  /** 已擊敗的王數 */
  let bossDefeated = 0;

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
  /** 受傷飄字用：兩次回饋之間累計的扣血量 */
  let dmgAccum = 0;
  let state: GameState = 'running';
  let choices: Upgrade[] = [];

  /** 跳躍狀態（jumpY 為離地高度，疊加在地形高度之上） */
  let vy = 0;
  let jumpY = 0;
  let grounded = true;
  let jumpRequested = false;

  /** debug：經驗 ×10、無敵、回力鏢視覺大小 */
  let xpDebug = false;
  let invincible = false;
  let boomerangScale = 1;
  function requestJump() {
    if (state === 'running') jumpRequested = true;
  }

  const contactRange = CONFIG.player.radius + CONFIG.enemy.radius + 0.2;
  const contactRange2 = contactRange * contactRange;
  /** 障礙物推出計算用暫存 */
  const playerResolve = { x: 0, z: 0 };

  /** ===== 增益（寶箱）與道具 ===== */
  type BuffType = 'rapid' | 'power' | 'speed' | 'magnet' | 'multishot';
  const BUFFS: { type: BuffType; name: string; color: string }[] = [
    { type: 'rapid', name: '急速射擊', color: '#fbbf24' },
    { type: 'power', name: '威力提升', color: '#f87171' },
    { type: 'speed', name: '加速', color: '#34d399' },
    { type: 'magnet', name: '磁吸', color: '#22d3ee' },
    { type: 'multishot', name: '多重彈', color: '#a78bfa' },
  ];
  /** until 以遊戲秒數計 */
  const activeBuffs: { type: BuffType; until: number }[] = [];

  function applyBuff(eff: RunState, type: BuffType) {
    if (type === 'rapid') eff.fireInterval *= 0.5;
    else if (type === 'power') {
      eff.damage *= 2;
      eff.orbitalDamage *= 2;
      eff.auraDamage *= 2;
      eff.lightningDamage *= 2;
      eff.novaDamage *= 2;
      eff.boomerangDamage *= 2;
    } else if (type === 'speed') eff.moveSpeed *= 1.5;
    else if (type === 'magnet') eff.pickupRadius *= 3;
    else if (type === 'multishot') eff.projectileCount += 2;
  }

  /** 取得套用增益後的有效數值 */
  function effectiveRun(): RunState {
    const eff: RunState = { ...run };
    for (const b of activeBuffs) applyBuff(eff, b.type);
    return eff;
  }

  interface WorldItem {
    /** holder 節點（旋轉/浮動此節點，視覺為其子物件） */
    node: TransformNode;
    kind: 'chest' | 'heal';
    bornAt: number;
    baseY: number;
    healPct: number;
  }
  const itemList: WorldItem[] = [];
  let chestTimer = 0;
  let healTimer = 0;

  function spawnItem(kind: 'chest' | 'heal') {
    const range = CONFIG.arenaHalf - 4;
    const x = (Math.random() * 2 - 1) * range;
    const z = (Math.random() * 2 - 1) * range;
    const node = new TransformNode(`item-${kind}`, scene);
    if (kind === 'chest' && chestTemplate) {
      const vis = chestTemplate.clone('chest-vis', node);
      vis?.setEnabled(true);
    } else {
      const vis = kind === 'chest' ? createChestMesh(scene) : createHealMesh(scene);
      vis.parent = node;
    }
    const baseY = heightAt(x, z) + (kind === 'chest' ? 0.5 : 0.9);
    node.position.set(x, baseY, z);
    const healPct =
      kind === 'heal'
        ? CONFIG.items.healPercents[Math.floor(Math.random() * CONFIG.items.healPercents.length)]
        : 0;
    itemList.push({ node, kind, bornAt: time, baseY, healPct });
  }

  function triggerItem(item: WorldItem) {
    const pos = item.node.position;
    if (item.kind === 'chest') {
      const def = BUFFS[Math.floor(Math.random() * BUFFS.length)];
      const existing = activeBuffs.find((b) => b.type === def.type);
      if (existing) existing.until = time + CONFIG.items.buffDuration / 1000;
      else activeBuffs.push({ type: def.type, until: time + CONFIG.items.buffDuration / 1000 });
      spawnText(scene, pos, def.name, def.color, 5);
      sound.buff();
    } else {
      const amount = run.maxHp * item.healPct;
      hp = Math.min(run.maxHp, hp + amount);
      spawnText(scene, pos, `+${Math.round(item.healPct * 100)}% HP`, '#34d399');
      sound.heal();
    }
  }

  function updateItems(dt: number, px: number, pz: number) {
    const r = CONFIG.items.pickupRadius;
    const r2 = r * r;
    for (let i = itemList.length - 1; i >= 0; i--) {
      const item = itemList[i];
      item.node.rotation.y += dt * 1.6;
      item.node.position.y = item.baseY + Math.sin(time * 3 + i) * 0.18;

      if (time - item.bornAt > CONFIG.items.lifetimeSec) {
        item.node.dispose();
        itemList.splice(i, 1);
        continue;
      }
      const dx = item.node.position.x - px;
      const dz = item.node.position.z - pz;
      if (dx * dx + dz * dz <= r2) {
        triggerItem(item);
        item.node.dispose();
        itemList.splice(i, 1);
      }
    }
  }

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
    bossName: '',
    bossSkill: '',
    bossDefeated: 0,
    bossTotal: BOSS_COUNT,
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
    stats.bossName = boss.name;
    stats.bossSkill = boss.skillName;
    stats.bossDefeated = bossDefeated;
    stats.goldEarned = goldEarned;
    options.onStats?.(stats);
  }

  const clampArena = (v: number) => Math.max(-CONFIG.arenaHalf, Math.min(CONFIG.arenaHalf, v));

  function togglePause() {
    if (state === 'running') state = 'paused';
    else if (state === 'paused') state = 'running';
    else return;
    pushStats();
  }

  function enterLevelUp() {
    const rolled = rollChoices(levels);
    if (rolled.length === 0) return; // 全滿級，略過暫停
    choices = rolled;
    state = 'levelup';
    levelUpBurst(scene, new Vector3(player.position.x, player.position.y + 1, player.position.z));
    sound.levelUp();
    pushStats();
  }

  function gameplay(dt: number) {
    const dir = input.getDirection();
    /** 清除過期增益，計算套用增益後的有效數值 */
    for (let i = activeBuffs.length - 1; i >= 0; i--) {
      if (time >= activeBuffs[i].until) activeBuffs.splice(i, 1);
    }
    const eff = effectiveRun();

    /** 依攝影機水平角度（alpha）將輸入轉為相機相對方向：
     *  前（+z）= 遠離攝影機，右（+x）= 畫面右側。預設角度下為恆等。 */
    const ca = Math.cos(camera.alpha);
    const sa = Math.sin(camera.alpha);
    const moveX = dir.x * -sa + dir.z * -ca;
    const moveZ = dir.x * ca + dir.z * -sa;

    player.position.x = clampArena(player.position.x + moveX * eff.moveSpeed * dt);
    player.position.z = clampArena(player.position.z + moveZ * eff.moveSpeed * dt);
    /** 障礙物阻擋 */
    if (obstacles.length > 0) {
      resolveObstacles(obstacles, player.position.x, player.position.z, CONFIG.player.radius, playerResolve);
      player.position.x = clampArena(playerResolve.x);
      player.position.z = clampArena(playerResolve.z);
    }

    /** 面向移動方向（模型前方為 +Z），平滑轉向 */
    const moving = dir.x !== 0 || dir.z !== 0;
    if (moving) {
      const targetAngle = Math.atan2(moveX, moveZ);
      player.rotation.y = lerpAngle(player.rotation.y, targetAngle, 0.25);
    }
    /** 移動時播放走路動畫，停下時回到 idle（僅在狀態改變時切換） */
    if (moving !== playerMoving) {
      playerMoving = moving;
      if (moving) {
        playerIdle?.stop();
        playerWalk?.start(true);
      } else {
        playerWalk?.stop();
        playerIdle?.start(true);
      }
    }

    /** 跳躍：地表高度之上的拋物線位移（jumpY 為離地高度） */
    if (jumpRequested && grounded) {
      vy = CONFIG.player.jump.strength;
      grounded = false;
    }
    jumpRequested = false;
    if (!grounded) {
      vy -= CONFIG.player.jump.gravity * dt;
      jumpY += vy * dt;
      if (jumpY <= 0) {
        jumpY = 0;
        vy = 0;
        grounded = true;
      }
    }
    const airborne = jumpY > CONFIG.player.jump.dodgeHeight;

    const px = player.position.x;
    const pz = player.position.z;
    /** 玩家貼地（地形高度）+ 跳躍離地高度 */
    const groundY = heightAt(px, pz);
    player.position.y = groundY + jumpY;
    camera.target.set(px, groundY + 1.2, pz);

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
    enemies.update(dt, px, pz, grid, obstacles);

    /** 王：依序登場（共 BOSS_COUNT 隻） */
    bossTimer += dt;
    if (!boss.active && bossCount < BOSS_COUNT && bossTimer >= CONFIG.boss.intervalSec) {
      bossTimer = 0;
      boss.spawn(bossCount, px, pz);
      bossCount += 1;
    }

    const onKill = (x: number, z: number) => {
      gems.spawn(x, z);
      const y = heightAt(x, z);
      enemyDeathBurst(scene, new Vector3(x, y + CONFIG.enemy.y, z));
      bloodDecals.spawn(x, z, y + 0.03);
      sound.hit();
    };
    kills += weapon.update(dt, px, pz, enemies, boss, grid, eff, onKill, groundY);
    kills += extras.update(dt, px, pz, enemies, boss, eff, onKill, groundY);

    /** 王被擊敗：噴出大量經驗 + 爆炸特效 */
    if (boss.justDied) {
      boss.justDied = false;
      kills += 1;
      bossDefeated += 1;
      bossDeathBurst(scene, new Vector3(boss.x, heightAt(boss.x, boss.z) + 1.5, boss.z));
      sound.bossDown();
      for (let n = 0; n < CONFIG.boss.xpGems; n++) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * 3;
        gems.spawn(boss.x + Math.cos(a) * d, boss.z + Math.sin(a) * d);
      }
      /** 擊敗最終王 → 破關 */
      if (bossDefeated >= BOSS_COUNT) {
        goldEarned = Math.floor((kills * 0.6 + time) * goldMul) + 500;
        state = 'won';
        sound.levelUp();
        hazards.reset();
        pushStats();
        options.onGameOver?.({ gold: goldEarned, kills, time, level, won: true });
        return;
      }
    }

    boss.update(dt, px, pz, obstacles, hazards);
    /** 王招式對玩家造成的傷害（彈幕／震波／毒池，無視騰空） */
    const hazardDmg = hazards.update(dt, px, pz, groundY);
    if (hazardDmg > 0 && !invincible) {
      hp -= hazardDmg;
      dmgAccum += hazardDmg;
    }

    /** 道具：每 15 秒生成寶箱與回血，並更新拾取 */
    chestTimer += dt;
    if (chestTimer >= CONFIG.items.chestInterval / 1000) {
      chestTimer = 0;
      spawnItem('chest');
    }
    healTimer += dt;
    if (healTimer >= CONFIG.items.healInterval / 1000) {
      healTimer = 0;
      spawnItem('heal');
    }
    updateItems(dt, px, pz);

    const collected = gems.update(dt, px, pz, eff.pickupRadius);
    if (collected > 0) {
      /** 每顆寶石基礎經驗（預設 4） */
      xp += collected * 4 * eff.xpMultiplier * (xpDebug ? 10 : 1);
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
    /** 騰空時可躲開接觸傷害 */
    const hurt = (touching || bossTouch) && !airborne;
    if (touching && !airborne && !invincible) {
      const d = contactDps * dt;
      hp -= d;
      dmgAccum += d;
    }
    if (bossTouch && !airborne && !invincible) {
      const d = boss.contactDps * dt;
      hp -= d;
      dmgAccum += d;
    }

    /** 受擊回饋：間歇火花 + 頭上飄出扣血數字 */
    hurtTimer -= dt;
    if ((hurt || hazardDmg > 0) && hurtTimer <= 0) {
      hurtTimer = 0.35;
      hurtBurst(scene, new Vector3(px, groundY + 1, pz));
      sound.hurt();
      if (dmgAccum >= 1) spawnText(scene, new Vector3(px, groundY + 2.2, pz), `-${Math.round(dmgAccum)}`, '#ff5a5a', 2);
      dmgAccum = 0;
    }

    if (hp <= 0) {
      hp = 0;
      goldEarned = Math.floor((kills * 0.6 + time) * goldMul);
      state = 'dead';
      sound.playerDeath();
      pushStats();
      options.onGameOver?.({ gold: goldEarned, kills, time, level, won: false });
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

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') togglePause();
    else if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      requestJump();
    }
  };
  window.addEventListener('keydown', onKeyDown);

  /** ===== Debug 可調參數 ===== */
  interface DebugParam {
    label: string;
    group: string;
    type: 'range' | 'bool';
    min: number;
    max: number;
    step: number;
    get: () => number;
    set: (v: number) => void;
  }
  const cfgParam = (
    group: string,
    label: string,
    min: number,
    max: number,
    step: number,
    get: () => number,
    set: (v: number) => void,
  ): DebugParam => ({ group, label, type: 'range', min, max, step, get, set });
  const boolParam = (group: string, label: string, get: () => boolean, set: (v: boolean) => void): DebugParam => ({
    group,
    label,
    type: 'bool',
    min: 0,
    max: 1,
    step: 1,
    get: () => (get() ? 1 : 0),
    set: (v) => set(v > 0.5),
  });

  const debugSpec: DebugParam[] = [
    boolParam('玩家', '無敵', () => invincible, (v) => (invincible = v)),
    cfgParam('玩家', '移動速度', 0, 40, 0.5, () => run.moveSpeed, (v) => (run.moveSpeed = v)),
    cfgParam('玩家', '生命上限', 10, 1000, 10, () => run.maxHp, (v) => (run.maxHp = v)),
    cfgParam('玩家', '接觸傷害/秒', 0, 100, 1, () => CONFIG.player.contactDps, (v) => (CONFIG.player.contactDps = v)),
    cfgParam('玩家', '跳躍力', 0, 20, 0.5, () => CONFIG.player.jump.strength, (v) => (CONFIG.player.jump.strength = v)),

    cfgParam('武器', '傷害', 1, 200, 1, () => run.damage, (v) => (run.damage = v)),
    cfgParam('武器', '發射間隔', 0.05, 2, 0.05, () => run.fireInterval, (v) => (run.fireInterval = v)),
    cfgParam('武器', '投射物數', 1, 20, 1, () => run.projectileCount, (v) => (run.projectileCount = v)),
    cfgParam('武器', '射程', 5, 120, 1, () => run.range, (v) => (run.range = v)),
    cfgParam('武器', '彈速', 5, 120, 1, () => run.projectileSpeed, (v) => (run.projectileSpeed = v)),

    cfgParam('額外武器', '環繞飛斧數', 0, 6, 1, () => run.orbitalCount, (v) => (run.orbitalCount = v)),
    cfgParam('額外武器', '飛斧傷害', 0, 100, 1, () => run.orbitalDamage, (v) => (run.orbitalDamage = v)),
    cfgParam('額外武器', '飛斧半徑', 1, 20, 0.5, () => run.orbitalRadius, (v) => (run.orbitalRadius = v)),
    cfgParam('額外武器', '光環半徑', 0, 30, 1, () => run.auraRadius, (v) => (run.auraRadius = v)),
    cfgParam('額外武器', '光環傷害', 0, 100, 1, () => run.auraDamage, (v) => (run.auraDamage = v)),
    cfgParam('額外武器', '閃電連鎖數', 0, 10, 1, () => run.lightningCount, (v) => (run.lightningCount = v)),
    cfgParam('額外武器', '閃電傷害', 0, 100, 1, () => run.lightningDamage, (v) => (run.lightningDamage = v)),
    cfgParam('額外武器', '新星半徑', 0, 30, 1, () => run.novaRadius, (v) => (run.novaRadius = v)),
    cfgParam('額外武器', '新星傷害', 0, 100, 1, () => run.novaDamage, (v) => (run.novaDamage = v)),
    cfgParam('額外武器', '回力鏢數', 0, 8, 1, () => run.boomerangCount, (v) => (run.boomerangCount = v)),
    cfgParam('額外武器', '回力鏢傷害', 0, 100, 1, () => run.boomerangDamage, (v) => (run.boomerangDamage = v)),
    cfgParam(
      '額外武器',
      '長矛大小',
      0.2,
      6,
      0.1,
      () => boomerangScale,
      (v) => {
        boomerangScale = v;
        extras.setBoomerangScale(v);
      },
    ),

    cfgParam('怪物', '數量上限', 0, 52, 1, () => CONFIG.director.maxCount, (v) => (CONFIG.director.maxCount = v)),
    cfgParam('怪物', '初始數量', 0, 52, 1, () => CONFIG.director.baseCount, (v) => (CONFIG.director.baseCount = v)),
    cfgParam('怪物', '每階增量', 0, 20, 1, () => CONFIG.director.addPerStep, (v) => (CONFIG.director.addPerStep = v)),
    cfgParam('怪物', '升壓間隔秒', 1, 30, 1, () => CONFIG.director.stepIntervalSec, (v) => (CONFIG.director.stepIntervalSec = v)),
    cfgParam('怪物', '分離力', 0, 30, 1, () => CONFIG.enemy.separationForce, (v) => (CONFIG.enemy.separationForce = v)),

    cfgParam('王/道具', '王間隔秒', 5, 120, 1, () => CONFIG.boss.intervalSec, (v) => (CONFIG.boss.intervalSec = v)),
    cfgParam('王/道具', '王基礎血', 50, 5000, 50, () => CONFIG.boss.hpBase, (v) => (CONFIG.boss.hpBase = v)),
    cfgParam('王/道具', '寶箱間隔ms', 2000, 60000, 1000, () => CONFIG.items.chestInterval, (v) => (CONFIG.items.chestInterval = v)),
    cfgParam('王/道具', '回血間隔ms', 2000, 60000, 1000, () => CONFIG.items.healInterval, (v) => (CONFIG.items.healInterval = v)),

    cfgParam('王招式', '彈幕傷害', 0, 100, 1, () => hazards.projDamage, (v) => (hazards.projDamage = v)),
    cfgParam('王招式', '震波傷害', 0, 100, 1, () => hazards.shockDamage, (v) => (hazards.shockDamage = v)),
    cfgParam('王招式', '毒池傷害/秒', 0, 100, 1, () => hazards.poisonDps, (v) => (hazards.poisonDps = v)),
  ];

  pushStats();

  return {
    dispose() {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKeyDown);
      input.detach();
      sound.stopMusic();
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
      /** 最大生命升級補滿，其餘升級回復 30% 最大生命 */
      if (upgrade.id === 'maxhp') hp = run.maxHp;
      else hp = Math.min(run.maxHp, hp + run.maxHp * 0.3);
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
      vy = 0;
      jumpY = 0;
      grounded = true;
      jumpRequested = false;
      playerMoving = false;
      playerWalk?.stop();
      playerIdle?.start(true);
      player.position.set(0, heightAt(0, 0), 0);
      enemies.reset(0, 0);
      gems.reset();
      weapon.reset();
      extras.reset();
      boss.reset();
      hazards.reset();
      bloodDecals.reset();
      bossTimer = 0;
      bossCount = 0;
      bossDefeated = 0;
      activeBuffs.length = 0;
      for (const it of itemList) it.node.dispose();
      itemList.length = 0;
      chestTimer = 0;
      healTimer = 0;
      pushStats();
    },
    togglePause() {
      togglePause();
    },
    jump() {
      requestJump();
    },
    setXpDebug(on: boolean) {
      xpDebug = on;
    },
    setMuted(on: boolean) {
      sound.setMuted(on);
    },
    setMusicTrack(i: number) {
      sound.setMusicTrack(i);
    },
    getDebugParams() {
      return debugSpec.map((p) => ({
        label: p.label,
        group: p.group,
        type: p.type,
        min: p.min,
        max: p.max,
        step: p.step,
        value: p.get(),
      }));
    },
    setDebugParam(index: number, value: number) {
      debugSpec[index]?.set(value);
    },
    getUpgradeStatus() {
      return UPGRADES.map((u) => ({
        name: u.name,
        emoji: u.emoji,
        level: levels[u.id] ?? 0,
        maxLevel: u.maxLevel,
      }));
    },
  };
}

/** 角度插值（處理 ±π 環繞），用於平滑轉向 */
function lerpAngle(current: number, target: number, t: number): number {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * t;
}

/** 寶箱：金色發光箱 */
function createChestMesh(scene: Scene): Mesh {
  const box = MeshBuilder.CreateBox('chest', { width: 1.2, height: 0.9, depth: 0.9 }, scene);
  const m = new StandardMaterial('chest-mat', scene);
  m.diffuseColor = new Color3(0.9, 0.7, 0.2);
  m.emissiveColor = new Color3(0.5, 0.35, 0.05);
  m.specularColor = Color3.Black();
  box.material = m;
  box.isPickable = false;
  return box;
}

/** 回血：綠色十字（醫療包） */
function createHealMesh(scene: Scene): Mesh {
  const mat = new StandardMaterial('heal-mat', scene);
  mat.diffuseColor = new Color3(0.2, 0.85, 0.4);
  mat.emissiveColor = new Color3(0.15, 0.7, 0.3);
  mat.specularColor = Color3.Black();
  const v = MeshBuilder.CreateBox('heal', { width: 0.36, height: 1, depth: 0.36 }, scene);
  v.material = mat;
  v.isPickable = false;
  const h = MeshBuilder.CreateBox('heal-cross', { width: 1, height: 0.36, depth: 0.36 }, scene);
  h.parent = v;
  h.material = mat;
  h.isPickable = false;
  return v;
}

/**
 * 散布殭屍城鎮道具（油桶、貨櫃、三角錐、水塔），提供移動參考與氛圍。
 * solid 者登記為障礙物（半徑），阻擋玩家與怪物；三角錐為純裝飾。
 */
async function scatterProps(scene: Scene, obstacles: Obstacle[], heightAt: (x: number, z: number) => number) {
  const half = CONFIG.arenaHalf;
  const props: { path: string; height: number; count: number; solid?: number }[] = [
    { path: '/models/zombie/barrel.gltf', height: 2.2, count: 10, solid: 1 },
    { path: '/models/zombie/container.gltf', height: 4, count: 4, solid: 2.8 },
    { path: '/models/zombie/prop_container_red.gltf', height: 4, count: 3, solid: 2.8 },
    { path: '/models/zombie/cone.gltf', height: 1.5, count: 10 },
    { path: '/models/zombie/watertower.gltf', height: 10, count: 2, solid: 2.2 },
    { path: '/models/zombie/prop_truck.gltf', height: 4.5, count: 3, solid: 4 },
    { path: '/models/zombie/prop_couch.gltf', height: 1.8, count: 5, solid: 2 },
    { path: '/models/zombie/prop_hydrant.gltf', height: 1.8, count: 6, solid: 0.8 },
    { path: '/models/zombie/prop_barrier.gltf', height: 1.6, count: 7, solid: 1.5 },
    { path: '/models/zombie/prop_wheels.gltf', height: 1.6, count: 5, solid: 1 },
    { path: '/models/zombie/prop_pallet.gltf', height: 0.9, count: 8 },
    { path: '/models/zombie/prop_trashbag.gltf', height: 1.4, count: 10 },
    { path: '/models/zombie/prop_cinderblock.gltf', height: 0.9, count: 8 },
  ];

  for (const p of props) {
    const base = await loadModel(scene, p.path, p.height);
    if (!base) continue;
    const place = (node: { position: { x: number; y: number; z: number }; rotation: { y: number } }) => {
      let x = 0;
      let z = 0;
      /** 避開玩家出生點（半徑 10 內）重試幾次 */
      for (let tries = 0; tries < 8; tries++) {
        x = (Math.random() * 2 - 1) * half;
        z = (Math.random() * 2 - 1) * half;
        if (x * x + z * z > 100) break;
      }
      node.position.x = x;
      node.position.z = z;
      node.position.y = heightAt(x, z);
      node.rotation.y = Math.random() * Math.PI * 2;
      if (p.solid) obstacles.push({ x, z, radius: p.solid });
    };
    place(base);
    for (let i = 1; i < p.count; i++) {
      const clone = base.clone(`${p.path}-${i}`, null);
      if (clone) place(clone);
    }
  }
}
