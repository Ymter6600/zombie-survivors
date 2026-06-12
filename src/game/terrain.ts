import {
  Scene,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  Color3,
  DynamicTexture,
  Texture,
  VertexBuffer,
  VertexData,
} from '@babylonjs/core';
import { CONFIG } from './config';

/**
 * 地形高度（解析函式，給所有單位貼地用）。目前為全平面。
 * 若日後想要起伏，改這裡回傳高度即可（其餘貼地邏輯已接好）。
 */
export function terrainHeight(_x: number, _z: number): number {
  return 0;
}

/** 末日柏油路面材質（深色底 + 接縫 + 顆粒 + 裂縫 + 血漬 + 黃線） */
function asphaltMaterial(scene: Scene): StandardMaterial {
  const px = 512;
  const tex = new DynamicTexture('ground-tex', px, scene, false);
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;

  ctx.fillStyle = '#262d39';
  ctx.fillRect(0, 0, px, px);
  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * px;
    const y = Math.random() * px;
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.07)';
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 6;
  ctx.strokeRect(0, 0, px, px);
  ctx.strokeStyle = 'rgba(150,160,180,0.10)';
  ctx.lineWidth = 2;
  ctx.strokeRect(6, 6, px - 12, px - 12);

  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  for (let k = 0; k < 4; k++) {
    let x = Math.random() * px;
    let y = Math.random() * px;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 6; s++) {
      x += (Math.random() - 0.5) * 140;
      y += (Math.random() - 0.5) * 140;
      ctx.lineTo(x, y);
    }
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.stroke();
  }
  for (let k = 0; k < 3; k++) {
    const bx = Math.random() * px;
    const by = Math.random() * px;
    const r = 24 + Math.random() * 50;
    const g = ctx.createRadialGradient(bx, by, 0, bx, by, r);
    g.addColorStop(0, 'rgba(85,12,12,0.6)');
    g.addColorStop(1, 'rgba(85,12,12,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(200,180,45,0.22)';
  for (let k = 0; k < 4; k++) {
    ctx.fillRect(Math.random() * px, Math.random() * px, 22 + Math.random() * 26, 5);
  }
  tex.update();
  tex.wrapU = Texture.WRAP_ADDRESSMODE;
  tex.wrapV = Texture.WRAP_ADDRESSMODE;
  tex.uScale = 12;
  tex.vScale = 12;

  const material = new StandardMaterial('ground-material', scene);
  material.diffuseTexture = tex;
  material.specularColor = Color3.Black();
  return material;
}

/**
 * 建立起伏地形：細分地面網格，依 terrainHeight 位移頂點並重算法線。
 * 回傳 mesh 與高度查詢函式（兩者用同一函式，保證視覺與貼地一致）。
 */
export function createTerrain(scene: Scene): { mesh: Mesh; heightAt: (x: number, z: number) => number } {
  const size = CONFIG.arenaHalf * 2.4;
  const ground = MeshBuilder.CreateGround(
    'ground',
    { width: size, height: size, subdivisions: 120, updatable: true },
    scene,
  );

  const positions = ground.getVerticesData(VertexBuffer.PositionKind);
  if (positions) {
    for (let i = 0; i < positions.length; i += 3) {
      positions[i + 1] = terrainHeight(positions[i], positions[i + 2]);
    }
    ground.updateVerticesData(VertexBuffer.PositionKind, positions);
    const indices = ground.getIndices();
    if (indices) {
      const normals: number[] = [];
      VertexData.ComputeNormals(positions, indices, normals);
      ground.updateVerticesData(VertexBuffer.NormalKind, normals);
    }
  }

  ground.material = asphaltMaterial(scene);
  ground.isPickable = false;
  return { mesh: ground, heightAt: terrainHeight };
}
