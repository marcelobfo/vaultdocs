
import { useEffect, useState } from "react";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { getUser, signOut } from "@/lib/auth";
import RequestAccessForm from "@/components/profile/RequestAccessForm";
import AccountRequestsAdmin from "@/components/admin/AccountRequestsAdmin";
import PromoteSuperAdminDialog from "@/components/admin/PromoteSuperAdminDialog";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";

export default function Profile() {
  const [email, setEmail] = useState<string | null>(null);
  const isSuperAdmin = useIsSuperAdmin();

  useEffect(() => {
    getUser().then(({ user }) => setEmail(user?.email ?? null));
  }, []);

  async function logout() {
    await signOut();
    window.location.href = "/login";
  }

  return (
    <div>
      <SEO title="Perfil | VaultDocs" description="Gerencie seus dados de perfil." />
      <h1 className="text-2xl font-semibold mb-4">Perfil</h1>
      <div className="glass-card rounded-lg p-6 mb-6">
        <p className="text-sm text-muted-foreground mb-4">E-mail</p>
        <p className="text-lg font-medium">{email ?? "—"}</p>
        <Button className="mt-6" variant="outline" onClick={logout}>Sair</Button>
      </div>

      {/* Formulário para usuários solicitarem acesso */}
      <RequestAccessForm />

      {/* Super Admin: Adicionar outros super admins */}
      {isSuperAdmin && (
        <div className="glass-card rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Gerenciar Super Admins</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Adicione outros usuários como super administradores do sistema.
          </p>
          <PromoteSuperAdminDialog />
        </div>
      )}

      {/* Painel de aprovação para super administradores */}
      <div className="mt-6">
        <AccountRequestsAdmin />
      </div>
    </div>
  );
}
