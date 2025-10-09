
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

type Company = { id: string; name: string; branch: string | null };

export default function InviteUserDialog({ triggerClassName }: { triggerClassName?: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [companyId, setCompanyId] = useState<string>("");
  const [role, setRole] = useState<"viewer" | "company_admin">("viewer");
  const [loading, setLoading] = useState(false);

  const { data: companies, isLoading: loadingCompanies, error } = useQuery({
    queryKey: ["companies", "all-for-admin"],
    queryFn: async (): Promise<Company[]> => {
      const { data, error } = await supabase
        .from("companies")
        .select("id,name,branch")
        .order("name", { ascending: true });
      if (error) throw error;
      return data as Company[];
    },
    enabled: open,
  });

  async function invite() {
    if (!email.trim()) {
      toast({ title: "E-mail obrigatório", description: "Informe o e-mail do usuário." });
      return;
    }
    if (!companyId) {
      toast({ title: "Selecione a empresa", description: "Escolha a empresa para vincular o usuário." });
      return;
    }
    setLoading(true);
    const { error: rpcError } = await supabase.rpc("add_user_to_company_by_email", {
      _email: email.trim(),
      _company_id: companyId,
      _role: role,
    });
    setLoading(false);
    if (rpcError) {
      toast({ title: "Erro ao convidar", description: rpcError.message });
      return;
    }
    toast({ title: "Convite aplicado", description: "O usuário foi vinculado/atualizado na empresa." });
    setEmail("");
    setCompanyId("");
    setRole("viewer");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className={triggerClassName}>Convidar Usuário</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convidar usuário por e-mail</DialogTitle>
          <DialogDescription>Vincule um usuário a uma empresa e defina seu papel.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="invite-email">E-mail</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="email@dominio.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Empresa</Label>
            <Select value={companyId} onValueChange={setCompanyId} disabled={loadingCompanies || !!error}>
              <SelectTrigger>
                <SelectValue placeholder={loadingCompanies ? "Carregando..." : "Selecione uma empresa"} />
              </SelectTrigger>
              <SelectContent>
                {(companies ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} {c.branch ? `- ${c.branch}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Papel</Label>
            <Select value={role} onValueChange={(v) => setRole(v as "viewer" | "company_admin")}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o papel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">Leitor (viewer)</SelectItem>
                <SelectItem value="company_admin">Administrador da empresa</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={invite} disabled={loading}>{loading ? "Aplicando..." : "Aplicar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
