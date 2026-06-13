import { Scene, SceneLoader, TransformNode } from '@babylonjs/core';
import '@babylonjs/loaders';

/** 血跡貼圖模型（殭屍死亡地面血痕） */
const BLOOD_PATHS = [
  '/models/zombie/blood_1.glb',
  '/models/zombie/blood_2.glb',
  '/models/zombie/blood_3.glb',
];
/** 每種血跡預先複製的數量；總池大小 = 種類數 × 此值（環狀循環覆寫） */
const POOL_PER = 10;
/** 血跡橫向目標尺寸（公尺） */
const TARGET_WIDTH = 2.2;

/**
 * 血跡裝飾池：殭屍死亡時於地面放下隨機血痕。
 * 以環狀緩衝重複使用固定數量的節點，避免每次擊殺都配置記憶體。
 * 每片血跡包在自有 holder（glTF 根帶 rotationQuaternion，需旋轉 holder）。
 */
export class BloodDecals {
  private pool: TransformNode[] = [];
  private cursor = 0;
  private ready = false;
  private scene: Scene;

  constructor(scene: Scene) {
    this.scene = scene;
    void this.init();
  }

  private wrap(visual: TransformNode): TransformNode {
    const holder = new TransformNode('blood', this.scene);
    visual.parent = holder;
    holder.setEnabled(false);
    return holder;
  }

  private async init() {
    for (const path of BLOOD_PATHS) {
      const slash = path.lastIndexOf('/');
      try {
        const result = await SceneLoader.ImportMeshAsync('', path.slice(0, slash + 1), path.slice(slash + 1), this.scene);
        const root = result.meshes[0] as TransformNode;
        result.animationGroups.forEach((g) => g.stop());
        /** 以橫向寬度正規化（血跡為扁平模型，不可用高度正規化） */
        const { min, max } = root.getHierarchyBoundingVectors();
        const w = Math.max(max.x - min.x, max.z - min.z) || 1;
        root.scaling.scaleInPlace(TARGET_WIDTH / w);
        result.meshes.forEach((m) => (m.isPickable = false));
        this.pool.push(this.wrap(root));
        for (let i = 1; i < POOL_PER; i++) {
          const clone = root.clone(`blood-${i}`, null);
          if (clone) this.pool.push(this.wrap(clone));
        }
      } catch {
        /* 載入失敗則略過此種血跡 */
      }
    }
    this.ready = this.pool.length > 0;
  }

  spawn(x: number, z: number, y = 0.03) {
    if (!this.ready) return;
    const node = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % this.pool.length;
    node.position.set(x, y, z);
    node.rotation.y = Math.random() * Math.PI * 2;
    node.setEnabled(true);
  }

  reset() {
    for (const n of this.pool) n.setEnabled(false);
    this.cursor = 0;
  }
}
