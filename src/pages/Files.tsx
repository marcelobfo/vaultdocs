
import { useEffect, useMemo, useState } from "react";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import FolderTree from "@/components/files/FolderTree";
import FileList from "@/components/files/FileList";
import NewFolderDialog from "@/components/files/NewFolderDialog";
import UploadReportDialog from "@/components/files/UploadReportDialog";
import ManageServicesDialog from "@/components/services/ManageServicesDialog";

type CompanyRow = { id: string; name: string; branch: string | null; logo_url: string | null };

type FolderRow = { id: string; name: string; parent_id: string | null; company_id: string };
type ServiceRow = { id: string; name: string; active: boolean };
export default function Files() {
  const [file, setFile] = useState<File | null>(null);
  const [companyId, setCompanyId] = useState<string>("");
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [serviceId, setServiceId] = useState<string | null>(null);
  // Empresas (agora inclui logo_url)
  const { data: companies, isLoading: loadingCompanies, error: companiesError } = useQuery({
    queryKey: ["companies", "for-files"],
    queryFn: async (): Promise<CompanyRow[]> => {
      const { data, error } = await supabase
        .from("companies")
        .select("id,name,branch,logo_url")
        .order("name", { ascending: true });
      if (error) throw error;
      return data as CompanyRow[];
    },
  });

  // Papel do usuário na empresa (para habilitar criar pasta)
  const { data: myMembership } = useQuery({
    queryKey: ["me", "company-role", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<{ role: string } | null> => {
      const { data, error } = await supabase
        .from("user_companies")
        .select("role")
        .eq("company_id", companyId)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const isCompanyAdmin = (myMembership?.role === "company_admin");

  // Pastas da empresa
  const { data: folders, isLoading: loadingFolders, refetch: refetchFolders } = useQuery({
    queryKey: ["folders", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<FolderRow[]> => {
      const { data, error } = await supabase
        .from("folders")
        .select("id,name,parent_id,company_id")
        .eq("company_id", companyId)
        .order("name", { ascending: true });
      if (error) throw error;
      return data as FolderRow[];
    },
  });

  // Serviços ativos da empresa
  const { data: services, isLoading: loadingServices, refetch: refetchServices } = useQuery({
    queryKey: ["services", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<ServiceRow[]> => {
      const { data, error } = await (supabase as any)
        .from("services")
        .select("id,name,active")
        .eq("company_id", companyId)
        .eq("active", true)
        .order("name", { ascending: true });
      if (error) throw error;
      return data as ServiceRow[];
    },
  });

  // Arquivos da pasta selecionada
  const { data: files, isLoading: loadingFiles, refetch: refetchFiles } = useQuery({
    queryKey: ["files", companyId, selectedFolderId],
    enabled: !!companyId,
    queryFn: async () => {
      const b = supabase
        .from("files")
        .select("id,name,mime_type,size,created_at,expires_at,storage_path,folder_id,company_id")
        .eq("company_id", companyId);
      // Se root (selectedFolderId null), consideramos registros antigos com folder_id nulo
      const query = selectedFolderId
        ? b.eq("folder_id", selectedFolderId)
        : b.is("folder_id", null); // arquivos sem pasta
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const selectedCompany = useMemo(
    () => (companies ?? []).find((c) => c.id === companyId) || null,
    [companies, companyId]
  );

  useEffect(() => {
    let t: number | undefined;
    if (uploading && progress < 90) {
      t = window.setInterval(() => setProgress((p) => Math.min(90, p + 5)), 200);
    }
    return () => clearInterval(t);
  }, [uploading, progress]);

  async function upload() {
    if (!file) {
      toast({ title: "Selecione um arquivo", description: "Escolha um arquivo para enviar." });
      return;
    }
    if (!companyId) {
      toast({ title: "Selecione a empresa", description: "Escolha a empresa de destino." });
      return;
    }
    if (!expiresAt) {
      toast({ title: "Validade obrigatória", description: "Defina a data de expiração do arquivo." });
      return;
    }

    setUploading(true);
    setProgress(10);

    // Obtém usuário atual para preencher created_by
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id;
    if (!uid) {
      toast({ title: "Sessão inválida", description: "Faça login novamente." });
      setUploading(false);
      return;
    }

    // Monta path incluindo pasta (se houver) para organização no Storage
    const uuid = crypto.randomUUID();
    const safeName = file.name.replace(/\s+/g, "_");
    const folderSegment = selectedFolderId ?? "root";
    const path = `${companyId}/${folderSegment}/${uuid}_${safeName}`;

    const expiresAtISO = new Date(`${expiresAt}T23:59:59`).toISOString();

    // Envio ao Storage
    const { error: uploadErr } = await supabase.storage
      .from("documents")
      .upload(path, file, { cacheControl: "3600", contentType: file.type });

    if (uploadErr) {
      setUploading(false);
      toast({ title: "Erro no upload", description: uploadErr.message });
      return;
    }

    setProgress(95);

    // Registro na tabela files
    const { error: insertErr } = await supabase.from("files").insert([
      {
        company_id: companyId,
        bucket_id: "documents",
        storage_path: path,
        name: file.name,
        mime_type: file.type || null,
        size: file.size,
        created_by: uid,
        permission_scope: "company",
        expires_at: expiresAtISO,
        folder_id: selectedFolderId, // associa à pasta
        service_id: serviceId, // associa ao serviço selecionado (pode ser null)
      },
    ]);

    if (insertErr) {
      toast({ title: "Erro ao registrar", description: insertErr.message });
      setUploading(false);
      return;
    }

    setProgress(100);
    toast({ title: "Upload concluído", description: "Seu arquivo foi enviado e registrado." });
    setFile(null);
    setUploading(false);
    refetchFiles();
  }

  async function createFolder(name: string, parentId: string | null) {
    if (!companyId) return;
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id ?? null;

    const { error } = await supabase.from("folders").insert([
      {
        company_id: companyId,
        name,
        parent_id: parentId,
        created_by: uid,
      },
    ]);

    if (error) {
      toast({ title: "Não foi possível criar a pasta", description: error.message });
      return;
    }
    toast({ title: "Pasta criada", description: "A nova pasta foi adicionada." });
    refetchFolders();
  }

  return (
    <div>
      <SEO title="Arquivos | VaultDocs" description="Gerencie e faça upload de documentos." />
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Arquivos</h1>
        <UploadReportDialog companyId={companyId || null} />
      </div>

      <div className="glass-card rounded-lg p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Coluna de pastas */}
          <div className="lg:col-span-1">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-medium">Pastas</h2>
              {isCompanyAdmin && (
                <NewFolderDialog
                  onCreate={async (name) => createFolder(name, selectedFolderId)}
                  trigger={<Button size="sm" variant="outline">Nova pasta</Button>}
                />
              )}
            </div>

            {loadingCompanies || !companyId ? (
              <p className="text-sm text-muted-foreground">
                {loadingCompanies ? "Carregando empresas..." : "Selecione uma empresa."}
              </p>
            ) : loadingFolders ? (
              <p className="text-sm text-muted-foreground">Carregando pastas...</p>
            ) : (
              <FolderTree
                folders={(folders ?? []).map((f) => ({ id: f.id, name: f.name, parent_id: f.parent_id }))}
                selectedId={selectedFolderId}
                onSelect={setSelectedFolderId}
                onCreateClick={isCompanyAdmin ? (parentId) => createFolder("Nova pasta", parentId) : undefined}
                canCreate={isCompanyAdmin}
                rootLabel="Raiz"
              />
            )}
          </div>

          {/* Coluna principal */}
          <div className="lg:col-span-3 space-y-4">
            {/* Linha superior com seleção de empresa + logo + validade + input arquivo + botão enviar */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Empresa</label>
                <div className="flex items-center gap-3">
                  {selectedCompany?.logo_url ? (
                    <img
                      src={selectedCompany.logo_url}
                      alt={selectedCompany.name}
                      className="h-8 w-8 rounded object-cover border"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">
                      —
                    </div>
                  )}
                  <Select value={companyId} onValueChange={(v) => { setCompanyId(v); setSelectedFolderId(null); setServiceId(null); }} disabled={loadingCompanies || !!companiesError}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={loadingCompanies ? "Carregando..." : "Selecione a empresa"} />
                    </SelectTrigger>
                    <SelectContent>
                      {(companies ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} {c.branch ? `- ${c.branch}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
</Select>
                  {isCompanyAdmin && companyId && (
                    <div className="mt-2">
                      <ManageServicesDialog companyId={companyId} isAdmin={isCompanyAdmin} onChanged={() => refetchServices?.()} />
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Validade (expiração)</label>
                <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
              </div>

<div className="space-y-2">
                <label className="text-sm text-muted-foreground">Serviço</label>
                <Select value={serviceId ?? ""} onValueChange={(v) => setServiceId(v)} disabled={!companyId || loadingServices || ((services?.length ?? 0) === 0)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={loadingServices ? "Carregando..." : ((services?.length ?? 0) === 0 ? "Nenhum serviço disponível" : "Selecione o serviço")} />
                  </SelectTrigger>
                  <SelectContent>
                    {(services ?? []).map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Arquivo</label>
                <Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                <p className="text-xs text-muted-foreground">
                  Envia para: {selectedFolderId ? "pasta selecionada" : "raiz"} da empresa
                </p>
              </div>

              <div className="flex items-end">
                <Button onClick={upload} disabled={!file || !companyId || uploading} variant="hero" className="w-full">
                  {uploading ? "Enviando..." : "Enviar"}
                </Button>
              </div>
            </div>

            {uploading && (
              <div>
                <Progress value={progress} />
                <p className="text-xs text-muted-foreground mt-2">Carregando...</p>
              </div>
            )}

            {!uploading && !file && (
              <p className="text-sm text-muted-foreground">
                {selectedCompany
                  ? `Pronto para enviar para: ${selectedCompany.name}${selectedCompany.branch ? " - " + selectedCompany.branch : ""}.`
                  : "Nenhum arquivo selecionado."}
              </p>
            )}

            {/* Lista de arquivos da pasta */}
            <div>
              <h2 className="text-sm font-medium mb-2">Arquivos nesta pasta</h2>
              {loadingFiles ? (
                <p className="text-sm text-muted-foreground">Carregando arquivos...</p>
              ) : (
                <FileList files={(files ?? []) as any} />
              )}
            </div>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground mt-3">
        Observação: Apenas super administradores e administradores da empresa podem enviar arquivos e criar pastas.
        Leitores visualizam os arquivos permitidos conforme as regras de acesso.
      </p>
    </div>
  );
}
