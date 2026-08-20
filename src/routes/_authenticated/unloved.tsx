import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { GarmentImage } from "@/components/GarmentImage";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { setStatus } from "@/lib/actions";
import { itemStats, isUnloved, today } from "@/lib/wardrobe";
import { useFeedback, useItems, useRefreshWardrobe } from "@/hooks/useWardrobe";

export const Route = createFileRoute("/_authenticated/unloved")({
  head: () => ({
    meta: [
      { title: "Unloved — Wardrobe" },
      { name: "description", content: "Pieces you keep passing on, gathered for a monthly clear-out review." },
      { property: "og:title", content: "Unloved — Wardrobe" },
      { property: "og:description", content: "Review the pieces you never say yes to." },
    ],
  }),
  component: UnlovedPage,
});

function UnlovedPage() {
  const items = useItems();
  const feedback = useFeedback();
  const refresh = useRefreshWardrobe();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reviewedThisMonth, setReviewedThisMonth] = useState<boolean | null>(null);

  const unloved = useMemo(() => {
    if (!items.data || !feedback.data) return [];
    return items.data.filter(
      (i) => i.status !== "sell" && isUnloved(i.id, feedback.data!),
    );
  }, [items.data, feedback.data]);

  useEffect(() => {
    setSelected(new Set(unloved.map((i) => i.id)));
  }, [unloved.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const month = today().slice(0, 7);
    supabase
      .from("unloved_reviews")
      .select("reviewed_on")
      .gte("reviewed_on", `${month}-01`)
      .limit(1)
      .then(({ data }) => setReviewedThisMonth((data ?? []).length > 0));
  }, []);

  const dueForReview = reviewedThisMonth === false && unloved.length > 0;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function recordReview() {
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      await supabase.from("unloved_reviews").insert({ user_id: userData.user.id });
    }
    setReviewedThisMonth(true);
  }

  return (
    <AppShell
      title="Unloved"
      subtitle="Disliked on seven or more separate days, never liked once. Time to be honest about these."
    >
      {dueForReview && (
        <div className="mb-8 border border-foreground/30 bg-secondary/60 p-5">
          <p className="eyebrow">Monthly review</p>
          <h2 className="mt-2 font-display text-2xl">Move these straight to Sell?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything is ticked by default. Untick anything you'd like to keep.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              className="rounded-none text-xs uppercase tracking-[0.18em]"
              disabled={selected.size === 0}
              onClick={async () => {
                await setStatus([...selected], "sell");
                await recordReview();
                refresh();
                toast.success(`${selected.size} piece(s) moved to Sell`);
              }}
            >
              Move {selected.size} to Sell
            </Button>
            <Button
              variant="outline"
              className="rounded-none text-xs uppercase tracking-[0.18em]"
              onClick={async () => {
                await recordReview();
                toast("Ask me again next month");
              }}
            >
              Not now
            </Button>
          </div>
        </div>
      )}

      {unloved.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing unloved — you've liked or worn everything at least once.
        </p>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {unloved.map((item) => {
            const stats = itemStats(item.id, feedback.data ?? []);
            return (
              <li key={item.id} className="flex items-center gap-4 py-4">
                <Checkbox
                  checked={selected.has(item.id)}
                  onCheckedChange={() => toggle(item.id)}
                  className="rounded-none"
                  aria-label={`Select ${item.name}`}
                />
                <GarmentImage item={item} className="h-20 w-16 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg leading-tight">{item.name}</p>
                  <p className="eyebrow mt-1">
                    {item.color} · passed on {stats.dislikeDays} days
                  </p>
                </div>
                <button
                  onClick={async () => {
                    await setStatus([item.id], "active");
                    refresh();
                    toast.success("Back in rotation");
                  }}
                  className="text-[11px] uppercase tracking-[0.16em] underline underline-offset-4"
                >
                  Keep
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
