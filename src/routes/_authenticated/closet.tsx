import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Image as ImageIcon, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { GarmentImage } from "@/components/GarmentImage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { setStatus } from "@/lib/actions";
import { COLORS, PATTERNS, daysSince, type Category, type Item, type Status } from "@/lib/wardrobe";
import { useItems, useRefreshWardrobe } from "@/hooks/useWardrobe";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/closet")({
  head: () => ({
    meta: [
      { title: "My closet — Wardrobe" },
      { name: "description", content: "Every top and bottom you own, photographed and tagged." },
      { property: "og:title", content: "My closet — Wardrobe" },
      { property: "og:description", content: "Photograph your tops and bottoms and keep them organised." },
    ],
  }),
  component: ClosetPage,
});

const STATUS_LABEL: Record<Status, string> = {
  active: "In rotation",
  seasonal: "Seasonal (stored)",
  special: "Special occasion",
  sell: "Sell",
  unloved: "Unloved",
};

function ClosetPage() {
  const items = useItems();
  const refresh = useRefreshWardrobe();
  const [tab, setTab] = useState<Category>("top");

  const list = (items.data ?? []).filter((i) => i.category === tab && i.status !== "sell");
  const selling = (items.data ?? []).filter((i) => i.status === "sell");

  return (
    <AppShell
      title="My closet"
      subtitle="Two sets: tops and bottoms. Photograph each piece once and it joins the daily rotation."
      action={<AddItemDialog category={tab} onDone={refresh} />}
    >
      <div className="mb-8 flex gap-6 border-b border-border">
        {(["top", "bottom"] as Category[]).map((c) => (
          <button
            key={c}
            onClick={() => setTab(c)}
            className={cn(
              "eyebrow pb-3",
              tab === c && "border-b border-foreground text-foreground",
            )}
          >
            {c === "top" ? "Tops & shirts" : "Pants, jeans & skirts"}
          </button>
        ))}
      </div>

      {list.length === 0 && (
        <p className="text-sm text-muted-foreground">Nothing here yet — add your first piece.</p>
      )}

      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
        {list.map((item) => (
          <ItemCard key={item.id} item={item} onDone={refresh} />
        ))}
      </div>

      {selling.length > 0 && (
        <section className="mt-16">
          <h2 className="font-display text-2xl">Marked to sell</h2>
          <div className="mt-4 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {selling.map((item) => (
              <ItemCard key={item.id} item={item} onDone={refresh} />
            ))}
          </div>
        </section>
      )}
    </AppShell>
  );
}

function ItemCard({ item, onDone }: { item: Item; onDone: () => void }) {
  const since = daysSince(item.last_worn_at);
  return (
    <div className="border border-border bg-card">
      <GarmentImage item={item} className="aspect-[3/4]" />
      <div className="space-y-2 p-3">
        <p className="font-display text-lg leading-tight">{item.name}</p>
        <p className="eyebrow">
          {item.color} · {item.pattern}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {since === null ? "Never worn" : since === 0 ? "Worn today" : `Worn ${since} days ago`}
        </p>
        <select
          value={item.status}
          onChange={async (e) => {
            await setStatus([item.id], e.target.value as Status);
            onDone();
            toast.success("Updated");
          }}
          className="w-full border border-border bg-background px-2 py-1.5 text-xs"
        >
          {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
        <button
          onClick={async () => {
            if (item.image_path) await supabase.storage.from("garments").remove([item.image_path]);
            await supabase.from("items").delete().eq("id", item.id);
            onDone();
            toast.success("Removed from closet");
          }}
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3 w-3" /> Delete
        </button>
      </div>
    </div>
  );
}

function AddItemDialog({ category, onDone }: { category: Category; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState("black");
  const [pattern, setPattern] = useState("solid");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  async function save() {
    setBusy(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const user_id = userData.user?.id;
      if (!user_id) throw new Error("Not signed in");

      let image_path: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `${user_id}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("garments").upload(path, file);
        if (error) throw error;
        image_path = path;
      }
      const { error } = await supabase.from("items").insert({
        user_id,
        name: name || (category === "top" ? "Top" : "Bottom"),
        category,
        color,
        pattern,
        image_path,
      });
      if (error) throw error;
      toast.success("Added to your closet");
      setName("");
      setFile(null);
      setPreview(null);
      setOpen(false);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-none text-xs uppercase tracking-[0.18em]">
          Add {category === "top" ? "top" : "bottom"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-none">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-light">
            New {category === "top" ? "top" : "bottom"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <button
            onClick={() => inputRef.current?.click()}
            className="flex aspect-[3/4] w-full items-center justify-center overflow-hidden border border-dashed border-border bg-muted/40"
          >
            {preview ? (
              <img src={preview} alt="Preview" className="h-full w-full object-cover" />
            ) : (
              <span className="flex flex-col items-center gap-2 text-muted-foreground">
                <Camera className="h-6 w-6" />
                <span className="eyebrow">Choose a photo</span>
              </span>
            )}
          </button>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={() => inputRef.current?.click()}
              className="rounded-none text-xs uppercase tracking-[0.18em]"
            >
              <ImageIcon className="mr-1.5 h-3.5 w-3.5" /> Gallery
            </Button>
            <Button
              variant="outline"
              onClick={() => cameraRef.current?.click()}
              className="rounded-none text-xs uppercase tracking-[0.18em]"
            >
              <Camera className="mr-1.5 h-3.5 w-3.5" /> Camera
            </Button>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              setPreview(f ? URL.createObjectURL(f) : null);
            }}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              setPreview(f ? URL.createObjectURL(f) : null);
            }}
          />
          <div>
            <Label className="eyebrow">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ivory silk blouse"
              className="mt-2 rounded-none"
            />
          </div>
          <div>
            <Label className="eyebrow">Colour</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setColor(c.value)}
                  title={c.label}
                  aria-label={c.label}
                  className={cn(
                    "h-7 w-7 border",
                    color === c.value ? "ring-2 ring-foreground ring-offset-2 ring-offset-background" : "border-border",
                  )}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          </div>
          <div>
            <Label className="eyebrow">Pattern</Label>
            <select
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              className="mt-2 w-full border border-border bg-card px-3 py-2 text-sm"
            >
              {PATTERNS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <Button onClick={save} disabled={busy} className="w-full rounded-none text-xs uppercase tracking-[0.18em]">
            {busy ? "Saving…" : "Add to closet"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
