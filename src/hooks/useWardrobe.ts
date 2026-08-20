import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Feedback, Item, OutfitRow, Wear } from "@/lib/wardrobe";

export function useItems() {
  return useQuery({
    queryKey: ["items"],
    queryFn: async (): Promise<Item[]> => {
      const { data, error } = await supabase
        .from("items")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Item[];
    },
  });
}

export function useWears() {
  return useQuery({
    queryKey: ["wears"],
    queryFn: async (): Promise<Wear[]> => {
      const { data, error } = await supabase
        .from("wears")
        .select("id, top_id, bottom_id, worn_on, created_at")
        .order("worn_on", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Wear[];
    },
  });
}

export function useFeedback() {
  return useQuery({
    queryKey: ["feedback"],
    queryFn: async (): Promise<Feedback[]> => {
      const { data, error } = await supabase.from("item_feedback").select("item_id, value, day");
      if (error) throw error;
      return (data ?? []) as Feedback[];
    },
  });
}

export function useOutfits() {
  return useQuery({
    queryKey: ["outfits"],
    queryFn: async (): Promise<OutfitRow[]> => {
      const { data, error } = await supabase
        .from("outfits")
        .select("id, top_id, bottom_id, suggested_on, rating")
        .order("suggested_on", { ascending: false });
      if (error) throw error;
      return (data ?? []) as OutfitRow[];
    },
  });
}

export function useRefreshWardrobe() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["items"] });
    qc.invalidateQueries({ queryKey: ["wears"] });
    qc.invalidateQueries({ queryKey: ["feedback"] });
    qc.invalidateQueries({ queryKey: ["outfits"] });
  };
}

const urlCache = new Map<string, string>();

export function useSignedUrl(path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(path ? (urlCache.get(path) ?? null) : null);
  useEffect(() => {
    let active = true;
    if (!path) {
      setUrl(null);
      return;
    }
    const cached = urlCache.get(path);
    if (cached) {
      setUrl(cached);
      return;
    }
    supabase.storage
      .from("garments")
      .createSignedUrl(path, 60 * 60 * 6)
      .then(({ data }) => {
        if (!active || !data?.signedUrl) return;
        urlCache.set(path, data.signedUrl);
        setUrl(data.signedUrl);
      });
    return () => {
      active = false;
    };
  }, [path]);
  return url;
}
