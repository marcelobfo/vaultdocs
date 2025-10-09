
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

type Props = {
  triggerClassName?: string;
  onCreated?: (companyId: string) => void;
};

export default function CreateCompanyDialog({ triggerClassName, onCreated }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [branch, setBranch] = useState("");
  const [loading, setLoading] = useState(false);

  async function createCompany() {
    if (!name.trim()) {
      toast({ title: "Nome obrigatório", description: "Informe o nome da empresa." });
      return;
    }
    setLoading(true);
    const payload: { name: string; branch: string | null } = {
      name: name.trim(),
      branch: branch.trim() ? branch.trim() : null,
    };
    const { data, error } = await supabase.from("companies").insert([payload]).select("id").single();
    setLoading(false);
    if (error) {
      toast({ title: "Erro ao criar empresa", description: error.message });
      return;
    }
    toast({ title: "Empresa criada", description: "A nova empresa foi cadastrada com sucesso." });
    setOpen(false);
    setName("");
    setBranch("");
    onCreated?.(data!.id as string);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["companies", "list"] }),
      qc.invalidateQueries({ queryKey: ["companies", "all-for-admin"] }),
    ]);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className={triggerClassName}>Nova Empresa</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar nova empresa</DialogTitle>
          <DialogDescription>Preencha os dados básicos para cadastrar a empresa.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="company-name">Nome</Label>
            <Input id="company-name" placeholder="Ex.: Empresa Exemplo LTDA" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company-branch">Filial (opcional)</Label>
            <Input id="company-branch" placeholder="Ex.: São Paulo" value={branch} onChange={(e) => setBranch(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={createCompany} disabled={loading}>{loading ? "Criando..." : "Criar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

