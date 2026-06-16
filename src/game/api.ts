import type { RunRecord, GlobalStats } from './leaderboard';

/** 後端 API（Cloudflare Pages Functions，同源 /api）。全部失敗時回傳 null，由呼叫端回退本機資料。 */
const BASE = '/api';
const DEVICE_KEY = 'animal-survivors:deviceId';

function deviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2);
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export interface RunSubmit {
  name: string;
  character: string;
  time: number;
  kills: number;
  level: number;
  gold: number;
  won: boolean;
  difficulty: string;
  /** 本局是否動過 debug（後端據此標記、排除於排行榜） */
  cheated: boolean;
}

/** 送出一場結算（fire-and-forget，離線/失敗則忽略） */
export async function submitRun(run: RunSubmit): Promise<void> {
  try {
    await fetch(`${BASE}/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...run, deviceId: deviceId() }),
    });
  } catch {
    /* 離線忽略 */
  }
}

/** 取全球排行榜；mode=cleared 破關榜（最快）/survival 生存榜（最久）；可選難度過濾；失敗回傳 null */
export async function fetchLeaderboard(
  limit = 10,
  difficulty?: string,
  mode: 'cleared' | 'survival' = 'survival',
): Promise<RunRecord[] | null> {
  try {
    const q = difficulty ? `&difficulty=${encodeURIComponent(difficulty)}` : '';
    const res = await fetch(`${BASE}/leaderboard?limit=${limit}&mode=${mode}${q}`);
    if (!res.ok) return null;
    return (await res.json()) as RunRecord[];
  } catch {
    return null;
  }
}

/** 上報心跳（遊戲進行中定期呼叫，標記在線）；失敗忽略 */
export async function sendHeartbeat(): Promise<void> {
  try {
    await fetch(`${BASE}/heartbeat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ deviceId: deviceId() }),
    });
  } catch {
    /* 離線忽略 */
  }
}

/** 取目前線上遊玩人數 + 同時在線歷史最高；失敗回傳 null */
export async function fetchOnline(): Promise<{ online: number; peak: number } | null> {
  try {
    const res = await fetch(`${BASE}/online`);
    if (!res.ok) return null;
    const data = (await res.json()) as { online: number; peak: number };
    return { online: data.online ?? 0, peak: data.peak ?? 0 };
  } catch {
    return null;
  }
}

/** 留言板留言 */
export interface Message {
  id: number;
  name: string;
  text: string;
  at: number;
}

/** 取最新留言；失敗回傳 null */
export async function fetchMessages(): Promise<Message[] | null> {
  try {
    const res = await fetch(`${BASE}/messages`);
    if (!res.ok) return null;
    return (await res.json()) as Message[];
  } catch {
    return null;
  }
}

/** 送出一則留言；成功回傳 true */
export async function postMessage(name: string, text: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, text, deviceId: deviceId() }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** 每小時最高同時在線（時序）一筆 */
export interface OnlineHourPoint {
  /** floor(epochMs/3600000)，UTC 整點 bucket */
  hour: number;
  peak: number;
}

/** 取每小時線上人數歷史（最多 30 天）；失敗回傳 null */
export async function fetchOnlineHistory(days = 7): Promise<OnlineHourPoint[] | null> {
  try {
    const res = await fetch(`${BASE}/online-history?days=${days}`);
    if (!res.ok) return null;
    return (await res.json()) as OnlineHourPoint[];
  } catch {
    return null;
  }
}

/** 取全球累計統計；失敗回傳 null */
export async function fetchStats(): Promise<GlobalStats | null> {
  try {
    const res = await fetch(`${BASE}/stats`);
    if (!res.ok) return null;
    return (await res.json()) as GlobalStats;
  } catch {
    return null;
  }
}
