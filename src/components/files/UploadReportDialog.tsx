
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Props = {
  companyId: string | null;
};

// Tipos simples para evitar inferência profunda do TS
type Service = {
  id: string;
  name: string;
  active: boolean;
};

type FileRow = {
  id: string;
  name: string;
  size: number | null;
  created_at: string;
  expires_at: string | null;
  mime_type: string | null;
};

export default function UploadReportDialog({ companyId }: Props) {
  const [open, setOpen] = useState(false);
  const [serviceId, setServiceId] = useState<string>("");

  // Evita generics no useQuery e faz type assertion leve no retorno
  const { data: services } = (useQuery({
    queryKey: ["services", companyId, open],
    enabled: open && !!companyId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("services")
        .select("id,name,active")
        .eq("company_id", companyId!)
        .eq("active", true)
        .order("name", { ascending: true });
      if (error) throw error;
      return data;
    },
  }) as { data: Service[] | undefined });

  const { data, isLoading, error } = (useQuery({
    queryKey: ["files", "report", companyId, serviceId, open],
    enabled: open && !!companyId,
    queryFn: async () => {
      let q = (supabase as any)
        .from("files")
        .select("id,name,size,created_at,expires_at,mime_type")
        .eq("company_id", companyId!);
      if (serviceId) q = q.eq("service_id", serviceId);
      q = q.order("created_at", { ascending: false }).limit(200);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  }) as { data: FileRow[] | undefined; isLoading: boolean; error: unknown });

  const onExportCsv = () => {
    if (!data) return;
    const rows = [["id", "name", "size", "created_at", "expires_at", "mime_type"]];
    data.forEach((r: any) => {
      rows.push([
        r.id,
        r.name,
        r.size ?? "",
        new Date(r.created_at).toISOString(),
        r.expires_at ? new Date(r.expires_at).toISOString() : "",
        r.mime_type ?? "",
      ]);
    });
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-arquivos-${companyId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={!companyId}>Relatório de envios</Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Relatório de envios</DialogTitle>
          <DialogDescription>Listagem recente de arquivos da empresa selecionada</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : error ? (
          <p className="text-sm text-destructive">Erro: {(error as Error).message}</p>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem registros.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="w-64">
                <Select value={serviceId} onValueChange={setServiceId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Todos os serviços" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos os serviços</SelectItem>
                    {(services ?? []).map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end">
                <Button size="sm" onClick={onExportCsv}>Exportar CSV</Button>
              </div>
            </div>
            <div className="rounded-md border overflow-x-auto max-h-[60vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead className="hidden md:table-cell">Tamanho</TableHead>
                    <TableHead className="hidden md:table-cell">Tipo</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead>Expira em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {typeof r.size === "number" ? `${(r.size / 1024).toFixed(1)} KB` : "—"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">{r.mime_type ?? "—"}</TableCell>
                      <TableCell>{new Date(r.created_at).toLocaleString()}</TableCell>
                      <TableCell>{r.expires_at ? new Date(r.expires_at).toLocaleDateString() : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
