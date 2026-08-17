export type Category = "top" | "bottom";
export type Status = "active" | "seasonal" | "special" | "sell" | "unloved";

export interface Item {
  id: string;
  user_id: string;
  name: string;
  category: Category;
  color: string;
  pattern: string;
  image_path: string | null;
  status: Status;
  last_worn_at: string | null;
  created_at: string;
}

export interface Wear {
  id: string;
  top_id: string | null;
  bottom_id: string | null;
  worn_on: string;
}

export interface Feedback {
  item_id: string;
  value: number;
  day: string;
}

export interface OutfitRow {
  id: string;
  top_id: string;
  bottom_id: string;
  suggested_on: string;
  rating: number | null;
}

export const COLORS: { value: string; label: string; hex: string }[] = [
  { value: "black", label: "Black", hex: "#1c1a19" },
  { value: "white", label: "White", hex: "#f7f4ef" },
  { value: "ivory", label: "Ivory", hex: "#ece3d4" },
  { value: "grey", label: "Grey", hex: "#8f8c88" },
  { value: "navy", label: "Navy", hex: "#243352" },
  { value: "denim", label: "Denim", hex: "#5a7593" },
  { value: "camel", label: "Camel", hex: "#b98f5e" },
  { value: "brown", label: "Brown", hex: "#6b4b34" },
  { value: "olive", label: "Olive", hex: "#6c7052" },
    { value: "blush", label: "Blush", hex: "#dcaea5" },
    { value: "red", label: "Red", hex: "#9e2b25" },
  { value: "burgundy", label: "Burgundy", hex: "#6d2739" },
  { value: "pink", label: "Pink", hex: "#d98ba6" },
  { value: "purple", label: "Purple", hex: "#6f5590" },
  { value: "blue", label: "Blue", hex: "#3f6ea3" },
  { value: "green", label: "Green", hex: "#3f6f57" },
  { value: "teal", label: "Teal", hex: "#2f6f6b" },
  { value: "yellow", label: "Yellow", hex: "#d3a94a" },
  { value: "orange", label: "Orange", hex: "#c1703a" },
  { value: "print", label: "Multi / Print", hex: "#a58fb0" },
];

export const PATTERNS = ["solid", "stripe", "print", "check", "textured", "lace"];

export const NEUTRALS = new Set(["black", "white", "ivory", "grey", "navy", "denim", "camel", "brown"]);

export function colorHex(value: string): string {
  return COLORS.find((c) => c.value === value)?.hex ?? "#b9b2a7";
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

export function daysSince(date: string | null): number | null {
  if (!date) return null;
  return daysBetween(date, today());
}

/** Deterministic pseudo-random from a string seed. */
function seeded(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Suggestion {
  top: Item;
  bottom: Item;
  score: number;
}

export interface MatchInput {
  items: Item[];
  wears: Wear[];
  feedback: Feedback[];
  pastOutfits: OutfitRow[];
  date: string;
  includeSpecial?: boolean;
  count?: number;
}

export function itemStats(itemId: string, feedback: Feedback[]) {
  const rows = feedback.filter((f) => f.item_id === itemId);
  const likes = rows.filter((f) => f.value === 1).length;
  const dislikeDays = new Set(rows.filter((f) => f.value === -1).map((f) => f.day)).size;
  return { likes, dislikeDays };
}

export function isUnloved(itemId: string, feedback: Feedback[]) {
  const { likes, dislikeDays } = itemStats(itemId, feedback);
  return likes === 0 && dislikeDays >= 7;
}

export function wearCount(itemId: string, wears: Wear[]) {
  // A piece counts once per distinct day, no matter how many times it is logged.
  return new Set(
    wears.filter((w) => w.top_id === itemId || w.bottom_id === itemId).map((w) => w.worn_on),
  ).size;
}

/** Distinct days a piece was worn within the last `days` days. */
export function wearCountWithin(itemId: string, wears: Wear[], days: number, from = today()) {
  return new Set(
    wears
      .filter(
        (w) =>
          (w.top_id === itemId || w.bottom_id === itemId) &&
          daysBetween(w.worn_on, from) >= 0 &&
          daysBetween(w.worn_on, from) < days,
      )
      .map((w) => w.worn_on),
  ).size;
}

/** Wear rows reduced to one entry per pair per day. */
export function distinctWears(wears: Wear[]): Wear[] {
  const seen = new Set<string>();
  const out: Wear[] = [];
  for (const w of wears) {
    const key = `${w.worn_on}|${w.top_id ?? ""}|${w.bottom_id ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(w);
  }
  return out;
}

export function generateMatches({
  items,
  wears,
  feedback,
  pastOutfits,
  date,
  includeSpecial = false,
  count = 5,
}: MatchInput): Suggestion[] {
  const eligible = items.filter(
    (i) => i.status === "active" || (includeSpecial && i.status === "special"),
  );
  const tops = eligible.filter((i) => i.category === "top");
  const bottoms = eligible.filter((i) => i.category === "bottom");
  if (!tops.length || !bottoms.length) return [];

  // Colors worn in the past 3 days
  const recent = wears.filter((w) => daysBetween(w.worn_on, date) <= 3 && daysBetween(w.worn_on, date) >= 0);
  const recentIds = new Set(recent.flatMap((w) => [w.top_id, w.bottom_id].filter(Boolean) as string[]));
  const recentColors = new Set(
    items.filter((i) => recentIds.has(i.id)).map((i) => i.color),
  );

  // Pairings previously disliked
  const dislikedPairs = new Set(
    pastOutfits.filter((o) => o.rating === -1).map((o) => `${o.top_id}|${o.bottom_id}`),
  );
  // Learned color-pair preference
  const pairColorScore = new Map<string, number>();
  for (const o of pastOutfits) {
    if (!o.rating) continue;
    const t = items.find((i) => i.id === o.top_id);
    const b = items.find((i) => i.id === o.bottom_id);
    if (!t || !b) continue;
    const key = `${t.color}+${b.color}`;
    pairColorScore.set(key, (pairColorScore.get(key) ?? 0) + o.rating);
  }

  const rand = seeded(date + items.length);

  const scoreItem = (i: Item) => {
    const { likes, dislikeDays } = itemStats(i.id, feedback);
    let s = likes * 1.6 - dislikeDays * 1.6;
    const since = daysSince(i.last_worn_at);
    if (since === null) s += 2.5; // never worn — surface it
    else s += Math.min(since / 15, 3) - (since <= 3 ? 5 : 0);
    if (recentColors.has(i.color)) s -= 4;
    if (isUnloved(i.id, feedback)) s -= 6;
    return s;
  };

  const candidates: Suggestion[] = [];
  for (const t of tops) {
    for (const b of bottoms) {
      if (dislikedPairs.has(`${t.id}|${b.id}`)) continue;
      let score = scoreItem(t) + scoreItem(b) + rand() * 1.2;
      score += (pairColorScore.get(`${t.color}+${b.color}`) ?? 0) * 1.2;
      if (t.color === b.color && t.color !== "black") score -= 1;
      if (NEUTRALS.has(t.color) !== NEUTRALS.has(b.color)) score += 0.8;
      if (t.pattern !== "solid" && b.pattern !== "solid") score -= 1.5;
      candidates.push({ top: t, bottom: b, score });
    }
  }
  candidates.sort((a, b) => b.score - a.score);

  const chosen: Suggestion[] = [];
  const used = new Set<string>();
  for (const pass of [1, 2]) {
    for (const c of candidates) {
      if (chosen.length >= count) break;
      if (pass === 1 && (used.has(c.top.id) || used.has(c.bottom.id))) continue;
      if (chosen.some((x) => x.top.id === c.top.id && x.bottom.id === c.bottom.id)) continue;
      chosen.push(c);
      used.add(c.top.id);
      used.add(c.bottom.id);
    }
  }
  return chosen.slice(0, count);
}
