import { colorHex, type Item } from "@/lib/wardrobe";
import { useSignedUrl } from "@/hooks/useWardrobe";
import { cn } from "@/lib/utils";

export function GarmentImage({ item, className }: { item: Item; className?: string }) {
  const url = useSignedUrl(item.image_path);
  return (
    <div
      className={cn("relative overflow-hidden bg-muted", className)}
      style={url ? undefined : { backgroundColor: colorHex(item.color) }}
    >
      {url ? (
        <img
          src={url}
          alt={item.name}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center px-2 text-center text-[10px] uppercase tracking-[0.18em] text-background/90">
          {item.name}
        </span>
      )}
    </div>
  );
}
