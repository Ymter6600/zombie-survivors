# 動物大逃殺 Animal Survivors 🐾

3D 倖存者類（Vampire Survivors-like）roguelite。控制一隻動物，在動物怪潮中自動攻擊、撿經驗升級、三選一強化，活越久越好。美術延續《動物嗨起來》的低面數派對風格。

> 類型：**單人 horde-survival roguelite**（非多人對戰）。

## 技術
- Vue 3 + `<script setup>`、TypeScript
- Babylon.js（3D 場景、**thin instances** 繪製大量敵人）
- Vite + Tailwind CSS v4
- 零後端；目標跨平台（桌機鍵盤 + 手機觸控搖桿）

## 效能架構（核心）
- 敵人以 **thin instances** 單一 draw call 繪製，資料用 SoA 型別陣列。
- **空間雜湊網格**做鄰近查詢（分離、命中、接觸），避免 O(n²)。
- 投射物以**物件池**重用，固定上限。

## 開始
```bash
pnpm install
pnpm dev      # 開發（--host，手機可連區網）
pnpm build    # 型別檢查 + 建置
```

## 里程碑
1. ✅ **效能原型**：移動 + 跟隨相機、instanced 敵群湧向玩家、空間網格碰撞、自動武器、FPS/敵數壓測 HUD。
2. 經驗寶石 + 升級 + 三選一、血量/死亡/結算。
3. 多武器/被動/敵人、菁英與王、生成導演升壓。
4. 多角色、金幣、永久解鎖（roguelite meta）。
5. 美術手感（粒子特效、音效、HUD）、主選單。
6. 平衡、手機優化、部署（Cloudflare Pages）。

## 操作（里程碑 1）
- 移動：WASD／方向鍵，或左下虛擬搖桿（觸控）
- 攻擊：自動朝最近敵人發射
- 右上滑桿可即時調整敵人數量壓測 FPS
