
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { getUser } from "@/lib/auth";

type AccountRequest = {
  id: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  message: string | null;
};

export default function RequestAccessForm() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [existing, setExisting] = useState<AccountRequest | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");

  useEffect(() => {
    // Carrega usuário e solicitações existentes do próprio usuário
    getUser().then(async ({ user }) => {
      if (!user) return;
      setUserEmail(user.email ?? "");

      const { data, error } = await supabase
        .from("account_requests")
        .select("id,status,created_at,message")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Erro ao buscar solicitação do usuário", error);
        return;
      }

      // Pela RLS, só retorna as do próprio user; pega a mais recente
      setExisting((data && data.length > 0 ? data[0] : null) as AccountRequest | null);
    });
  }, []);

  async function submitRequest() {
    setLoading(true);
    const { user } = await getUser();
    if (!user) {
      setLoading(false);
      toast({ title: "Sessão expirada", description: "Faça login para solicitar acesso." });
      return;
    }

    const { error } = await supabase.from("account_requests").insert([
      {
        user_id: user.id,
        email: user.email,
        message: message || null,
        // desired_company_id: null // opcional; super admin poderá definir ao aprovar
      },
    ]);

    setLoading(false);
    if (error) {
      toast({ title: "Erro ao solicitar acesso", description: error.message });
      return;
    }
    toast({ title: "Solicitação enviada", description: "Aguarde a aprovação do administrador." });

    // Atualiza estado local para refletir solicitação pendente
    setExisting({
      id: "local",
      status: "pending",
      created_at: new Date().toISOString(),
      message,
    });
  }

  if (existing && existing.status === "pending") {
    return (
      <div className="glass-card rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-2">Solicitação de acesso</h2>
        <p className="text-sm text-muted-foreground">
          Você já possui uma solicitação pendente enviada em {new Date(existing.created_at).toLocaleString()}.
        </p>
        {existing.message ? (
          <p className="text-sm mt-2">
            Mensagem: <span className="text-muted-foreground">{existing.message}</span>
          </p>
        ) : null}
      </div>
    );
  }

  if (existing && existing.status !== "pending") {
    return (
      <div className="glass-card rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-2">Solicitação de acesso</h2>
        <p className="text-sm">
          Status:{" "}
          <span className={existing.status === "approved" ? "text-green-600" : "text-destructive"}>
            {existing.status === "approved" ? "Aprovada" : "Rejeitada"}
          </span>
        </p>
        {existing.message ? (
          <p className="text-sm mt-2">
            Mensagem: <span className="text-muted-foreground">{existing.message}</span>
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="glass-card rounded-lg p-6">
      <h2 className="text-lg font-semibold mb-2">Solicitar acesso</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Preencha a mensagem com informações úteis (ex.: empresa, filial, CNPJ) para o administrador aprovar seu acesso.
      </p>

      <div className="space-y-2 mb-4">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" value={userEmail} readOnly className="bg-muted/40" />
      </div>

      <div className="space-y-2 mb-4">
        <Label htmlFor="message">Mensagem (opcional)</Label>
        <Input
          id="message"
          placeholder="Ex.: Solicito acesso à Empresa X, filial Y (CNPJ ...)"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </div>

      <Button onClick={submitRequest} disabled={loading}>
        {loading ? "Enviando..." : "Enviar solicitação"}
      </Button>
    </div>
  );
}
