
import { SEO } from "@/components/SEO";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";
import CreateCompanyDialog from "@/components/admin/CreateCompanyDialog";
import InviteUserDialog from "@/components/admin/InviteUserDialog";
import EditCompanyDialog from "@/components/admin/EditCompanyDialog";
import NotificationSettingsDialog from "@/components/admin/NotificationSettingsDialog";

type CompanyRow = {
  id: string;
  name: string;
  branch: string | null;
  cnpj: string | null;
  city: string | null;
  state: string | null;
  logo_url: string | null;
};

export default function Companies() {
  const isSuperAdmin = useIsSuperAdmin();

  const { data, isLoading, error } = useQuery({
    queryKey: ["companies", "list"],
    queryFn: async (): Promise<CompanyRow[]> => {
      const { data, error } = await supabase
        .from("companies")
        .select("id,name,branch,cnpj,city,state,logo_url")
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
                <TableHead>Logo</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Filial</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>Estado</TableHead>
                {isSuperAdmin && <TableHead>Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data!.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    {c.logo_url ? (
                      <img src={c.logo_url} alt={c.name} className="h-8 w-8 object-cover rounded" />
                    ) : (
                      <div className="h-8 w-8 bg-muted rounded" />
                    )}
                  </TableCell>
                  <TableCell>{c.name}</TableCell>
                  <TableCell>{c.branch ?? "—"}</TableCell>
                  <TableCell>{c.city ?? "—"}</TableCell>
                  <TableCell>{c.state ?? "—"}</TableCell>
                  {isSuperAdmin && (
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <EditCompanyDialog company={c} />
                        <NotificationSettingsDialog companyId={c.id} />
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
