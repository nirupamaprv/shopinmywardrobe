import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { GarmentImage } from "@/components/GarmentImage";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { deleteWear, logWear, updateWear } from "@/lib/actions";
import { distinctWears, today, type Item, type Wear } from "@/lib/wardrobe";
import { useItems, useRefreshWardrobe, useWears } from "@/hooks/useWardrobe";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [
      { title: "Calendar View — Wardrobe" },
      { name: "description", content: "A month-by-month record of the outfits you actually wore." },
      { property: "og:title", content: "Calendar View — Wardrobe" },
      { property: "og:description", content: "See and edit every combination you logged, day by day." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CalendarPage,
});

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function iso(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function CalendarPage() {
  const items = useItems();
  const wears = useWears();
  const refresh = useRefreshWardrobe();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selected, setSelected] = useState<string | null>(null);

  const byId = useMemo(() => new Map((items.data ?? []).map((i) => [i.id, i])), [items.data]);

  const byDay = useMemo(() => {
    const map = new Map<string, Wear[]>();
    for (const w of distinctWears(wears.data ?? [])) {
      const list = map.get(w.worn_on) ?? [];
      list.push(w);
      map.set(w.worn_on, list);
    }
    return map;
  }, [wears.data]);

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function shift(delta: number) {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  return (
    <AppShell
      title="Calendar View"
      subtitle="Every combination you logged, day by day. Tap a date to add, change or remove what you wore."
      action={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="rounded-none" onClick={() => shift(-1)} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[10rem] text-center font-display text-xl">
            {MONTHS[month]} {year}
          </span>
          <Button variant="outline" size="icon" className="rounded-none" onClick={() => shift(1)} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-7 border-l border-t border-border">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i} className="eyebrow border-b border-r border-border px-2 py-2 text-center">
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          const date = day ? iso(year, month, day) : null;
          const list = date ? (byDay.get(date) ?? []) : [];
          return (
            <button
              key={i}
              disabled={!day}
              onClick={() => date && setSelected(date)}
              className={`min-h-[6rem] border-b border-r border-border p-2 text-left align-top transition-colors ${
                day ? "hover:bg-secondary" : "bg-muted/30"
              } ${date === today() ? "bg-secondary" : ""}`}
            >
              {day && <span className="text-xs text-muted-foreground">{day}</span>}
              <div className="mt-1 space-y-1">
                {list.slice(0, 2).map((w) => (
                  <p key={w.id} className="truncate text-[11px] leading-tight">
                    {byId.get(w.top_id ?? "")?.name ?? "—"} + {byId.get(w.bottom_id ?? "")?.name ?? "—"}
                  </p>
                ))}
                {list.length > 2 && (
                  <p className="text-[11px] text-muted-foreground">+{list.length - 2} more</p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <DayDialog
        date={selected}
        onClose={() => setSelected(null)}
        items={items.data ?? []}
        wears={selected ? (byDay.get(selected) ?? []) : []}
        refresh={refresh}
      />
    </AppShell>
  );
}

/** Entries whose stored day differs from the local day they were logged on. */
function misdatedWears(wears: Wear[]) {
  return wears
    .filter((w) => w.created_at)
    .map((w) => ({ wear: w, correctDay: localISODate(new Date(w.created_at!)) }))
    .filter((e) => e.correctDay !== e.wear.worn_on)
    .sort((a, b) => (a.correctDay < b.correctDay ? 1 : -1));
}

function LegacyShiftDialog({
  open,
  onClose,
  items,
  wears,
  refresh,
}: {
  open: boolean;
  onClose: () => void;
  items: Item[];
  wears: Wear[];
  refresh: () => void;
}) {
  const candidates = useMemo(() => misdatedWears(wears), [wears]);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const chosen = candidates.filter((c) => !excluded.has(c.wear.id));

  function toggle(id: string) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function label(date: string) {
    return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-none">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-light">Legacy date shift</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Outfits logged in the evening were once filed under the next calendar day. These entries
          can be moved back to the day you actually logged them. Untick anything you want left as
          it is.
        </p>

        {candidates.length === 0 ? (
          <p className="mt-4 text-sm">Nothing to fix — every entry sits on the right day.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {candidates.map(({ wear, correctDay }) => (
              <label
                key={wear.id}
                className="flex cursor-pointer items-start gap-3 border border-border p-3"
              >
                <Checkbox
                  checked={!excluded.has(wear.id)}
                  onCheckedChange={() => toggle(wear.id)}
                  className="mt-0.5 rounded-none"
                />
                <span className="text-sm">
                  <span className="block">
                    {byId.get(wear.top_id ?? "")?.name ?? "—"} +{" "}
                    {byId.get(wear.bottom_id ?? "")?.name ?? "—"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {label(wear.worn_on)} → {label(correctDay)}
                  </span>
                </span>
              </label>
            ))}

            <Button
              className="w-full rounded-none text-xs uppercase tracking-[0.18em]"
              disabled={!chosen.length || busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const res = await shiftWearDates(
                    chosen.map((c) => ({ id: c.wear.id, correctDay: c.correctDay })),
                    wears,
                  );
                  refresh();
                  setExcluded(new Set());
                  toast.success(
                    res.merged
                      ? `Moved ${res.moved}; ${res.merged} merged into existing entries`
                      : `Moved ${res.moved} ${res.moved === 1 ? "entry" : "entries"}`,
                  );
                  onClose();
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Shifting…" : `Shift ${chosen.length} selected`}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DayDialog({
  date,
  onClose,
  items,
  wears,
  refresh,
}: {
  date: string | null;
  onClose: () => void;
  items: Item[];
  wears: Wear[];
  refresh: () => void;
}) {
  const [newTop, setNewTop] = useState("");
  const [newBottom, setNewBottom] = useState("");
  const tops = items.filter((i) => i.category === "top");
  const bottoms = items.filter((i) => i.category === "bottom");

  return (
    <Dialog open={!!date} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-none">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-light">
            {date && new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {wears.length === 0 && (
            <p className="text-sm text-muted-foreground">Nothing logged for this day yet.</p>
          )}

          {wears.map((w) => {
            const top = items.find((i) => i.id === w.top_id);
            const bottom = items.find((i) => i.id === w.bottom_id);
            return (
              <div key={w.id} className="border border-border p-3">
                <div className="flex gap-3">
                  {top && <GarmentImage item={top} className="h-20 w-16" />}
                  {bottom && <GarmentImage item={bottom} className="h-20 w-16" />}
                  <div className="flex-1 space-y-2">
                    <select
                      value={w.top_id ?? ""}
                      onChange={async (e) => {
                        await updateWear(w.id, { top_id: e.target.value });
                        refresh();
                        toast.success("Updated");
                      }}
                      className="w-full border border-border bg-card px-2 py-1.5 text-sm"
                    >
                      <option value="">Select top…</option>
                      {tops.map((i) => (
                        <option key={i.id} value={i.id}>{i.name}</option>
                      ))}
                    </select>
                    <select
                      value={w.bottom_id ?? ""}
                      onChange={async (e) => {
                        await updateWear(w.id, { bottom_id: e.target.value });
                        refresh();
                        toast.success("Updated");
                      }}
                      className="w-full border border-border bg-card px-2 py-1.5 text-sm"
                    >
                      <option value="">Select bottom…</option>
                      {bottoms.map((i) => (
                        <option key={i.id} value={i.id}>{i.name}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    aria-label="Remove this entry"
                    className="self-start border border-border p-2 hover:bg-secondary"
                    onClick={async () => {
                      if (!window.confirm("Remove this logged outfit? Wear counts will change.")) return;
                      await deleteWear(w.id);
                      refresh();
                      toast.success("Removed");
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}

          <div className="border border-dashed border-border p-3">
            <Label className="eyebrow">Add an outfit for this day</Label>
            <div className="mt-2 space-y-2">
              <select
                value={newTop}
                onChange={(e) => setNewTop(e.target.value)}
                className="w-full border border-border bg-card px-2 py-1.5 text-sm"
              >
                <option value="">Select top…</option>
                {tops.map((i) => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
              <select
                value={newBottom}
                onChange={(e) => setNewBottom(e.target.value)}
                className="w-full border border-border bg-card px-2 py-1.5 text-sm"
              >
                <option value="">Select bottom…</option>
                {bottoms.map((i) => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
              <Button
                className="w-full rounded-none text-xs uppercase tracking-[0.18em]"
                disabled={!newTop || !newBottom || !date}
                onClick={async () => {
                  const res = await logWear(newTop, newBottom, date!);
                  refresh();
                  setNewTop("");
                  setNewBottom("");
                  toast.success(res.duplicate ? "Already logged — counted once" : "Logged");
                }}
              >
                Add
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}