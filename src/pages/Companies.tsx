
import { SEO } from "@/components/SEO";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";
import CreateCompanyDialog from "@/components/admin/CreateCompanyDialog";
import InviteUserDialog from "@/components/admin/InviteUserDialog";

type CompanyRow = {
  id: string;
  name: string;
  branch: string | null;
};

export default function Companies() {
  const isSuperAdmin = useIsSuperAdmin();

  const { data, isLoading, error } = useQuery({
    queryKey: ["companies", "list"],
    queryFn: async (): Promise<CompanyRow[]> => {
      const { data, error } = await supabase
        .from("companies")
        .select("id,name,branch")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as CompanyRow[];
    },
  });

  return (
    <div>
      <SEO title="Empresas | VaultDocs" description="Gerencie empresas e permissões." />
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Empresas</h1>
        {isSuperAdmin && (
          <div className="flex gap-2">
            <CreateCompanyDialog />
            <InviteUserDialog />
          </div>
        )}
      </div>
      <div className="glass-card rounded-lg p-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : error ? (
          <p className="text-sm text-destructive">Erro ao carregar: {(error as Error).message}</p>
        ) : (data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma empresa encontrada.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Filial</TableHead>
                <TableHead>ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data!.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.name}</TableCell>
                  <TableCell>{c.branch ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{c.id}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
