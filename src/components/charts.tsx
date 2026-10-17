/**
 * Minimal SVG charts. Server-rendered, accessible via a summary sentence and a <title>.
 */
export function ActivityChart({ series }: { series: { day: string; answered: number; correct: number }[] }) {
  const max = Math.max(1, ...series.map((s) => s.answered));
  const w = 600;
  const h = 140;
  const gap = 3;
  const bw = (w - gap * (series.length - 1)) / series.length;
  const total = series.reduce((n, s) => n + s.answered, 0);
  return (
    <figure>
      <svg viewBox={`0 0 ${w} ${h + 18}`} className="h-auto w-full" role="img" aria-label={`${total} graded answers over the last ${series.length} days`}>
        <title>{`Answers per day, last ${series.length} days`}</title>
        {series.map((s, i) => {
          const x = i * (bw + gap);
          const ah = (s.answered / max) * h;
          const ch = (s.correct / max) * h;
          return (
            <g key={s.day}>
              <rect x={x} y={h - ah} width={bw} height={Math.max(ah, s.answered ? 2 : 0)} rx={2} className="fill-bad/70" />
              <rect x={x} y={h - ch} width={bw} height={Math.max(ch, s.correct ? 2 : 0)} rx={2} className="fill-good" />
              <title>{`${s.day}: ${s.correct} correct of ${s.answered}`}</title>
            </g>
          );
        })}
        <line x1={0} x2={w} y1={h} y2={h} className="stroke-border" />
        <text x={0} y={h + 14} className="fill-muted text-[10px]">{series[0]?.day}</text>
        <text x={w} y={h + 14} textAnchor="end" className="fill-muted text-[10px]">Today</text>
      </svg>
      <figcaption className="mt-2 flex gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-good" aria-hidden /> Correct</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-bad/70" aria-hidden /> Incorrect</span>
      </figcaption>
    </figure>
  );
}

export function ForecastChart({ counts }: { counts: number[] }) {
  const max = Math.max(1, ...counts);
  const labels = ["Today", "Tomorrow"];
  return (
    <ol className="flex h-28 items-end gap-1.5" aria-label="Cards becoming due over the next two weeks">
      {counts.map((c, i) => (
        <li key={i} className="flex flex-1 flex-col items-center gap-1" title={`${labels[i] ?? `In ${i} days`}: ${c} due`}>
          <span className="text-[10px] text-muted">{c > 0 ? c : ""}</span>
          <span
            className={i === 0 ? "w-full rounded-t bg-accent" : "w-full rounded-t bg-surface-2"}
            style={{ height: `${Math.max(3, (c / max) * 80)}px` }}
          />
          <span className="sr-only">{`${labels[i] ?? `Day ${i}`}: ${c}`}</span>
        </li>
      ))}
    </ol>
  );
}
