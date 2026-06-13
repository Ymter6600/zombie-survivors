# 開發經驗談：用同一套技術，換美術就是一款新遊戲

這份文件記錄我們怎麼從既有專案一路演進、最後做出《殭屍大逃殺》，**重點是：整套技術（玩法引擎 + 全球後端 + 音效）都可重用，下一款遊戲原則上只要換掉「美術模組 + 主題文案 + 數值資料」就能成形**。給未來想快速做新遊戲的人當 playbook。

演進脈絡：
《動物嗨起來》(2D 派對) → 企鵝亂鬥場 → **動物大逃殺**（3D 倖存者類，動物 GLB）→ **殭屍大逃殺**（全面換皮）。
核心心法一句話：**先做好「玩法系統」，美術只是可抽換的資產層**。把渲染/數值/狀態跟「模型路徑」解耦，換皮就只是換素材 + 改對應表。

技術棧：**Vue 3 `<script setup>` + TypeScript + Vite + Tailwind v4 + Babylon.js**（前端） / **Cloudflare Pages Functions + D1（SQLite）**（後端） / **Web Audio 程序合成**（音效）。

---

## 0. 架構分層：哪些可重用、哪些每款要換

這是整份文件最重要的一張表。把專案想成三層：

| 層 | 內容 | 換新遊戲時 |
|---|---|---|
| **引擎層（可直接重用）** | 主迴圈、輸入、相機、碰撞網格、物件池、thin-instance、動畫池、發光/閃白、傷害結算、升級/Roguelite meta、難度系統、打擊感特效、HUD/選單框架、**全球後端（排行榜/統計/在線/留言板）**、音效合成器 | **幾乎不動** |
| **資料層（每款要調）** | 角色定義、敵人類型、王定義與招式、升級項目、難度級距、數值常數 | **改 `*.ts` 裡的資料陣列** |
| **資產層（每款要換）** | `public/models/` 內的 GLB、主題文案、配色、favicon、背景音樂音符表 | **換檔 + 改字串** |

> 判斷準則：**任何「跟模型路徑或主題字串有關」的東西＝資產層**；**任何「跟玩法規則/數值有關」的＝資料層**；其餘流程/渲染/網路＝引擎層。寫程式時刻意把這三者分檔，換皮成本就趨近於零。

---

## 1. 3D 素材去哪裡抓

優先找**同一個作者/同一個包**的低面數素材，風格才會一致。常用免費（多為 CC0，可商用）來源：

| 來源 | 特色 |
|---|---|
| **Quaternius** (quaternius.com) | 大量 CC0 低面數包：角色、殭屍、動物、武器、載具、環境，**附骨架動畫**。本專案的殭屍/倖存者/武器/場景都來自這類包。 |
| **Kenney** (kenney.nl) | CC0，風格乾淨統一，含 UI/音效/模型，新手最好上手。 |
| **Poly Pizza** (poly.pizza) | 低面數模型搜尋引擎，多數 CC0，可直接下載 GLB。 |
| **Sketchfab** | 量最大，記得用 **License 篩選 CC0／Downloadable**，留意標示來源。 |
| **itch.io / OpenGameArt** | 獨立作者素材包，授權逐一確認。 |

選素材原則：
- **同一包 = 同一風格**：跨包混用比例會打架。
- **角色要有動畫**：至少 `Idle` 與 `Walk/Run`（移動時腳要會動）。
- **格式優先 GLB / glTF**：Babylon 原生支援；FBX/OBJ 需轉檔。
- **授權先看清楚**：CC0 最省事；其他要保留出處、遵守姓名標示。**切勿混入有版權的素材**（我們曾誤抓到 XCOM/OpenXcom 的 `.cat/.mid`，只能看不能用）。
- **面數要低**：怪海/倖存者類會同時出現大量單位，模型越輕越好。

---

## 2. 下載後怎麼接進專案

### 2-1. 先搞清楚 glTF 的「自包性」
`.gltf` 可能有兩種：
- **自包**：buffer 與貼圖以 base64 內嵌在單一 `.gltf`（或就是 `.glb`）→ 複製一個檔就能用。
- **外部相依**：`.gltf` 旁邊還有 `.bin` 與貼圖 `.png`，靠相對路徑載入 → 要連同一起搬。

檢查方法（看有沒有指向外部檔的 `uri`）：
```bash
grep -o '"uri"[^,}]*' model.gltf | grep -v 'data:'
```
沒輸出 = 自包，直接複製即可。本專案的包剛好都是自包單檔。

### 2-2. 只搬用到的，原始包別進版控
原始素材包通常很肥（本專案 `download/` 達 100MB+，含一堆沒用到的 FBX/Blend/載具）。做法：
1. 把**實際會用到**的檔複製到 `public/models/<theme>/`，用語意化命名（`survivor_matt.gltf`、`zombie_basic.gltf`、`weapon_axe.gltf`、`prop_couch.gltf`）。
2. 原始包整包 **gitignore**（`download`）。
3. Commit 時把「模型資產」與「程式碼」分開兩筆，歷史乾淨、好 review。
4. **大檔別進 git**（我們曾有 212MB demo 影片，改放外部連結 + 截圖）。

---

## 3. Babylon.js 載入模型的坑（我們實際踩過的）

### 3-1. 大小正規化 + 貼地
不同模型原始尺寸天差地遠。統一用「目標身高」縮放、底部對齊 `y=0`：
```ts
const { min, max } = root.getHierarchyBoundingVectors();
const scale = targetHeight / (max.y - min.y);
root.scaling.scaleInPlace(scale);
root.position.y = -min.y * scale; // 腳貼地
```
見 `src/game/model-loader.ts`。

### 3-2. glTF 根節點帶 `rotationQuaternion` → `rotation.y` 失效
最常見的雷。glTF 匯入後的 `__root__` 帶有四元數（處理座標系轉換），**直接設 `mesh.rotation.y` 不會轉**。解法：**包一層自己的 `TransformNode` holder，轉 holder**：
```ts
const holder = new TransformNode('unit', scene);
modelRoot.parent = holder;
holder.rotation.y = Math.atan2(dirX, dirZ); // 有效
```
玩家、殭屍、王、環繞武器、寶箱、血跡全用這招（見 `zombie-horde.ts`、`boss.ts`、`extra-weapons.ts`）。

### 3-3. 角色動畫：idle / walk 切換
匯入後拿 `animationGroups`，用名稱比對抓 idle 與 walk，依移動狀態切換（只在狀態改變時切，避免每幀重啟）：
```ts
const walk = groups.find(g => /walk|run|move|sprint/i.test(g.name));
const idle = groups.find(g => /idle/i.test(g.name)) ?? groups[0];
```
見 `model-loader.ts` 的角色載入與 `game.ts` 的移動判斷。

### 3-4. 大量同模型：兩條路線
- **thin instances**（單一 draw call、超快）：適合**靜態或無骨架**物件（子彈、地面、環境）。模型是階層 → 先 `Mesh.MergeMeshes(parts, true, true, undefined, false, true)` 合併成單一 mesh，再 `thinInstanceSetBuffer('matrix', ...)`。每個實例的位置/旋轉/縮放都靠矩陣陣列（SoA `Float32Array`）。見 `weapon-system.ts`（飛刀）、`gem-system.ts`。
- **全動畫池**（`instantiateModelsToScene`）：要**骨架動畫**的單位（殭屍）無法用 thin instance，改預先複製一池、循環啟用前 N 隻；數量上限要壓低（本專案 ~50）。見 `zombie-horde.ts`。
  - **重點坑**：thin-instance 物件每次 spawn 都要記得 `writeMatrix(i)` 寫回矩陣，否則實例位置不會更新（我們曾因 gem spawn 漏寫，導致部分寶石不顯示）。

### 3-5. 扁平模型不能用「高度」正規化
血跡、地磚這種**扁平**模型，高度≈0，用 `targetHeight/height` 會算出**爆炸級縮放**。改用**橫向寬度**正規化：
```ts
const w = Math.max(max.x - min.x, max.z - min.z);
root.scaling.scaleInPlace(TARGET_WIDTH / w);
```
見 `decals.ts`、`ground-decals.ts`。

### 3-6. 發光：自發光材質 + GlowLayer
想讓武器/寶箱「邊緣發光」，模型原始材質通常不發光。做法：場景加一個 `GlowLayer`，再把目標物件的材質換成 `emissiveColor` 高的 `StandardMaterial`（`disableLighting = true`）。GlowLayer 成本是**固定的後處理模糊**，跟發光物件數量幾乎無關。想讓某物件**不要**發光（如增益飄字）要把它從 GlowLayer 排除。見 `game.ts`。

### 3-7. 單體受擊閃白：per-mesh `renderOverlay`
怪物共用材質，想讓「被打的那一隻」閃白而不影響別隻 → 用 **per-mesh** 的 `mesh.renderOverlay = true` + `overlayAlpha`，**不要改材質**。前提：`new Engine(canvas, true, { stencil: true })` 要開 stencil。見 `zombie-horde.ts` / `boss.ts`。

### 3-8. 教訓：不是每個素材都適合你的用途
我們本來想用 `Street_4Way` 街道磚平鋪當地面，結果該磚可見幾何只佔格子中央一小塊，鋪出來變成「藍底散落灰方塊」很醜。**素材不合用時別硬湊**——最後改用程序生成的柏油貼圖（`DynamicTexture` 畫裂縫/血漬/黃線 + 平鋪），可靠又零相依。見 `terrain.ts` / `game.ts` 的地面建立。

### 3-9. 離線縮圖（圖鑑/角色預覽）
要在選單顯示「真實模型縮圖」：用一顆暫時的 `Engine` + `canvas.toDataURL()`（比 `CreateScreenshot` 在離屏更可靠）。選單即時 3D 預覽則用「每張卡一個 engine、unmount 時 dispose」。見 `model-thumbs.ts`、`character-previews.ts`。

---

## 4. 可重用的「玩法引擎」系統清單（檔案地圖）

下面這些**幾乎都能直接搬到下一款遊戲**，只改資料不改流程：

| 檔案 | 角色 | 換皮要動嗎 |
|---|---|---|
| `game.ts` | 主迴圈總指揮（生成、傷害結算、升級、王登場、音樂分段、stats 回報） | 流程不動；只有引用的資料表會換 |
| `input.ts` | 鍵盤/搖桿/相機相對移動 | 不動 |
| `spatial-grid.ts` | 空間雜湊網格（鄰近查詢） | 不動 |
| `obstacles.ts` | 障礙物碰撞解算 | 不動 |
| `terrain.ts` / `ground-decals.ts` | 程序地面 + 隨機地面貼片 | 換貼圖風格字串 |
| `zombie-horde.ts` / `enemy-system.ts` | 敵人動畫池、AI、遠程攻擊、凍結、閃白 | **改 `ZOMBIE_TYPES` 資料 + 模型路徑** |
| `boss.ts` / `boss-hazards.ts` | 王（依序登場、招式：彈幕/震波/毒池/衝撞/環射）、彈幕池 | **改 `BOSS_DEFS` 資料 + 模型路徑** |
| `weapon-system.ts` / `extra-weapons.ts` | 主武器（飛刀 thin-instance）+ 環繞/光環/閃電/新星/迴力鏢 | 換武器模型；招式邏輯可留 |
| `gem-system.ts` | 經驗寶石（thin-instance + 磁吸） | 不動 |
| `effects.ts` | 打擊火花、死亡爆裂、王受擊回饋 | 不動（顏色可調） |
| `upgrades.ts` | 升級項目資料 + `effectiveRun()` 倍率層 | **改 `UPGRADES` 資料** |
| `meta.ts` | Roguelite 永久升級、金幣、解鎖（localStorage） | 改永久升級項目 |
| `difficulty.ts` | 5 級難度（HP/速度/接觸/王血/成長/獎勵倍率） | 調級距數值 |
| `characters.ts` | 角色定義（起始數值、被動、起始武器、模型） | **改 `CHARACTERS` 資料 + 模型路徑** |
| `config.ts` | 全域數值常數（玩家、敵人、王、道具…） | 調數值 |
| `sound.ts` | Web Audio 合成（SFX + 多軌背景音樂 + 王音效） | 改音符表（見 §6） |
| `api.ts` / `leaderboard.ts` | 前端串接全球後端 + 本機回退 | 只改 localStorage key 前綴 |

**通用模式**：`RunState`（本場數值）+ `effectiveRun()`（疊加臨時 buff 倍率）+ `meta`（跨場永久）三層分離；物件池（子彈/寶石/血跡/彈幕）避免 GC；所有 spawn 走池子循環。

---

## 5. 全球服務後端（Cloudflare Pages Functions + D1）

**整套後端可直接重用**，是「零維運成本」的全球排行榜/統計/在線/留言板。換新遊戲只要改資料庫名與 localStorage key 前綴。

### 5-1. 結構
- `functions/api/*.ts`：每個檔即一個路由（`/api/<檔名>`）；檔名以 `_` 開頭的**不是路由**（共用工具放 `_lib.ts`）。
- `functions/` **不被 vue-tsc 型別檢查**（它是 Workers 環境），所以 `_lib.ts` 自帶最小 D1 型別宣告，不引入 `@cloudflare/workers-types`。
- 同源 `/api`，**不需要 CORS**。
- 全部**fail-soft**：前端抓不到就回退本機資料（localStorage），離線也能玩。

### 5-2. 現成端點（可照搬）
| 端點 | 方法 | 用途 |
|---|---|---|
| `/api/run` | POST | 上傳一場結算（驗證 + 寫 `runs` + 更新 `stats`） |
| `/api/leaderboard` | GET | 全球排行（支援 `?limit`、`?difficulty` 過濾） |
| `/api/stats` | GET | 累計統計（場次/時間/擊殺） |
| `/api/heartbeat` | POST | 在線心跳（遊戲中每 20s 上報 deviceId） |
| `/api/online` | GET | 目前在線人數（近 45s 有心跳者；順手清過期列） |
| `/api/messages` | GET/POST | 留言板（取最新 50 / 新增，含 sanitize + 長度限制） |

### 5-3. D1 設定要點
- `schema.sql` 放所有 `CREATE TABLE IF NOT EXISTS`；用 `wrangler d1 execute <db> --file=./schema.sql --remote` 套用。
- **加欄位用 `ALTER TABLE`**（如後來新增 `difficulty` 欄）。
- `wrangler.jsonc` 綁定 `d1_databases`：`binding: "DB"` → `database_id`（建完 DB 填真實 UUID，不要留佔位字串）。
- 輸入一律經 `sanitizeText`（去控制字元 + 長度上限）/ `clampNum`，避免髒資料與 injection。
- deviceId 存在前端 localStorage，作為在線去重與基本防濫用。

---

## 6. 音效 / 音樂系統（零音檔）

`sound.ts` 用 **Web Audio 程序合成**，不需要任何音檔：
- **SFX**：`tone()`（振盪器 + 包絡）與 `noise()`（濾波白噪）組合出開槍、命中、升級、受傷、王登場/招式/被擊敗等。
- **背景音樂**：多軌（本作 4 首），每首是一個 `build(t, bar)` 函式用音符表排程；`scheduler()` 提前排下一小節，**切歌在下一小節無縫生效**。
- **依進度分段切歌**：用「擊敗王數」當里程碑自動換曲（本作 0→暗潮、≥2→獵殺、≥4→肅殺、≥6→狂亂），UI 下拉同步顯示且可手動覆蓋。
- **可聽度坑**：基頻別低於 ~100Hz，否則筆電/手機喇叭放不出來（我們的王登場音一開始用 48–70Hz 幾乎無聲，拉到 150–660Hz 才聽得到）。

換新遊戲只要改音符表（roots/melody 陣列）與曲名即可，合成器與排程邏輯不動。

---

## 7. 換皮（reskin）流程清單

1. **盤點素材**：把包裡的 `Characters / Environment / Weapons / Vehicles` 列出來。
2. **做對應表**（舊概念 → 新素材）：
   | 概念 | 用到的素材 |
   |---|---|
   | 玩家角色 | 持武器主角 `*_SingleWeapon` |
   | 怪海 | N 種雜兵 |
   | 王 | 放大的雜兵／特殊單位 |
   | 經驗寶石/寶箱 | 內嵌幾何 + `Chest.gltf` |
   | 場景道具 | 油桶/貨櫃/水塔/卡車… |
3. **換資產層**：把 GLB 丟進 `public/models/<theme>/`，改各資料檔的模型路徑字串（`characters.ts`、`zombie-horde.ts` 的 `ZOMBIE_TYPES`、`boss.ts` 的 `BOSS_DEFS`、武器 system）。
4. **調資料層**：`config.ts` 數值、`upgrades.ts` 升級項、`difficulty.ts` 級距、`meta.ts` 永久升級。
5. **換文案/配色/favicon**：HUD 標題、選單、結算字、`index.html` 標題、`public/favicon.svg`、Tailwind 配色、`background-polygons` 色盤。
6. **改音樂音符表**（`sound.ts`）與曲名（§6）。
7. **後端改名**：`wrangler.jsonc` 的 DB 名、`schema.sql` 註解、前端 localStorage key 前綴（`api.ts`、`leaderboard.ts`）。端點程式不用動。
8. **型別檢查 + 本地測試**：`pnpm exec vue-tsc --noEmit` 後 `pnpm dev` 實測（注意 `functions/` 不在型檢範圍，要單獨用 `curl` 測端點）。

---

## 8. 部署

- **遊戲（SPA）+ 後端**：Cloudflare Pages。
  ```bash
  pnpm build
  npx wrangler pages deploy dist --project-name=<name> --branch=main --commit-dirty=true
  ```
  `public/_redirects` 做 SPA fallback；`functions/` 會自動被當成 Pages Functions 部署，D1 透過 `wrangler.jsonc` 綁定。
- **D1 套 schema**：`npx wrangler d1 execute <db> --file=./schema.sql --remote`。
- **介紹網站**：放 `docs/`，GitHub Pages 由 `main` 分支 `/docs` 自動建置（`gh api repos/<owner>/<repo>/pages` 設定 source）。純靜態 HTML，可嵌 YouTube、截圖。
- **踩過的雷**：
  - OAuth 憑證若沒有 `workflow` scope，**無法 push `.github/workflows/*.yml`** → commit 前先 `git restore --staged .github/workflows/deploy.yml` 排除。
  - 子網域被占用時 Cloudflare 會自動補後綴（`zombie-survivors` → `zombie-survivors-e4y.pages.dev`）。
  - 端點改動後**記得重新 `pages deploy`**，否則線上還是舊版（我們曾以為改了沒生效，其實是沒部署）。

---

## 9. 給「下一款新遊戲」的快速起步

1. 直接 **fork 本專案**，留下 §0 表中的「引擎層 + 後端 + 音效」。
2. 跑 §7 換皮清單：換 `public/models/`、改資料檔字串、調數值、換文案/配色/favicon、改音符表。
3. 開一個新的 Cloudflare Pages 專案 + 新 D1（改 `wrangler.jsonc` 名稱與 id、改 localStorage key 前綴），套 `schema.sql`。
4. 大量單位先想清楚 **thin instance vs 動畫池**，效能在原型階段就壓測（動畫池容量壓低）。
5. `pnpm exec vue-tsc --noEmit` → `pnpm dev` 實測 → `pages deploy`。

> 一句總結：**玩法是資產，美術也是資產，但要分層。** 系統寫得跟模型、主題、後端名稱無關，下一款遊戲就是「換 `public/models/` + 改幾個字串 + 開一個新 D1」而已。
