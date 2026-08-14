import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { GarmentImage } from "@/components/GarmentImage";
import { setStatus } from "@/lib/actions";
import { daysSince, type Item, type Status } from "@/lib/wardrobe";
import { useItems, useRefreshWardrobe } from "@/hooks/useWardrobe";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/decide")({
  head: () => ({
    meta: [
      { title: "Decide — Wardrobe" },
      { name: "description", content: "Pieces you haven't worn in 45 days: sell, store seasonally, or save for occasions." },
      { property: "og:title", content: "Decide — Wardrobe" },
      { property: "og:description", content: "Make a call on the pieces you never reach for." },
    ],
  }),
  component: DecidePage,
});

const CHOICES: { status: Status; label: string; note: string }[] = [
  { status: "sell", label: "Sell", note: "Ditch it" },
  { status: "seasonal", label: "Seasonal", note: "Keep, hide from matches" },
  { status: "special", label: "Special", note: "Occasions only" },
];

function DecidePage() {
  const items = useItems();
  const refresh = useRefreshWardrobe();

  const all = items.data ?? [];
  const stale = all.filter((i) => {
    if (i.status !== "active") return false;
    const since = daysSince(i.last_worn_at);
    const age = daysSince(i.created_at.slice(0, 10)) ?? 0;
    return since === null ? age >= 45 : since >= 45;
  });
  const stored = all.filter((i) => i.status === "seasonal" || i.status === "special");

  return (
    <AppShell
      title="Decide"
      subtitle="Anything you haven't worn in 45 days lands here. Sell it, store it for the season, or save it for occasions."
    >
      {stale.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing to decide on right now — everything is in regular rotation.
        </p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {stale.map((item) => (
            <DecideCard key={item.id} item={item} onDone={refresh} />
          ))}
        </div>
      )}

      {stored.length > 0 && (
        <section className="mt-16">
          <h2 className="font-display text-2xl">Stored away</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Seasonal pieces never appear in matches until you add them back. Special pieces only appear
            when you ask for occasion looks on the Today page.
          </p>
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {stored.map((item) => (
              <div key={item.id} className="flex gap-4 border border-border bg-card p-3">
                <GarmentImage item={item} className="h-28 w-20 shrink-0" />
                <div className="flex flex-col">
                  <p className="font-display text-lg leading-tight">{item.name}</p>
                  <p className="eyebrow mt-1">
                    {item.status === "seasonal" ? "Seasonal" : "Special occasion"}
                  </p>
                  <button
                    onClick={async () => {
                      await setStatus([item.id], "active");
                      refresh();
                      toast.success(`${item.name} is back in rotation`);
                    }}
                    className="mt-auto text-left text-[11px] uppercase tracking-[0.18em] underline underline-offset-4"
                  >
                    Add back to rotation
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </AppShell>
  );
}

function DecideCard({ item, onDone }: { item: Item; onDone: () => void }) {
  const since = daysSince(item.last_worn_at);
  return (
    <div className="border border-border bg-card">
      <GarmentImage item={item} className="aspect-[4/3]" />
      <div className="p-4">
        <p className="font-display text-xl leading-tight">{item.name}</p>
        <p className="eyebrow mt-1">
          {since === null ? "Never worn" : `Last worn ${since} days ago`}
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {CHOICES.map((c) => (
            <button
              key={c.status}
              onClick={async () => {
                await setStatus([item.id], c.status);
                onDone();
                toast.success(`${item.name} → ${c.label}`);
              }}
              className={cn(
                "border border-border px-2 py-2 text-[10px] uppercase tracking-[0.14em] transition-colors hover:bg-secondary",
              )}
              title={c.note}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
