import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";

interface ManageServicesDialogProps {
  companyId: string | null;
  isAdmin?: boolean;
  onChanged?: () => void;
}

export default function ManageServicesDialog({ companyId, isAdmin = false, onChanged }: ManageServicesDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const { data: services, isLoading, error, refetch } = useQuery({
    queryKey: ["services", companyId, open],
    enabled: open && !!companyId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("services")
        .select("id,name,active,company_id")
        .eq("company_id", companyId!)
        .order("name", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  async function addService() {
    if (!companyId || !name.trim()) return;
    const { error } = await (supabase as any).from("services").insert({ company_id: companyId, name: name.trim(), active: true });
    if (error) {
      toast({ title: "Erro ao cadastrar serviço", description: error.message });
      return;
    }
    toast({ title: "Serviço cadastrado", description: "O serviço foi criado com sucesso." });
    setName("");
    await refetch();
    onChanged?.();
  }

  async function deleteService(id: string) {
    if (!companyId) return;
    if (!window.confirm("Excluir este serviço? Arquivos vinculados ficarão sem serviço (não serão apagados).")) return;
    const { error } = await (supabase as any).from("services").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir serviço", description: error.message });
      return;
    }
    toast({ title: "Serviço excluído", description: "O serviço foi removido." });
    await refetch();
    onChanged?.();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={!companyId}>Gerenciar serviços</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Serviços da empresa</DialogTitle>
          <DialogDescription>Cadastre ou exclua serviços utilizados na classificação dos arquivos.</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : error ? (
          <p className="text-sm text-destructive">Erro: {(error as Error).message}</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Nome do serviço"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!isAdmin}
              />
              <Button onClick={addService} disabled={!isAdmin || !name.trim()}>Adicionar</Button>
            </div>

            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead className="w-32">Ativo</TableHead>
                    <TableHead className="w-32 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(services ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-sm text-muted-foreground">Nenhum serviço cadastrado.</TableCell>
                    </TableRow>
                  ) : (
                    (services ?? []).map((s: any) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell>{s.active ? "Sim" : "Não"}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="destructive" size="sm" onClick={() => deleteService(s.id)} disabled={!isAdmin}>
                            Excluir
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
