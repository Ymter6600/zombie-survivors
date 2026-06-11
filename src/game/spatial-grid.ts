/** 空間雜湊網格：用於敵人分離、投射物命中、接觸判定等鄰近查詢，避免 O(n^2)。
 *
 * 每幀 clear() 後重新 insert 所有目標，再以 query() 取得鄰近 cell 的索引。
 */
export class SpatialGrid {
  private cellSize: number;
  private map = new Map<number, number[]>();

  constructor(cellSize: number) {
    this.cellSize = cellSize;
  }

  /** 將 cell 座標打包成單一數字 key（假設 cell 索引落在 ±4096 範圍內） */
  private cellKey(cx: number, cz: number): number {
    return (cx + 4096) * 8192 + (cz + 4096);
  }

  clear() {
    this.map.clear();
  }

  insert(index: number, x: number, z: number) {
    const cx = Math.floor(x / this.cellSize);
    const cz = Math.floor(z / this.cellSize);
    const key = this.cellKey(cx, cz);
    let bucket = this.map.get(key);
    if (!bucket) {
      bucket = [];
      this.map.set(key, bucket);
    }
    bucket.push(index);
  }

  /** 查詢 (x,z) 所在及相鄰 cell（3x3）內的索引，逐一呼叫 cb */
  query(x: number, z: number, cb: (index: number) => void) {
    const cx = Math.floor(x / this.cellSize);
    const cz = Math.floor(z / this.cellSize);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const bucket = this.map.get(this.cellKey(cx + dx, cz + dz));
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i++) cb(bucket[i]);
      }
    }
  }
}
