import { computeStreak, milestoneLabel, streakMilestones } from "@/lib/wardrobe";
import type { Wear } from "@/lib/wardrobe";

export function StreakBar({ wears, compact = false }: { wears: Wear[]; compact?: boolean }) {
  const s = computeStreak(wears);
  const ladder = streakMilestones(s.current).slice(0, 8);

  const headline =
    s.current === 0
      ? "Log what you wore to start a streak"
      : `${s.current} day${s.current === 1 ? "" : "s"} in a row`;

  return (
    <section className="border border-border bg-card p-5">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p className="eyebrow">Streak</p>
        <p className="font-display text-2xl leading-none">{headline}</p>
        {s.longest > 0 && (
          <p className="ml-auto eyebrow">
            best {s.longest} · {s.totalDays} days logged
          </p>
        )}
      </div>

      {s.atRisk && (
        <p className="mt-2 text-sm text-muted-foreground">
          Nothing logged today yet — add an outfit before midnight to keep it alive.
        </p>
      )}
      {s.next !== null && (
        <p className="mt-2 text-sm text-muted-foreground">
          {s.next - s.current} more day{s.next - s.current === 1 ? "" : "s"} to reach{" "}
          <span className="text-foreground">{milestoneLabel(s.next)}</span>.
        </p>
      )}

      {!compact && (
        <ul className="mt-4 flex flex-wrap gap-2">
          {ladder.map((m) => {
            const done = s.earned.includes(m);
            return (
              <li
                key={m}
                className={`border px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] ${
                  done
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground"
                }`}
              >
                {milestoneLabel(m)}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
