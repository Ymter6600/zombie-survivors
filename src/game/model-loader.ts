import { Scene, SceneLoader, TransformNode } from '@babylonjs/core';
import '@babylonjs/loaders';

/**
 * 載入 GLB 模型並正規化大小：縮放到指定高度、底部對齊 y=0、停用拾取、播放 idle/walk 動畫。
 * 失敗時回傳 null，呼叫端可退回程序化造型。
 */
export async function loadModel(
  scene: Scene,
  path: string,
  targetHeight: number,
): Promise<TransformNode | null> {
  try {
    const slash = path.lastIndexOf('/');
    const rootUrl = path.slice(0, slash + 1);
    const file = path.slice(slash + 1);

    const result = await SceneLoader.ImportMeshAsync('', rootUrl, file, scene);
    const root = result.meshes[0];

    result.animationGroups.forEach((g) => g.stop());
    const anim =
      result.animationGroups.find((g) => /idle/i.test(g.name)) ??
      result.animationGroups.find((g) => /walk/i.test(g.name)) ??
      result.animationGroups[0];
    anim?.play(true);

    /** 依世界包圍盒高度正規化縮放，底部對齊地面 */
    const { min, max } = root.getHierarchyBoundingVectors();
    const height = max.y - min.y || 1;
    const scale = targetHeight / height;
    root.scaling.x *= scale;
    root.scaling.y *= scale;
    root.scaling.z *= scale;
    root.position.y = -min.y * scale;

    result.meshes.forEach((m) => (m.isPickable = false));
    return root;
  } catch (error) {
    console.warn('[loadModel] 載入失敗，改用程序化造型：', path, error);
    return null;
  }
}
