import { Heart, HeartOff, Check } from "lucide-react";
import { GarmentImage } from "@/components/GarmentImage";
import type { Item } from "@/lib/wardrobe";
import { cn } from "@/lib/utils";

export function OutfitCard({
  top,
  bottom,
  rating,
  onLike,
  onDislike,
  onWore,
  worn,
}: {
  top: Item;
  bottom: Item;
  rating?: number | null;
  onLike?: () => void;
  onDislike?: () => void;
  onWore?: () => void;
  worn?: boolean;
}) {
  return (
    <article className="group border border-border bg-card">
      <div className="grid grid-cols-2">
        <GarmentImage item={top} className="aspect-[3/4]" />
        <GarmentImage item={bottom} className="aspect-[3/4]" />
      </div>
      <div className="p-4">
        <p className="font-display text-lg leading-tight">
          {top.name} <span className="text-muted-foreground">+</span> {bottom.name}
        </p>
        <p className="eyebrow mt-1">
          {top.color} / {bottom.color}
        </p>
        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={onLike}
            className={cn(
              "flex h-9 w-9 items-center justify-center border border-border transition-colors hover:bg-secondary",
              rating === 1 && "bg-primary text-primary-foreground",
            )}
            aria-label="Like this look"
          >
            <Heart className="h-4 w-4" />
          </button>
          <button
            onClick={onDislike}
            className={cn(
              "flex h-9 w-9 items-center justify-center border border-border transition-colors hover:bg-secondary",
              rating === -1 && "bg-primary text-primary-foreground",
            )}
            aria-label="Dislike this look"
          >
            <HeartOff className="h-4 w-4" />
          </button>
          <button
            onClick={onWore}
            className={cn(
              "ml-auto flex items-center gap-2 border border-border px-3 py-2 text-[11px] uppercase tracking-[0.18em] transition-colors hover:bg-secondary",
              worn && "bg-primary text-primary-foreground",
            )}
          >
            <Check className="h-3.5 w-3.5" />
            {worn ? "Worn" : "I wore this"}
          </button>
        </div>
      </div>
    </article>
  );
}
