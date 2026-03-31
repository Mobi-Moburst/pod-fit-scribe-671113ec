import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function useUserRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<"admin" | "user" | "viewer" | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRole(null);
      setIsLoading(false);
      return;
    }

    const fetchRole = async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching role:", error);
        setRole("user"); // Default to user if error
      } else {
        setRole((data?.role as "admin" | "user" | "viewer") || "user");
      }
      setIsLoading(false);
    };

    fetchRole();
  }, [user]);

  return { role, isAdmin: role === "admin", isLoading };
}
