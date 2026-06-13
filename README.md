# 殭屍大逃殺 Zombie Survivors 🧟

3D 倖存者類（Vampire Survivors-like）roguelite。操控一名倖存者（或狗狗、海盜），在無盡殭屍潮中自動開火、撿經驗升級、三選一強化武器，依序擊敗 **7 隻殭屍王**即可破關。低面數美術、跨平台（桌機鍵鼠 + 手機觸控），含 **全球排行榜／在線人數／留言板**（Cloudflare D1 後端，離線自動回退本機）。

> 線上試玩：**https://zombie-survivors-e4y.pages.dev**
> 介紹網站：**https://craig7351.github.io/zombie-survivors/**

![殭屍大逃殺 遊戲畫面](docs/assets/shot1.png)

### 📺 遊玩影片
[![殭屍大逃殺 遊玩影片](https://img.youtube.com/vi/w_0QVCkW9rU/hqdefault.jpg)](https://www.youtube.com/watch?v=w_0QVCkW9rU)

### 🖼️ 遊戲畫面
<p>
  <img src="docs/assets/shot2.png" width="32%" />
  <img src="docs/assets/shot3.png" width="32%" />
  <img src="docs/assets/shot4.png" width="32%" />
</p>

### 📱 手機畫面
<p>
  <img src="docs/assets/phone1.jpg" width="19%" />
  <img src="docs/assets/phone2.jpg" width="19%" />
  <img src="docs/assets/phone3.jpg" width="19%" />
  <img src="docs/assets/phone4.jpg" width="19%" />
  <img src="docs/assets/phone5.jpg" width="19%" />
  <img src="docs/assets/phone6.jpg" width="19%" />
  <img src="docs/assets/phone7.jpg" width="19%" />
</p>

---

## 🎮 玩法

- 角色**自動**朝最近的殭屍攻擊，玩家只負責**走位**與**升級選擇**。
- 撿地上的經驗寶石 → 升等 → 從 3 個隨機升級中挑 1 個（每次升級回復 **30% 生命**）。
- 每 15 秒地圖生成**寶箱**（開啟給 10 秒隨機增益）與**回血道具**。
- 每 30 秒登場一隻**殭屍王**，各有專屬招式；擊敗第 **7** 隻 → **破關**。
- 死亡或破關後依存活時間與擊殺數結算**金幣**，回主選單可解鎖角色與購買永久強化（roguelite meta，存於 localStorage）。

### 操作
| | 桌機 | 手機 |
|---|---|---|
| 移動 | WASD／方向鍵 | 左下虛擬搖桿 |
| 跳躍（騰空可閃避接觸傷害） | 空白鍵 | 右下「跳躍」鈕 |
| 視角 | 左鍵拖曳旋轉、滾輪縮放 | 單指拖曳、雙指縮放 |
| 暫停 | ESC | 右上 ⏸ |
| 畫質 / 靜音 | 右上下拉 / 🔊 | 同 |
| 攻擊 | 自動 | 自動 |

移動為**相機相對**（轉動視角後上下左右會跟著畫面走）。

### 流程與頁面
- **首頁**：末日風格落地頁（漂浮多邊形背景）。需先輸入暱稱才能開始；顯示**目前遊玩人數**（即時）與本機累積統計（場次／時間／擊殺）。四顆按鈕：▶ 遊戲開始／🏆 排行榜／🧟 怪物圖鑑／💬 留言板。
- **難度選擇**：按「遊戲開始」後先選 5 種難度之一。
- **角色選擇**：8 個角色即時 3D 預覽（播 idle、自轉）＋ 詳細介紹；含永久強化商店。
- **排行榜**：全球排行（Cloudflare D1），可**依難度分頁過濾**；抓不到後端時回退本機前 10 場。
- **怪物圖鑑**：6 種殭屍 ＋ 7 隻王的模型縮圖與招式說明。
- **留言板**：全球留言（D1），暱稱與排行榜共用。

---

## 🎚️ 難度（按「遊戲開始」後選擇）

| 難度 | 怪物血量 | 接觸傷害 | 王血量 | 金幣獎勵 |
|---|---|---|---|---|
| 😀 簡單（預設） | ×1 | ×1 | ×1 | ×1 |
| 🙂 普通 | ×1.5 | ×1.3 | ×1.5 | ×1.5 |
| 😬 困難 | ×2.2 | ×1.6 | ×2.2 | ×2.2 |
| 😱 夢魘 | ×3.5 | ×2 | ×3.5 | ×3.5 |
| 💀 地獄 | ×5 | ×2.6 | ×5 | ×5 |

難度同時影響敵人移速與隨時間的成長速率。

---

## 🔫 武器與升級

升級共 **25 種**；每次升級從尚未滿級者隨機抽 3 個。

**主武器（子彈，5）**：⚔️攻擊力(8)・⚡攻速(8)・🎯多重彈(4)・🔭射程(5)・💨彈速(5)

**額外武器（5，皆 10 階，吸血鬼倖存者風格）**
- 🪓 **環繞飛斧** — 旋轉斧頭繞身碰撞傷害（升級 +1 把並擴大環繞範圍）
- 🌀 **傷害光環** — 周身持續灼燒範圍
- ⚡ **連鎖閃電** — 定期電擊最近敵人並鋸齒連鎖
- 💥 **新星爆** — 定期向外擴張的範圍衝擊波
- 🪃 **回力鏢** — 長矛飛出再飛回、沿途貫穿

**群控（3）**：❄️減速光環・🐌時緩（全場永久減速）・🧊冰凍彈

**防禦／續航（4）**：🩸吸血（每秒回血有上限）・❤️‍🩹生命再生・🛡️護甲（減傷，上限 70%）・🔆能量護盾（定期擋一次）

**進攻修飾（3）**：💥暴擊・🎯穿透・🧨爆裂彈

**被動（5）**：👟移動速度・🦘跳躍強化・❤️最大生命・🧲拾取範圍・⭐經驗加成

## 🧟 殭屍王（依序登場，打完第 7 隻即破關）
| # | 王 | 招式 |
|---|---|---|
| 1 | 巨胖殭屍 | 蓄力衝撞 |
| 2 | 狂暴肋骨怪 | 骨刺連射 |
| 3 | 斷臂巨怪 | 震地波 |
| 4 | 腐毒殭屍 | 毒池 |
| 5 | 海盜船長 | 手槍掃射 |
| 6 | 巨鯊 | 高速衝咬 |
| 7 | 深海觸手（最終王） | 深海彈幕（全方位） |

雜兵 6 種：基本殭屍、肋骨怪（快速）、胖殭屍（坦克）、斷臂殭屍、骷髏兵（不死）、無頭骷髏（遠程射手）。

## 🐕 角色（各有不同起始攻擊）
| 角色 | 起始攻擊 | 特性 | 解鎖 |
|---|---|---|---|
| 🔫 麥特 | 強化單發子彈 | 均衡，適合新手 | 預設 |
| 🧲 尚恩 | 環繞飛斧 | 拾取廣、升級最快 | 💰200 |
| 👟 莉絲 | 三連發散射 | 高速、脆皮 | 💰300 |
| ⚡ 山姆 | 極速連射 | 輸出爆發、略脆 | 💰300 |
| 🐶 巴哥犬 | 傷害光環 | 肉盾、血厚 | 💰350 |
| 🐕 德國狼犬 | 連鎖閃電 | 機動風箏、射程長 | 💰400 |
| 💥 砲手安妮 | 新星爆 | 範圍轟炸、清群強 | 💰400 |
| 🦈 鯊牙馬可 | 高暴擊（30%） | 暴擊爆發 | 💰450 |

僅麥特預設解鎖，其餘以金幣於商店解鎖。

---

## 🛠️ 技術
- **Vue 3**（`<script setup>`）+ **TypeScript**
- **Babylon.js 9** — 3D 場景、模型、骨架動畫、粒子、輝光（GlowLayer）
- **Vite** + **Tailwind CSS v4**
- Web Audio 程式合成音效與背景音樂（零音檔）；背景音樂 4 首隨擊敗王數**自動切換**（暗潮→獵殺→肅殺→狂亂）
- **畫質高／中／低**切換（右上下拉，即時生效）：調整算繪解析度、抗鋸齒、發光、可視距離；不影響玩法數值
- **後端**：Cloudflare Pages Functions + **D1（SQLite）** 提供全球排行榜／累計統計／在線人數／留言板；同源 `/api`、全部 fail-soft（離線回退本機）
- 進度／本機排行存於 localStorage；部署於 **Cloudflare Pages**

### 模型最佳化
- 所有模型以 **Draco** 壓縮為二進位 `.glb`（37MB → 9.6MB，玩家首次下載省約 26MB）。
- Draco 解碼器**自帶**於 `public/draco/`（同源，不依賴外部 CDN），於 `src/main.ts` 設定。
- 重壓模型：`pnpm dlx @gltf-transform/cli draco in.gltf out.glb`（已加為 devDependency）。

### 效能架構
- 子彈／經驗寶石／地面以 **thin instances** 單一 draw call 繪製（SoA 型別陣列）。
- 怪海採**少量全動畫殭屍池**（預先 instantiate、循環啟用），兼顧動畫與效能。
- **空間雜湊網格**做鄰近查詢（分離、命中、接觸），避免 O(n²)。
- 投射物、經驗寶石、血跡貼片、王彈幕皆採**物件池**重用。
- 受擊白光用 per-mesh `renderOverlay`，不影響共用材質的其他單位。

---

## 🚀 開發與部署
```bash
pnpm install
pnpm dev      # 開發伺服器（--host，手機可連區網）
pnpm build    # vue-tsc 型別檢查 + vite 建置
pnpm preview  # 預覽 build 結果

# 部署（Cloudflare Pages，含 functions/ 後端）
pnpm build
npx wrangler pages deploy dist --project-name=zombie-survivors --branch=main

# D1 資料表（首次/變更時）
npx wrangler d1 execute <db-name> --file=./schema.sql --remote
```
SPA 轉址由 `public/_redirects` 處理（`/* /index.html 200`）；D1 綁定見 `wrangler.jsonc`。

## 📁 專案結構
```
src/
├─ game/
│  ├─ game.ts          # 主迴圈：玩家、相機、生成導演、碰撞、升級、王、道具、音樂分段
│  ├─ zombie-horde.ts / enemy-system.ts  # 全動畫殭屍怪群（動畫池）、敵人邏輯
│  ├─ weapon-system.ts # 自動子彈（飛刀 thin instance）
│  ├─ extra-weapons.ts # 環繞飛斧／光環／閃電／新星／回力鏢
│  ├─ boss.ts          # 7 隻王與招式狀態機
│  ├─ boss-hazards.ts  # 王招式對玩家的傷害實體（彈幕/震波/毒池）
│  ├─ upgrades.ts      # RunState 與 25 種升級表
│  ├─ characters.ts / meta.ts / difficulty.ts  # 8 角色、roguelite meta、5 難度
│  ├─ leaderboard.ts / api.ts            # 本機排行/統計、後端 API（排行榜/在線/留言）
│  ├─ terrain.ts / ground-decals.ts      # 地面（柏油材質）、馬路與地面貼片
│  ├─ effects.ts / sound.ts / decals.ts  # 粒子、音效+背景音樂、血跡
│  ├─ spatial-grid.ts / obstacles.ts     # 空間網格、障礙碰撞
│  ├─ quality.ts                         # 畫質（高/中/低）設定
│  ├─ character-previews.ts / model-thumbs.ts  # 選單即時預覽 / 圖鑑縮圖
│  └─ model-loader.ts / gem-system.ts / input.ts / config.ts
├─ components/         # landing / difficulty / leaderboard / bestiary / message-board / menu / hud / game-view / 各 modal
└─ App.vue
functions/api/         # Cloudflare Pages Functions：run / leaderboard / stats / heartbeat / online / messages
public/
├─ models/zombie/      # Draco 壓縮 .glb 模型（角色、殭屍、武器、道具）
├─ draco/              # 自帶 Draco 解碼器
└─ _redirects          # SPA fallback
schema.sql             # D1 資料表（runs / stats / presence / messages）
docs/                  # 介紹網站（GitHub Pages，/docs）
```
頁面流程：`landing` → `difficulty` → `menu`（角色選擇）→ `game`；另有 `leaderboard`、`bestiary`、`messages` 分頁。

## 🎨 素材
3D 模型取自第三方低面數模型包（角色、殭屍、武器、場景道具），實際使用的檔案以 Draco 壓縮後放在 `public/models/zombie/`。原始素材包置於 `download/`，已 gitignore、不納入版控。換皮做法詳見 [GAME.md](GAME.md)。
