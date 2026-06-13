/**
 * 畫質設定：只調整「純渲染成本」（解析度、抗鋸齒、發光、可視距離），
 * 不影響玩法（殭屍數量、傷害等一律不變）。預設高；不因裝置自動降階，由玩家手動切換。
 */
export type QualityId = 'high' | 'medium' | 'low';

export interface Quality {
  id: QualityId;
  name: string;
  /** 硬體縮放：值越大解析度越低（1=滿、1.5=約 44% 像素、2=25% 像素） */
  hardwareScaling: number;
  /** 抗鋸齒（於 Engine 建立時生效，切換後需重開遊戲才會變） */
  antialias: boolean;
  /** GlowLayer 發光強度（0=關閉發光層） */
  glow: number;
  /** 線性霧結束距離（越短越省，遠景被霧蓋掉） */
  fogEnd: number;
}

export const QUALITIES: Quality[] = [
  { id: 'high', name: '高', hardwareScaling: 1, antialias: true, glow: 0.8, fogEnd: 110 },
  { id: 'medium', name: '中', hardwareScaling: 1.5, antialias: false, glow: 0.45, fogEnd: 90 },
  { id: 'low', name: '低', hardwareScaling: 2, antialias: false, glow: 0, fogEnd: 70 },
];

export function getQuality(id: string): Quality {
  return QUALITIES.find((q) => q.id === id) ?? QUALITIES[0];
}
