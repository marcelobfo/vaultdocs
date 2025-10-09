
import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { getSession } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

interface Props { children: ReactNode }

export default function ProtectedRoute({ children }: Props) {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let unsub: { unsubscribe: () => void } | undefined;

    async function check() {
      const { session } = await getSession();
      if (!session) {
        navigate("/login", { replace: true });
      }
      setChecking(false);

      // Listen to auth changes (e.g., sign out in another tab)
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!session) navigate("/login", { replace: true });
      });

      // Save the subscription itself (it has the unsubscribe method)
      unsub = subscription;
    }
    check();

    return () => {
      unsub?.unsubscribe();
    };
  }, [navigate]);

  if (checking) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="animate-spin mr-2" /> Verificando sessão...
      </div>
    );
  }

  return <>{children}</>;
}
