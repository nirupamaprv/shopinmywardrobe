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

export async function logWear(topId: string, bottomId: string, wornOn: string) {
  const { data: userData } = await supabase.auth.getUser();
  const user_id = userData.user?.id;
  if (!user_id) throw new Error("Not signed in");
  await supabase.from("wears").insert({ user_id, top_id: topId, bottom_id: bottomId, worn_on: wornOn });
  await supabase.from("items").update({ last_worn_at: wornOn }).in("id", [topId, bottomId]);
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
