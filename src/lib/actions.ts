import { supabase } from "@/integrations/supabase/client";
import type { Status, Suggestion } from "./wardrobe";
import { today } from "./wardrobe";

export async function rateOutfit(outfitId: string, topId: string, bottomId: string, value: 1 | -1) {
  const { data: userData } = await supabase.auth.getUser();
  const user_id = userData.user?.id;
  if (!user_id) throw new Error("Not signed in");
  const day = today();
  await supabase.from("outfits").update({ rating: value }).eq("id", outfitId);
  await supabase.from("item_feedback").upsert(
    [
      { user_id, item_id: topId, value, day },
      { user_id, item_id: bottomId, value, day },
    ],
    { onConflict: "user_id,item_id,day,value" },
  );
}

export async function logWear(
  topId: string,
  bottomId: string,
  wornOn: string,
): Promise<{ inserted: boolean; duplicate: boolean }> {
  const { data: userData } = await supabase.auth.getUser();
  const user_id = userData.user?.id;
  if (!user_id) throw new Error("Not signed in");

  // Same pair, same day → count once only.
  const { data: existing } = await supabase
    .from("wears")
    .select("id")
    .eq("worn_on", wornOn)
    .eq("top_id", topId)
    .eq("bottom_id", bottomId)
    .limit(1);
  if (existing && existing.length) return { inserted: false, duplicate: true };

  await supabase.from("wears").insert({ user_id, top_id: topId, bottom_id: bottomId, worn_on: wornOn });
  await supabase.from("items").update({ last_worn_at: wornOn }).in("id", [topId, bottomId]);

  // Keep only the last 365 days of outfit history (pieces themselves are never removed).
  const cutoff = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
  await supabase.from("wears").delete().lt("worn_on", cutoff);
  await supabase.from("outfits").delete().lt("suggested_on", cutoff);

  return { inserted: true, duplicate: false };
}

/** True when this exact pair was already worn on the given day. */
export function pairWornOn(
  wears: { top_id: string | null; bottom_id: string | null; worn_on: string }[],
  topId: string,
  bottomId: string,
  day: string,
) {
  return wears.some((w) => w.worn_on === day && w.top_id === topId && w.bottom_id === bottomId);
}

export async function setStatus(ids: string[], status: Status) {
  if (!ids.length) return;
  await supabase.from("items").update({ status }).in("id", ids);
}

export async function saveSuggestions(suggestions: Suggestion[], date: string) {
  const { data: userData } = await supabase.auth.getUser();
  const user_id = userData.user?.id;
  if (!user_id || !suggestions.length) return;
  await supabase.from("outfits").upsert(
    suggestions.map((s) => ({
      user_id,
      top_id: s.top.id,
      bottom_id: s.bottom.id,
      suggested_on: date,
    })),
    { onConflict: "user_id,suggested_on,top_id,bottom_id" },
  );
}
