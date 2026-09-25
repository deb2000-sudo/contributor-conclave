import type { CountShare, MonthTotal } from "@/lib/student/insights";
import { shortMonthLabel } from "@/lib/student/insights";

const sliceStyles = [
  { stroke: "stroke-moss-700 dark:stroke-moss-300", dot: "bg-moss-700 dark:bg-moss-300" },
  { stroke: "stroke-moss-900 dark:stroke-moss-100", dot: "bg-moss-900 dark:bg-moss-100" },
  { stroke: "stroke-amber-800 dark:stroke-amber-100", dot: "bg-amber-800 dark:bg-amber-100" },
  { stroke: "stroke-moss-500 dark:stroke-paper", dot: "bg-moss-500 dark:bg-paper" },
  { stroke: "stroke-ink dark:stroke-moss-500", dot: "bg-ink dark:bg-moss-500" },
];

export function ShareDonut({
  title,
  slices,
  caption,
}: {
  title: string;
  slices: CountShare[];
  caption?: string;
}) {
  const total = slices.reduce((sum, slice) => sum + slice.count, 0);
  const radius = 15.5;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const summary = slices.map((slice) => `${slice.label} ${slice.count}`).join(", ");

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <svg
        viewBox="0 0 42 42"
        className="size-28 shrink-0 -rotate-90"
        role="img"
        aria-label={total === 0 ? `${title}: no records` : `${title}: ${summary}`}
      >
        <circle
          cx="21"
          cy="21"
          r={radius}
          fill="none"
          strokeWidth="6"
          className="stroke-ink/10 dark:stroke-paper/15"
        />
        {total > 0
          ? slices.map((slice, index) => {
              const length = (slice.count / total) * circumference;
              const dash = `${length} ${circumference - length}`;
              const style = sliceStyles[index % sliceStyles.length];
              const circle = (
                <circle
                  key={slice.label}
                  cx="21"
                  cy="21"
                  r={radius}
                  fill="none"
                  strokeWidth="6"
                  strokeDasharray={dash}
                  strokeDashoffset={-offset}
                  className={style?.stroke}
                />
              );
              offset += length;
              return circle;
            })
          : null}
      </svg>
      <div className="min-w-0">
        {caption ? <p className="text-sm text-ink/70 dark:text-paper/70">{caption}</p> : null}
        <ul className="mt-2 flex flex-col gap-1 text-sm">
          {slices.length === 0 ? (
            <li className="text-ink/70 dark:text-paper/70">GitHub returned no breakdown.</li>
          ) : (
            slices.map((slice, index) => (
              <li key={slice.label} className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={`size-2.5 rounded-full ${sliceStyles[index % sliceStyles.length]?.dot}`}
                />
                <span>{slice.label}</span>
                <span className="ml-auto tabular-nums">{slice.count}</span>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

export function ContributionTrend({ months }: { months: MonthTotal[] }) {
  const width = 640;
  const height = 200;
  const padLeft = 36;
  const padRight = 12;
  const padTop = 16;
  const padBottom = 28;
  const max = Math.max(1, ...months.map((month) => month.count));
  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;
  const step = months.length > 1 ? plotWidth / (months.length - 1) : 0;

  const points = months.map((month, index) => {
    const x = padLeft + index * step;
    const y = padTop + plotHeight - (month.count / max) * plotHeight;
    return { ...month, x, y };
  });
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const baseline = padTop + plotHeight;
  const first = points[0];
  const last = points[points.length - 1];
  const area =
    first && last
      ? `M ${first.x} ${baseline} ${points.map((point) => `L ${point.x} ${point.y}`).join(" ")} L ${last.x} ${baseline} Z`
      : "";

  const yTicks = [max, Math.round(max / 2), 0];

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="min-w-[36rem] w-full"
        role="img"
        aria-label={
          months.length === 0
            ? "No monthly contribution totals"
            : months.map((month) => `${shortMonthLabel(month.month)} ${month.count}`).join(", ")
        }
      >
        {yTicks.map((tick) => {
          const y = padTop + plotHeight - (tick / max) * plotHeight;
          return (
            <g key={tick}>
              <line
                x1={padLeft}
                x2={width - padRight}
                y1={y}
                y2={y}
                className="stroke-ink/10 dark:stroke-paper/15"
              />
              <text x={0} y={y + 4} className="fill-ink/80 text-[11px] dark:fill-paper/80">
                {tick}
              </text>
            </g>
          );
        })}
        {points.length > 0 ? (
          <>
            <path d={area} className="fill-moss-500/25" />
            <polyline
              points={line}
              fill="none"
              strokeWidth="2"
              className="stroke-moss-700 dark:stroke-moss-300"
            />
          </>
        ) : null}
        {points.map((point) => (
          <g key={point.month}>
            <circle cx={point.x} cy={point.y} r="3" className="fill-moss-700 dark:fill-moss-300" />
            <text
              x={point.x}
              y={height - 8}
              textAnchor="middle"
              className="fill-ink/80 text-[11px] dark:fill-paper/80"
            >
              {shortMonthLabel(point.month)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
