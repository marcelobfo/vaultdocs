
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Files, Building2, Bell, ShieldPlus } from "lucide-react";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";
import CreateCompanyDialog from "@/components/admin/CreateCompanyDialog";
import InviteUserDialog from "@/components/admin/InviteUserDialog";

export default function Dashboard() {
  const isSuperAdmin = useIsSuperAdmin();

  return (
    <div>
      <SEO title="Dashboard | VaultDocs" description="Seu painel de gestão de documentos." />
      <section className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Resumo</h1>
        <p className="text-muted-foreground">Visão geral do seu espaço.</p>
      </section>
      <section className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Arquivos</CardTitle>
            <Files className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">—</div>
            <p className="text-xs text-muted-foreground">Total de documentos</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Empresas</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">—</div>
            <p className="text-xs text-muted-foreground">Cadastradas</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Notificações</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">—</div>
            <p className="text-xs text-muted-foreground">Últimas 24h</p>
          </CardContent>
        </Card>
      </section>

      {isSuperAdmin && (
        <section className="mt-8">
          <div className="flex items-center gap-2 mb-3">
            <ShieldPlus className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Administração</h2>
          </div>
          <div className="glass-card rounded-lg p-4 flex flex-wrap gap-3">
            <CreateCompanyDialog />
            <InviteUserDialog />
          </div>
        </section>
      )}
    </div>
  );
}
