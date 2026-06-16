import { type FnContext, json } from './_lib';

interface HourRow {
  hour: number;
  peak: number;
}

/**
 * GET /api/online-history?days=7 — 每小時最高同時在線時序（最多近 30 天）
 * 回傳 [{ hour, peak }]（hour = floor(epochMs/3600000)，UTC 整點 bucket，由小到大）
 */
export const onRequestGet = async ({ request, env }: FnContext): Promise<Response> => {
  const url = new URL(request.url);
  const days = Math.min(Math.max(Number(url.searchParams.get('days')) || 7, 1), 30);
  try {
    const now = Date.now();
    const sinceHour = Math.floor((now - days * 86400000) / 3600000);
    const { results } = await env.DB.prepare(
      'SELECT hour, peak FROM online_hourly WHERE hour >= ? ORDER BY hour ASC',
    )
      .bind(sinceHour)
      .all<HourRow>();
    /** 機會性清除 30 天前舊列 */
    const pruneHour = Math.floor((now - 30 * 86400000) / 3600000);
    await env.DB.prepare('DELETE FROM online_hourly WHERE hour < ?').bind(pruneHour).run();
    return json(results);
  } catch {
    return json({ error: 'db error' }, 500);
  }
};
