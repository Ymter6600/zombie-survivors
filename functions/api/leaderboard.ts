import { type FnContext, json } from './_lib';

interface RunRow {
  name: string;
  character: string;
  time: number;
  kills: number;
  level: number;
  gold: number;
  won: number;
  difficulty: string;
  created_at: number;
}

/**
 * GET /api/leaderboard?limit=10&difficulty=hard&mode=cleared
 * 兩張子榜：
 *  - mode=cleared  → 破關榜：只取 won=1，依破關時間「升冪」（越快越前面）
 *  - mode=survival → 生存榜（預設）：只取 won=0，依存活時間「降冪」（活越久越前面）
 * 可選難度過濾。
 */
export const onRequestGet = async ({ request, env }: FnContext): Promise<Response> => {
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 10, 1), 50);
  const difficulty = url.searchParams.get('difficulty');
  const cleared = url.searchParams.get('mode') === 'cleared';
  try {
    const conds = ['won = ?', 'cheated = 0'];
    const binds: unknown[] = [cleared ? 1 : 0];
    if (difficulty) {
      conds.push('difficulty = ?');
      binds.push(difficulty);
    }
    const order = cleared ? 'ASC' : 'DESC';
    binds.push(limit);
    const sql = `SELECT name,character,time,kills,level,gold,won,difficulty,created_at FROM runs WHERE ${conds.join(
      ' AND ',
    )} ORDER BY time ${order} LIMIT ?`;
    const { results } = await env.DB.prepare(sql).bind(...binds).all<RunRow>();
    const list = results.map((r) => ({
      name: r.name,
      character: r.character,
      time: r.time,
      kills: r.kills,
      level: r.level,
      gold: r.gold,
      won: !!r.won,
      difficulty: r.difficulty,
      at: r.created_at,
    }));
    return json(list);
  } catch {
    return json({ error: 'db error' }, 500);
  }
};
