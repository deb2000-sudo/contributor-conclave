const cells = [
  0, 1, 2, 1, 0, 3, 2, 1, 0, 2, 3, 1, 0, 1, 2, 0,
  1, 0, 3, 2, 1, 0, 2, 3, 1, 0, 1, 2, 3, 0, 1, 2,
  0, 2, 1, 0, 3, 1, 0, 2, 1, 3, 0, 2, 1, 0, 3, 2,
  2, 1, 0, 3, 1, 2, 0, 1, 3, 2, 0, 1, 2, 3, 1, 0,
  1, 3, 2, 0, 1, 0, 3, 2, 1, 0, 2, 1, 0, 2, 3, 1,
  0, 1, 0, 2, 3, 1, 2, 0, 1, 3, 0, 2, 1, 0, 1, 2,
  3, 0, 1, 2, 0, 1, 3, 2, 0, 1, 2, 0, 3, 1, 2, 0,
];

const levelClass = [
  "bg-ink/10 dark:bg-paper/10",
  "bg-moss-500",
  "bg-moss-700",
  "bg-moss-900",
];

export function ContributionGrid() {
  return (
    <div
      aria-hidden="true"
      className="grid w-full max-w-md grid-cols-[repeat(16,minmax(0,1fr))] gap-1"
    >
      {cells.map((level, index) => (
        <span key={index} className={`aspect-square rounded-[3px] ${levelClass[level]}`} />
      ))}
    </div>
  );
}
