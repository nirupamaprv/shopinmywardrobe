import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { StreakBar } from "@/components/StreakBar";
import { GarmentImage } from "@/components/GarmentImage";
import { colorHex, daysSince, distinctWears, itemStats, wearCount, wearCountWithin } from "@/lib/wardrobe";
import { useFeedback, useItems, useOutfits, useWears } from "@/hooks/useWardrobe";

export const Route = createFileRoute("/_authenticated/insights")({
  head: () => ({
    meta: [
      { title: "Insights — Wardrobe" },
      { name: "description", content: "What you actually wear, what sits idle, and what to buy next." },
      { property: "og:title", content: "Insights — Wardrobe" },
      { property: "og:description", content: "Your real style, measured from what you wear." },
    ],
  }),
  component: InsightsPage,
});

function InsightsPage() {
  const items = useItems();
  const wears = useWears();
  const feedback = useFeedback();
  const outfits = useOutfits();

  const data = useMemo(() => {
    const all = items.data ?? [];
    const w = distinctWears(wears.data ?? []);
    const f = feedback.data ?? [];
    const o = outfits.data ?? [];

    const ranked = all
      .map((i) => ({
        item: i,
        wears: wearCount(i.id, w),
        week: wearCountWithin(i.id, w, 7),
        month: wearCountWithin(i.id, w, 30),
        year: wearCountWithin(i.id, w, 365),
        ...itemStats(i.id, f),
      }))
      .sort((a, b) => b.wears - a.wears || b.likes - a.likes);

    const colorWears = new Map<string, number>();
    for (const row of ranked) {
      if (row.wears) colorWears.set(row.item.color, (colorWears.get(row.item.color) ?? 0) + row.wears);
    }
    const topColors = [...colorWears.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

    const combos = new Map<string, number>();
    const comboDays = new Set<string>();
    for (const wear of w) {
      const t = all.find((i) => i.id === wear.top_id);
      const b = all.find((i) => i.id === wear.bottom_id);
      if (t && b) {
        const dayKey = `${wear.worn_on}|${t.id}|${b.id}`;
        if (comboDays.has(dayKey)) continue;
        comboDays.add(dayKey);
        const key = `${t.color} + ${b.color}`;
        combos.set(key, (combos.get(key) ?? 0) + 1);
      }
    }
    const topCombos = [...combos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

    const idle = ranked.filter((r) => r.wears === 0 && r.item.status !== "sell");
    const likedLooks = o.filter((x) => x.rating === 1).length;

    const wornDays = new Set(w.map((x) => x.worn_on)).size;
    return { ranked, topColors, topCombos, idle, likedLooks, total: all.length, worn: wornDays };
  }, [items.data, wears.data, feedback.data, outfits.data]);

  return (
    <AppShell
      title="Insights"
      subtitle="Your real style, measured from what you actually put on — so your next shopping trip buys more of it."
    >
      <div className="mb-8">
        <StreakBar wears={wears.data ?? []} />
      </div>

      <div className="grid gap-5 sm:grid-cols-4">
        {[
          ["Pieces", data.total],
          ["Days logged", data.worn],
          ["Looks liked", data.likedLooks],
          ["Never worn", data.idle.length],
        ].map(([label, value]) => (
          <div key={label as string} className="border border-border bg-card p-5">
            <p className="eyebrow">{label}</p>
            <p className="mt-2 font-display text-4xl">{value as number}</p>
          </div>
        ))}
      </div>

      <section className="mt-14">
        <h2 className="font-display text-2xl">Most worn</h2>
        <div className="mt-4 grid grid-cols-2 gap-5 sm:grid-cols-4">
          {data.ranked.filter((r) => r.wears > 0).slice(0, 8).map((r) => (
            <div key={r.item.id} className="border border-border bg-card">
              <GarmentImage item={r.item} className="aspect-[3/4]" />
              <div className="p-3">
                <p className="font-display text-base leading-tight">{r.item.name}</p>
                <p className="eyebrow mt-1">worn {r.wears} day{r.wears === 1 ? "" : "s"}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {r.week} this week · {r.month} this month · {r.year} this year
                </p>
              </div>
            </div>
          ))}
          {data.ranked.every((r) => r.wears === 0) && (
            <p className="text-sm text-muted-foreground">Log a few outfits and this fills in.</p>
          )}
        </div>
      </section>

      <section className="mt-14 grid gap-10 sm:grid-cols-2">
        <div>
          <h2 className="font-display text-2xl">Colours you live in</h2>
          <ul className="mt-4 space-y-3">
            {data.topColors.map(([color, count]) => (
              <li key={color} className="flex items-center gap-3">
                <span className="h-5 w-5 border border-border" style={{ backgroundColor: colorHex(color) }} />
                <span className="text-sm capitalize">{color}</span>
                <span className="ml-auto eyebrow">{count}×</span>
              </li>
            ))}
            {data.topColors.length === 0 && (
              <li className="text-sm text-muted-foreground">No wear history yet.</li>
            )}
          </ul>
        </div>
        <div>
          <h2 className="font-display text-2xl">Pairings you repeat</h2>
          <ul className="mt-4 space-y-3">
            {data.topCombos.map(([combo, count]) => (
              <li key={combo} className="flex items-center gap-3 text-sm capitalize">
                {combo}
                <span className="ml-auto eyebrow">{count}×</span>
              </li>
            ))}
            {data.topCombos.length === 0 && (
              <li className="text-sm text-muted-foreground">No pairings logged yet.</li>
            )}
          </ul>
        </div>
      </section>

      <section className="mt-14">
        <h2 className="font-display text-2xl">Sitting idle</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Own it, never wear it. Before you buy anything similar, look here first.
        </p>
        <ul className="mt-4 divide-y divide-border border-y border-border">
          {data.idle.slice(0, 12).map((r) => (
            <li key={r.item.id} className="flex items-center gap-4 py-3">
              <span className="h-4 w-4 border border-border" style={{ backgroundColor: colorHex(r.item.color) }} />
              <span className="text-sm">{r.item.name}</span>
              <span className="ml-auto eyebrow">
                {r.item.category === "top" ? "Top" : "Bottom"} · added {daysSince(r.item.created_at.slice(0, 10))}d ago
              </span>
            </li>
          ))}
          {data.idle.length === 0 && (
            <li className="py-3 text-sm text-muted-foreground">Everything has been worn at least once.</li>
          )}
        </ul>
      </section>
    </AppShell>
  );
}
