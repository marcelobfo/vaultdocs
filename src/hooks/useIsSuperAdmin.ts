
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type RoleRow = { role: string };

export function useIsSuperAdmin() {
  const { data: roles } = useQuery({
    queryKey: ["me", "roles"],
    queryFn: async (): Promise<RoleRow[]> => {
      const { data, error } = await supabase.from("user_roles").select("role");
      if (error) throw error;
      return data as RoleRow[];
    },
  });

  const isSuperAdmin = useMemo(() => roles?.some((r) => r.role === "super_admin") ?? false, [roles]);
  return isSuperAdmin;
}

