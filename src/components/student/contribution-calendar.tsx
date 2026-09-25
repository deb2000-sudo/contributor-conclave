import type { GitHubContributionCalendar } from "@/lib/github";

const levelClass = [
  "border border-ink/70 dark:border-paper/50",
  "bg-moss-500",
  "bg-moss-700 dark:bg-moss-300",
  "bg-moss-900 dark:bg-moss-100",
  "bg-ink dark:bg-paper",
];

function level(count: number, max: number): number {
  if (count <= 0 || max <= 0) {
    return 0;
  }
  const ratio = count / max;
  if (ratio <= 0.25) {
    return 1;
  }
  if (ratio <= 0.5) {
    return 2;
  }
  if (ratio <= 0.75) {
    return 3;
  }
  return 4;
}

export function ContributionCalendar({ calendar }: { calendar: GitHubContributionCalendar }) {
  const max = calendar.days.reduce((highest, day) => Math.max(highest, day.count), 0);
  const totalLabel = `${calendar.total} ${calendar.total === 1 ? "contribution" : "contributions"} in the last year`;

  return (
    <figure className="flex flex-col gap-4">
      <figcaption className="flex flex-wrap items-end justify-between gap-3 text-sm text-ink/80 dark:text-paper/80">
        <span>{totalLabel}. Each square is one day. Darker green means more contributions that day.</span>
        <span className="inline-flex items-center gap-1 text-xs">
          Less
          {levelClass.map((color) => (
            <span key={color} aria-hidden="true" className={`size-3 rounded-[2px] ${color}`} />
          ))}
          More
        </span>
      </figcaption>
      <div className="overflow-x-auto">
        <div className="flex gap-2">
          <div aria-hidden="true" className="grid grid-rows-7 gap-[3px] text-[10px] leading-3 text-ink/70 dark:text-paper/70">
            <span />
            <span>Mon</span>
            <span />
            <span>Wed</span>
            <span />
            <span>Fri</span>
            <span />
          </div>
          <div aria-hidden="true" className="grid w-max grid-flow-col grid-rows-7 gap-[3px]">
            {calendar.days.map((day) => (
              <span
                key={day.date}
                title={`${day.date}: ${day.count}`}
                className={`size-3 rounded-[2px] ${levelClass[level(day.count, max)]}`}
              />
            ))}
          </div>
        </div>
      </div>
      <table className="sr-only">
        <caption>Daily contributions</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Contributions</th>
          </tr>
        </thead>
        <tbody>
          {calendar.days.map((day) => (
            <tr key={day.date}>
              <th scope="row">
                <time dateTime={day.date}>{day.date}</time>
              </th>
              <td>{day.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
