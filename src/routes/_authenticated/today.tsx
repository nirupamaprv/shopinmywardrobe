import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { OutfitCard } from "@/components/OutfitCard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { logWear, pairWornOn, rateOutfit, saveSuggestions } from "@/lib/actions";
import { generateMatches, today, type Item } from "@/lib/wardrobe";
import { useFeedback, useItems, useOutfits, useRefreshWardrobe, useWears } from "@/hooks/useWardrobe";

export const Route = createFileRoute("/_authenticated/today")({
  head: () => ({
    meta: [
      { title: "Today's edit — Wardrobe" },
      { name: "description", content: "Your daily outfit pairings, styled from your own closet." },
      { property: "og:title", content: "Today's edit — Wardrobe" },
      { property: "og:description", content: "Five fresh pairings a day from pieces you own." },
    ],
  }),
  component: TodayPage,
});

function TodayPage() {
  const items = useItems();
  const wears = useWears();
  const feedback = useFeedback();
  const outfits = useOutfits();
  const refresh = useRefreshWardrobe();
  const [special, setSpecial] = useState(false);
  const date = today();

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  async function saveWear(topId: string, bottomId: string, day: string) {
    const all = wears.data ?? [];
    const prev = new Date(new Date(day).getTime() - 86400000).toISOString().slice(0, 10);
    if (pairWornOn(all, topId, bottomId, day)) {
      toast.info("Already logged today — counted once");
      return;
    }
    if (pairWornOn(all, topId, bottomId, prev)) {
      const ok = window.confirm("You wore this same pairing the day before. Log it again?");
      if (!ok) return;
    }
    const res = await logWear(topId, bottomId, day);
    refresh();
    toast.success(res.duplicate ? "Already logged today — counted once" : "Logged — nice choice");
  }

  const recordWear = (topId: string, bottomId: string) => saveWear(topId, bottomId, date);

  const ready = items.data && wears.data && feedback.data && outfits.data;

  const todays = useMemo(
    () => (outfits.data ?? []).filter((o) => o.suggested_on === date),
    [outfits.data, date],
  );

  // Generate and persist today's edit once
  useEffect(() => {
    if (!ready || special) return;
    if (todays.length > 0) return;
    const matches = generateMatches({
      items: items.data!,
      wears: wears.data!,
      feedback: feedback.data!,
      pastOutfits: outfits.data!,
      date,
    });
    if (!matches.length) return;
    saveSuggestions(matches, date).then(refresh);
  }, [ready, todays.length, special]); // eslint-disable-line react-hooks/exhaustive-deps

  const specialMatches = useMemo(() => {
    if (!ready || !special) return [];
    return generateMatches({
      items: items.data!,
      wears: wears.data!,
      feedback: feedback.data!,
      pastOutfits: outfits.data!,
      date,
      includeSpecial: true,
      count: 4,
    }).filter((m) => m.top.status === "special" || m.bottom.status === "special");
  }, [ready, special, items.data, wears.data, feedback.data, outfits.data, date]);

  const byId = useMemo(
    () => new Map((items.data ?? []).map((i) => [i.id, i])),
    [items.data],
  );
  const wornToday = useMemo(
    () => new Set((wears.data ?? []).filter((w) => w.worn_on === date).map((w) => `${w.top_id}|${w.bottom_id}`)),
    [wears.data, date],
  );

  async function reshuffle() {
    await supabase.from("outfits").delete().eq("suggested_on", date).is("rating", null);
    refresh();
    toast.success("New edit coming up");
  }

  const hasCloset =
    (items.data ?? []).some((i) => i.category === "top" && i.status === "active") &&
    (items.data ?? []).some((i) => i.category === "bottom" && i.status === "active");

  return (
    <AppShell
      title="Today's edit"
      subtitle="Fresh pairings that skip the colors you wore in the last three days, and skip anything stored as seasonal or saved for occasions."
      action={
        <div className="flex items-center gap-3">
          <LogWearDialog items={items.data ?? []} onSave={saveWear} />
          <Button variant="outline" className="rounded-none text-xs uppercase tracking-[0.18em]" onClick={reshuffle}>
            Reshuffle
          </Button>
        </div>
      }
    >
      <div className="mb-6 flex items-center gap-3 border-y border-border py-3">
        <Switch id="special" checked={special} onCheckedChange={setSpecial} />
        <Label htmlFor="special" className="eyebrow cursor-pointer">
          Show occasion (special) pieces
        </Label>
      </div>

      {!hasCloset ? (
        <EmptyCloset />
      ) : special ? (
        <Grid>
          {specialMatches.length === 0 && (
            <p className="text-sm text-muted-foreground">No occasion pieces in your closet yet.</p>
          )}
          {specialMatches.map((m) => (
            <OutfitCard
              key={m.top.id + m.bottom.id}
              top={m.top}
              bottom={m.bottom}
              onWore={async () => {
                await recordWear(m.top.id, m.bottom.id);
              }}
              worn={wornToday.has(`${m.top.id}|${m.bottom.id}`)}
            />
          ))}
        </Grid>
      ) : (
        <Grid>
          {todays.map((o) => {
            const top = byId.get(o.top_id);
            const bottom = byId.get(o.bottom_id);
            if (!top || !bottom) return null;
            return (
              <OutfitCard
                key={o.id}
                top={top}
                bottom={bottom}
                rating={o.rating}
                worn={wornToday.has(`${top.id}|${bottom.id}`)}
                onLike={async () => {
                  await rateOutfit(o.id, top.id, bottom.id, 1);
                  refresh();
                }}
                onDislike={async () => {
                  await rateOutfit(o.id, top.id, bottom.id, -1);
                  refresh();
                }}
                onWore={async () => {
                  await recordWear(top.id, bottom.id);
                }}
              />
            );
          })}
          {todays.length === 0 && (
            <p className="text-sm text-muted-foreground">Putting together today's edit…</p>
          )}
        </Grid>
      )}
    </AppShell>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

function EmptyCloset() {
  return (
    <div className="border border-dashed border-border p-10 text-center">
      <h2 className="font-display text-2xl">Your closet is still empty</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
        Add at least one top and one bottom and your daily edit starts tomorrow morning — or right now.
      </p>
      <Link
        to="/closet"
        className="mt-6 inline-flex bg-primary px-6 py-3 text-xs uppercase tracking-[0.2em] text-primary-foreground"
      >
        Add pieces
      </Link>
    </div>
  );
}

function LogWearDialog({
  items,
  onSave,
}: {
  items: Item[];
  onSave: (topId: string, bottomId: string, day: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [topId, setTopId] = useState("");
  const [bottomId, setBottomId] = useState("");
  const [date, setDate] = useState(today());

  const tops = items.filter((i) => i.category === "top" && i.status !== "sell");
  const bottoms = items.filter((i) => i.category === "bottom" && i.status !== "sell");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-none text-xs uppercase tracking-[0.18em]">Log what I wore</Button>
      </DialogTrigger>
      <DialogContent className="rounded-none">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-light">Log what you wore</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="eyebrow">Top</Label>
            <select
              value={topId}
              onChange={(e) => setTopId(e.target.value)}
              className="mt-2 w-full border border-border bg-card px-3 py-2 text-sm"
            >
              <option value="">Select…</option>
              {tops.map((i) => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Label className="eyebrow">Bottom</Label>
            <select
              value={bottomId}
              onChange={(e) => setBottomId(e.target.value)}
              className="mt-2 w-full border border-border bg-card px-3 py-2 text-sm"
            >
              <option value="">Select…</option>
              {bottoms.map((i) => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Label className="eyebrow">Date</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-2 rounded-none"
            />
          </div>
          <Button
            className="w-full rounded-none text-xs uppercase tracking-[0.18em]"
            disabled={!topId || !bottomId}
            onClick={async () => {
              await onSave(topId, bottomId, date);
              setOpen(false);
            }}
          >
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
