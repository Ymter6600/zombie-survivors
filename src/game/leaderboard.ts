/** 排行榜紀錄（本機存於 localStorage，全球來自後端） */
export interface RunRecord {
  /** 玩家暱稱 */
  name: string;
  character: string;
  time: number;
  kills: number;
  level: number;
  gold: number;
  won: boolean;
  /** 難度 id（easy/normal/hard/nightmare/hell） */
  difficulty: string;
  /** 紀錄時間（毫秒），由呼叫端帶入 */
  at: number;
}

const NAME_KEY = 'animal-survivors:name';
/** 玩家暱稱（用於排行榜上榜）；未設定回傳空字串 */
export function getPlayerName(): string {
  return (localStorage.getItem(NAME_KEY) || '').trim();
}
export function setPlayerName(name: string) {
  try {
    localStorage.setItem(NAME_KEY, name.trim().slice(0, 16));
  } catch {
    /* 忽略寫入失敗 */
  }
}

const KEY = 'animal-survivors:leaderboard:v1';
const MAX = 10;

export function loadRecords(): RunRecord[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as RunRecord[];
  } catch {
    /* 忽略損毀資料 */
  }
  return [];
}

/** 本機累積統計（純前端，無後端故為此裝置統計） */
export interface GlobalStats {
  plays: number;
  totalTime: number;
  totalKills: number;
}

const STATS_KEY = 'animal-survivors:stats:v1';

export function loadStats(): GlobalStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (raw) {
      const d = JSON.parse(raw) as Partial<GlobalStats>;
      return { plays: d.plays ?? 0, totalTime: d.totalTime ?? 0, totalKills: d.totalKills ?? 0 };
    }
  } catch {
    /* 忽略損毀資料 */
  }
  return { plays: 0, totalTime: 0, totalKills: 0 };
}

/** 累加一場遊戲統計並回傳更新後的值 */
export function recordStats(time: number, kills: number): GlobalStats {
  const s = loadStats();
  s.plays += 1;
  s.totalTime += time;
  s.totalKills += kills;
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(s));
  } catch {
    /* 忽略寫入失敗 */
  }
  return s;
}

/**
 * 新增一筆並回傳更新後的本機排行榜。
 * 為支援兩張子榜，分別保留：破關者取「最快」前 MAX、未破關者取「最久」前 MAX，再合併。
 */
export function addRecord(record: RunRecord): RunRecord[] {
  const list = loadRecords();
  list.push(record);
  const cleared = list.filter((r) => r.won).sort((a, b) => a.time - b.time).slice(0, MAX); // 最快破關
  const survival = list.filter((r) => !r.won).sort((a, b) => b.time - a.time).slice(0, MAX); // 最久存活
  const merged = [...cleared, ...survival];
  try {
    localStorage.setItem(KEY, JSON.stringify(merged));
  } catch {
    /* 忽略寫入失敗 */
  }
  return merged;
}
