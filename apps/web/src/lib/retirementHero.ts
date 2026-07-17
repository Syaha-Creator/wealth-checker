/**
 * Hero target for retirement progress/gap.
 * Advanced mode compares against PV lump sum; simple uses nominal total.
 */
export function retirementHeroTarget(input: {
  mode: "simple" | "advanced";
  totalDanaPensiunWarisan: number;
  danaDibutuhkanSekarang?: number;
}): number {
  if (input.mode === "advanced") {
    const pv = input.danaDibutuhkanSekarang;
    if (typeof pv === "number" && Number.isFinite(pv) && pv > 0) return pv;
  }
  return Math.max(0, input.totalDanaPensiunWarisan);
}
