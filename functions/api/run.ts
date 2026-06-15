import { type FnContext, json, clampNum, clampInt, sanitizeText } from './_lib';

/** POST /api/run — 送出一場結算，驗證後寫入 runs 並累加全球統計 */
export const onRequestPost = async ({ request, env }: FnContext): Promise<Response> => {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: 'invalid json' }, 400);
  }

  /** 合理性驗證（純前端分數可偽造，這裡做基本上限過濾） */
  const time = clampNum(body.time, 0, 3600);
  const kills = clampInt(body.kills, 0, Math.ceil(time * 25) + 50);
  const level = clampInt(body.level, 1, 999);
  const gold = clampInt(body.gold, 0, 1_000_000);
  const won = body.won ? 1 : 0;
  /** 本局是否動過 debug（前端回報）；標記後不列入排行榜、也不累加統計 */
  const cheated = body.cheated ? 1 : 0;
  /** 反作弊：7 隻王每 30 秒依序登場，最快也要約 210 秒才可能全破；低於此判定為偽造，拒收（debug 局本就排除，不套此限） */
  if (!cheated && won && time < 200) return json({ error: 'implausible clear time' }, 400);
  const name = sanitizeText(body.name, 16) || '倖存者';
  const character = sanitizeText(body.character, 16) || '?';
  const difficulty = sanitizeText(body.difficulty, 16) || 'easy';
  const deviceId = sanitizeText(body.deviceId, 64);
  const now = Date.now();

  try {
    const stmts = [
      env.DB
        .prepare(
          'INSERT INTO runs (device_id,name,character,time,kills,level,gold,won,difficulty,cheated,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
        )
        .bind(deviceId, name, character, time, kills, level, gold, won, difficulty, cheated, now),
    ];
    /** 作弊局不累加全球統計（避免 EXP×10／無敵 farm 灌水） */
    if (!cheated) {
      stmts.push(
        env.DB
          .prepare('UPDATE stats SET plays=plays+1, total_time=total_time+?, total_kills=total_kills+? WHERE id=1')
          .bind(time, kills),
      );
    }
    await env.DB.batch(stmts);
  } catch {
    return json({ error: 'db error' }, 500);
  }

  return json({ ok: true });
};
