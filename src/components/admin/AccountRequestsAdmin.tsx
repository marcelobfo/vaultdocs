
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

type RoleRow = { role: string };
type Company = { id: string; name: string; branch: string | null };
type AccountRequest = {
  id: string;
  user_id: string;
  email: string;
  message: string | null;
  desired_company_id: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

export default function AccountRequestsAdmin() {
  const qc = useQueryClient();
  const [selection, setSelection] = useState<Record<string, string>>({}); // requestId -> companyId

  // Verifica se o usuário é super admin
  const { data: roles } = useQuery({
    queryKey: ["me", "roles"],
    queryFn: async (): Promise<RoleRow[]> => {
      const { data, error } = await supabase.from("user_roles").select("role");
      if (error) throw error;
      return data as RoleRow[];
    },
  });

  const isSuperAdmin = useMemo(() => roles?.some((r) => r.role === "super_admin") ?? false, [roles]);

  // Carrega empresas (somente super admin consegue ler todas)
  const { data: companies } = useQuery({
    queryKey: ["companies", "all-for-admin"],
    queryFn: async (): Promise<Company[]> => {
      const { data, error } = await supabase.from("companies").select("id,name,branch").order("name", { ascending: true });
      if (error) throw error;
      return data as Company[];
    },
    enabled: isSuperAdmin,
  });

  // Carrega solicitações pendentes
  const { data: requests, isLoading, error } = useQuery({
    queryKey: ["account_requests", "pending"],
    queryFn: async (): Promise<AccountRequest[]> => {
      const { data, error } = await supabase
        .from("account_requests")
        .select("id,user_id,email,message,desired_company_id,status,created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as AccountRequest[];
    },
    enabled: isSuperAdmin,
  });

  useEffect(() => {
    if (!isSuperAdmin) return;
    console.log("Carregando solicitações pendentes para super admin...");
  }, [isSuperAdmin]);

  async function approve(req: AccountRequest) {
    const companyId = selection[req.id];
    if (!companyId) {
      toast({ title: "Selecione uma empresa", description: "Escolha a empresa para vincular antes de aprovar." });
      return;
    }

    // 1) Vincula o usuário à empresa como viewer
    const { error: insError } = await supabase.from("user_companies").insert([
      { user_id: req.user_id, company_id: companyId, role: "viewer" },
    ]);
    if (insError) {
      toast({ title: "Erro ao vincular", description: insError.message });
      return;
    }

    // 2) Atualiza status da solicitação para aprovado
    const { error: updError } = await supabase
      .from("account_requests")
      .update({ status: "approved", desired_company_id: companyId })
      .eq("id", req.id);
    if (updError) {
      toast({ title: "Erro ao aprovar", description: updError.message });
      return;
    }

    toast({ title: "Solicitação aprovada", description: `Usuário vinculado à empresa selecionada.` });
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["account_requests", "pending"] }),
      qc.invalidateQueries({ queryKey: ["companies", "all-for-admin"] }),
    ]);
  }

  async function reject(req: AccountRequest) {
    const { error: updError } = await supabase.from("account_requests").update({ status: "rejected" }).eq("id", req.id);
    if (updError) {
      toast({ title: "Erro ao rejeitar", description: updError.message });
      return;
    }
    toast({ title: "Solicitação rejeitada", description: `O usuário foi notificado na próxima sessão.` });
    await qc.invalidateQueries({ queryKey: ["account_requests", "pending"] });
  }

  if (!isSuperAdmin) {
    return null; // Não mostra nada para usuários comuns
  }

  return (
    <div className="glass-card rounded-lg p-6">
      <h2 className="text-lg font-semibold mb-4">Solicitações de conta (Admin)</h2>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando solicitações...</p>
      ) : error ? (
        <p className="text-sm text-destructive">Erro: {(error as Error).message}</p>
      ) : !requests || requests.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma solicitação pendente.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>E-mail</TableHead>
              <TableHead>Mensagem</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((req) => (
              <TableRow key={req.id}>
                <TableCell className="font-medium">{req.email}</TableCell>
                <TableCell className="max-w-[360px] truncate">{req.message ?? "—"}</TableCell>
                <TableCell className="min-w-[260px]">
                  <Select
                    value={selection[req.id] ?? ""}
                    onValueChange={(val) => setSelection((s) => ({ ...s, [req.id]: val }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      {(companies ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} {c.branch ? `- ${c.branch}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="space-x-2">
                  <Button size="sm" onClick={() => approve(req)}>Aprovar</Button>
                  <Button size="sm" variant="outline" onClick={() => reject(req)}>Rejeitar</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
