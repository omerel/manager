import { monthsBetween } from "@/lib/dates";

type Checkpoint = { offsetMonths: number; target: number };

/**
 * Compact planned-vs-actual curve for a cumulative metric.
 * X = months from recruitment, Y = accumulated value. Planned = stepped line
 * through checkpoints; actual = the recorded reading; dashed line = today.
 */
export function MetricCurve({
  checkpoints,
  value,
  recruitmentDate,
  asOf,
  today,
  unit,
}: {
  checkpoints: Checkpoint[];
  value: number | null;
  recruitmentDate: Date;
  asOf: Date | null;
  today: Date;
  unit: string;
}) {
  const cps = [...checkpoints].sort((a, b) => a.offsetMonths - b.offsetMonths);
  if (cps.length === 0) return null;

  const W = 320;
  const H = 120;
  const pad = 24;

  const currentOffset = Math.max(0, monthsBetween(recruitmentDate, today));
  const asOfOffset = asOf ? Math.max(0, monthsBetween(recruitmentDate, asOf)) : null;

  const maxOffset = Math.max(...cps.map((c) => c.offsetMonths), currentOffset, 1);
  const maxTarget = Math.max(...cps.map((c) => c.target), value ?? 0, 1);

  const x = (off: number) => pad + (off / maxOffset) * (W - 2 * pad);
  const y = (val: number) => H - pad - (val / maxTarget) * (H - 2 * pad);

  const plannedPts = [{ off: 0, val: 0 }, ...cps.map((c) => ({ off: c.offsetMonths, val: c.target }))];
  const plannedPath = plannedPts.map((p) => `${x(p.off)},${y(p.val)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full max-w-sm" role="img" aria-label="עקומת מתוכנן מול בפועל">
      {/* axes */}
      <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="#cbd5e1" strokeWidth={1} />
      <line x1={pad} y1={pad} x2={pad} y2={H - pad} stroke="#cbd5e1" strokeWidth={1} />

      {/* today marker */}
      <line x1={x(currentOffset)} y1={pad} x2={x(currentOffset)} y2={H - pad} stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3" />

      {/* planned curve */}
      <polyline points={plannedPath} fill="none" stroke="#10b981" strokeWidth={2} />
      {cps.map((c, i) => (
        <circle key={i} cx={x(c.offsetMonths)} cy={y(c.target)} r={3} fill="#10b981" />
      ))}

      {/* actual reading */}
      {value !== null && asOfOffset !== null && (
        <>
          <line x1={x(0)} y1={y(0)} x2={x(asOfOffset)} y2={y(value)} stroke="#3b82f6" strokeWidth={2} />
          <circle cx={x(asOfOffset)} cy={y(value)} r={4} fill="#3b82f6" />
        </>
      )}

      <text x={pad} y={14} fontSize={9} fill="#64748b">
        {unit}
      </text>
    </svg>
  );
}
