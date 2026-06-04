import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useFeatureFlag(key: string) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("feature_flags")
      .select("enabled, description")
      .eq("key", key)
      .maybeSingle();
    if (!error && data) {
      setEnabled(!!data.enabled);
      setDescription(data.description);
    } else {
      setEnabled(false);
    }
    setIsLoading(false);
  }, [key]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`feature_flag_${key}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "feature_flags", filter: `key=eq.${key}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [key, load]);

  const setFlag = useCallback(
    async (next: boolean) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("feature_flags")
        .update({ enabled: next, updated_at: new Date().toISOString(), updated_by: userData.user?.id })
        .eq("key", key);
      if (!error) setEnabled(next);
      return { error };
    },
    [key]
  );

  return { enabled: enabled ?? false, description, isLoading, setFlag, refresh: load };
}
