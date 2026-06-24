// Difficulty-gradient palette: green (easy) → yellow → orange → red (hard)
export const HSK_CARD_BG: Record<number, string> = {
  0: "bg-gray-50",
  1: "bg-emerald-50",
  2: "bg-green-100",
  3: "bg-lime-100",
  4: "bg-yellow-100",
  5: "bg-amber-100",
  6: "bg-orange-100",
  7: "bg-orange-200",
  8: "bg-red-200",
  9: "bg-red-300",
};

export function hskCardBg(level: number | undefined): string {
  if (level === undefined || level <= 0) return HSK_CARD_BG[0];
  return HSK_CARD_BG[Math.min(level, 9)] ?? HSK_CARD_BG[0];
}
