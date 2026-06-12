# 殭屍大逃殺 Animal Survivors 🧟

3D 倖存者類（Vampire Survivors-like）roguelite。操控一名倖存者（或狗狗），在無盡殭屍潮中自動開火、撿經驗升級、三選一強化武器，依序擊敗 **5 隻殭屍王**即可破關。低面數美術、跨平台（桌機鍵鼠 + 手機觸控）、純前端零後端。

> 線上試玩：**https://animal-survivors.pages.dev**

---

## 🎮 玩法

- 角色**自動**朝最近的殭屍攻擊，玩家只負責**走位**與**升級選擇**。
- 撿地上的經驗寶石 → 升等 → 從 3 個隨機升級中挑 1 個（每次升級回復 **30% 生命**）。
- 每 15 秒地圖生成**寶箱**（開啟給 10 秒隨機增益）與**回血道具**（15/30/50%）。
- 每 30 秒登場一隻**殭屍王**，各有專屬招式；擊敗第 5 隻 → **破關**。
- 死亡後依存活時間與擊殺數結算**金幣**，回主選單可解鎖角色與購買永久強化（roguelite meta，存於 localStorage）。

### 操作
| | 桌機 | 手機 |
|---|---|---|
| 移動 | WASD／方向鍵 | 左下虛擬搖桿 |
| 跳躍（可閃避接觸傷害） | 空白鍵 | 右下「跳躍」鈕 |
| 視角 | 左鍵拖曳旋轉、滾輪縮放 | 單指拖曳、雙指縮放 |
| 暫停 | ESC | 右上 ⏸ |
| 攻擊 | 自動 | 自動 |

移動為**相機相對**（轉動視角後上下左右會跟著畫面走）。

---

## 🔫 武器與升級

升級共 **14 種**；每次升級從尚未滿級者隨機抽 3 個。

**主武器（子彈）**：⚔️攻擊力(8)・⚡攻速(8)・🎯多重彈(4)・🔭射程(5)・💨彈速(5)

**額外武器（皆 10 階，吸血鬼倖存者風格）**
- 🛰️ **環繞衛星** — 旋轉斧頭繞身碰撞傷害
- 🌀 **傷害光環** — 周身持續灼燒範圍
- ⚡ **連鎖閃電** — 定期電擊最近敵人並鋸齒連鎖
- 💥 **新星爆** — 定期向外擴張的範圍爆炸
- 🪃 **回力鏢** — 長矛飛出再飛回、沿途貫穿

**被動**：👟移動速度・❤️最大生命・🧲拾取範圍・⭐經驗加成（各 5 階）

## 🧟 殭屍王（依序登場，打完即破關）
| # | 王 | 招式 |
|---|---|---|
| 1 | 巨胖殭屍 | 蓄力衝撞 |
| 2 | 狂暴肋骨怪 | 骨刺連射 |
| 3 | 斷臂巨怪 | 震地波 |
| 4 | 腐毒殭屍 | 毒池 |
| 5 | 終極殭屍王 | 環形彈幕 |

## 🐕 角色（各有不同起始攻擊）
| 角色 | 起始攻擊 | 特性 |
|---|---|---|
| 🔫 麥特 | 強化單發子彈 | 均衡 |
| 👟 莉絲 | 三連發散射 | 高速、脆皮 |
| ⚡ 山姆 | 極速連射 | 輸出爆發、略脆 |
| 🪓 尚恩 | 環繞飛斧 | 拾取廣、經驗多 |
| 🐕 德國狼犬 | 連鎖閃電 | 機動、射程長 |
| 🐶 巴哥犬 | 傷害光環 | 肉盾、血厚 |

倖存者預設解鎖，狗角色於商店以金幣解鎖。

---

## 🛠️ 技術
- **Vue 3**（`<script setup>`）+ **TypeScript**
- **Babylon.js 9** — 3D 場景、模型、粒子、輝光（GlowLayer）
- **Vite 6** + **Tailwind CSS v4**
- Web Audio 程式合成音效（零音檔）
- 零後端，部署於 **Cloudflare Pages**

### 效能架構
- 子彈／環境道具／地面以 **thin instances** 單一 draw call 繪製（SoA 型別陣列）。
- 怪海採**少量全動畫殭屍池**（預先 instantiate、循環啟用），兼顧動畫與效能。
- **空間雜湊網格**做鄰近查詢（分離、命中、接觸），避免 O(n²)。
- 投射物、經驗寶石、血跡貼片皆採**物件池**重用。
- 受擊白光用 per-mesh `renderOverlay`，不影響共用材質的其他單位。

---

## 🚀 開發與部署
```bash
pnpm install
pnpm dev      # 開發伺服器（--host，手機可連區網）
pnpm build    # vue-tsc 型別檢查 + vite 建置
pnpm preview  # 預覽 build 結果

# 部署（Cloudflare Pages）
pnpm build
wrangler pages deploy --branch=main
```
SPA 轉址由 `public/_redirects` 處理（`/* /index.html 200`）。

## 📁 專案結構
```
src/
├─ game/
│  ├─ game.ts          # 主迴圈：玩家、相機、生成導演、碰撞、升級、王、道具
│  ├─ zombie-horde.ts  # 全動畫殭屍怪群（thin pool）
│  ├─ weapon-system.ts # 自動子彈（飛刀 thin instance）
│  ├─ extra-weapons.ts # 衛星／光環／閃電／新星／回力鏢
│  ├─ boss.ts          # 5 隻王與招式狀態機
│  ├─ boss-hazards.ts  # 王招式對玩家的傷害實體（彈幕/震波/毒池）
│  ├─ upgrades.ts      # RunState 與升級表
│  ├─ characters.ts / meta.ts  # 角色與 roguelite meta（金幣/解鎖/永久強化）
│  ├─ effects.ts / sound.ts / decals.ts  # 粒子、音效、血跡
│  ├─ spatial-grid.ts / obstacles.ts     # 空間網格、障礙碰撞
│  └─ model-loader.ts / gem-system.ts / input.ts / config.ts
├─ components/         # menu / hud / game-view / joystick / 各 modal
└─ App.vue
public/models/zombie/  # GLB/glTF 模型（角色、殭屍、武器、道具）
```

## 🎨 素材
3D 模型取自第三方低面數模型包（角色、殭屍、武器、場景道具），實際使用的檔案放在 `public/models/zombie/`。原始素材包置於 `download/`，已 gitignore、不納入版控。
