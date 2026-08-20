import { supabase } from "@/integrations/supabase/client";
import type { Status, Suggestion } from "./wardrobe";
import { localISODate, today } from "./wardrobe";

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
  const cutoff = localISODate(new Date(Date.now() - 365 * 86400000));
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

export async function updateWear(
  id: string,
  patch: { top_id?: string; bottom_id?: string; worn_on?: string },
) {
  const { error } = await supabase.from("wears").update(patch).eq("id", id);
  if (error) throw error;
}

/**
 * Legacy fix: entries stamped with the UTC day (evening logs rolled into the
 * next date). Moves each wear onto the local calendar day it was created on.
 */
export async function shiftWearDates(
  entries: { id: string; correctDay: string }[],
  allWears: { id: string; top_id: string | null; bottom_id: string | null; worn_on: string }[],
): Promise<{ moved: number; merged: number }> {
  let moved = 0;
  let merged = 0;
  const occupied = new Set(
    allWears.map((w) => `${w.worn_on}|${w.top_id ?? ""}|${w.bottom_id ?? ""}`),
  );
  for (const e of entries) {
    const w = allWears.find((x) => x.id === e.id);
    if (!w) continue;
    const key = `${e.correctDay}|${w.top_id ?? ""}|${w.bottom_id ?? ""}`;
    if (occupied.has(key)) {
      // Same pair already recorded on the correct day → keep one only.
      await deleteWear(e.id);
      merged += 1;
      continue;
    }
    await updateWear(e.id, { worn_on: e.correctDay });
    occupied.delete(`${w.worn_on}|${w.top_id ?? ""}|${w.bottom_id ?? ""}`);
    occupied.add(key);
    moved += 1;
  }

  // Re-sync last_worn_at for every touched piece.
  const touched = new Set<string>();
  for (const e of entries) {
    const w = allWears.find((x) => x.id === e.id);
    if (w?.top_id) touched.add(w.top_id);
    if (w?.bottom_id) touched.add(w.bottom_id);
  }
  for (const itemId of touched) {
    const { data } = await supabase
      .from("wears")
      .select("worn_on")
      .or(`top_id.eq.${itemId},bottom_id.eq.${itemId}`)
      .order("worn_on", { ascending: false })
      .limit(1);
    const last = data?.[0]?.worn_on ?? null;
    await supabase.from("items").update({ last_worn_at: last }).eq("id", itemId);
  }

  return { moved, merged };
}

export async function deleteWear(id: string) {
  const { error } = await supabase.from("wears").delete().eq("id", id);
  if (error) throw error;
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
