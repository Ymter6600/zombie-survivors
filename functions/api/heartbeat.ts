import { type FnContext, json, sanitizeText } from './_lib';

/** POST /api/heartbeat — 遊戲進行中定期上報，標記此裝置仍在線 */
export const onRequestPost = async ({ request, env }: FnContext): Promise<Response> => {
  try {
    const body = (await request.json().catch(() => ({}))) as { deviceId?: string };
    const id = sanitizeText(body.deviceId, 64);
    if (!id) return json({ ok: false }, 400);
    const now = Date.now();
    await env.DB.prepare(
      'INSERT INTO presence (device_id, last_seen) VALUES (?, ?) ON CONFLICT(device_id) DO UPDATE SET last_seen = ?',
    )
      .bind(id, now, now)
      .run();
    /** 順手記錄同時在線最高：算近 90 秒人數，超過歷史峰值才更新（條件式 UPDATE 避免 race） */
    const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM presence WHERE last_seen > ?')
      .bind(now - 90000)
      .first<{ n: number }>();
    const n = row?.n ?? 0;
    await env.DB.prepare('UPDATE stats SET peak_online = ?, peak_online_at = ? WHERE id = 1 AND peak_online < ?')
      .bind(n, now, n)
      .run();
    /** 每小時時序：記錄這一小時內的最高同時在線（供歷史圖表） */
    const hour = Math.floor(now / 3600000);
    await env.DB.prepare(
      'INSERT INTO online_hourly (hour, peak) VALUES (?, ?) ON CONFLICT(hour) DO UPDATE SET peak = MAX(peak, excluded.peak)',
    )
      .bind(hour, n)
      .run();
    return json({ ok: true });
  } catch {
    return json({ ok: false }, 500);
  }
};
