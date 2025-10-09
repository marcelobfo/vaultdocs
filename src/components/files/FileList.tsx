
import { useCallback } from "react";
import { Download, File as FileIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export type FileRow = {
  id: string;
  name: string;
  mime_type: string | null;
  size: number | null;
  created_at: string;
  expires_at: string;
  storage_path: string;
};

type Props = {
  files: FileRow[];
};

export default function FileList({ files }: Props) {
  const onDownload = useCallback(async (path: string) => {
    console.log("[download] creating signed url for:", path);
    const { data, error } = await supabase.storage
      .from("documents")
      .createSignedUrl(path, 60); // 60s

    if (error || !data?.signedUrl) {
      toast({
        title: "Falha ao gerar link",
        description: error?.message ?? "Não foi possível gerar o link de download.",
      });
      return;
    }
    window.open(data.signedUrl, "_blank");
  }, []);

  if (!files || files.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum arquivo nesta pasta.</p>;
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Arquivo</TableHead>
            <TableHead className="hidden md:table-cell">Tipo</TableHead>
            <TableHead className="hidden md:table-cell">Tamanho</TableHead>
            <TableHead className="hidden md:table-cell">Criado em</TableHead>
            <TableHead className="hidden md:table-cell">Expira em</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {files.map((f) => (
            <TableRow key={f.id}>
              <TableCell className="font-medium flex items-center gap-2">
                <FileIcon className="h-4 w-4 text-muted-foreground" />
                {f.name}
              </TableCell>
              <TableCell className="hidden md:table-cell text-muted-foreground">{f.mime_type ?? "—"}</TableCell>
              <TableCell className="hidden md:table-cell text-muted-foreground">
                {typeof f.size === "number" ? `${(f.size / 1024).toFixed(1)} KB` : "—"}
              </TableCell>
              <TableCell className="hidden md:table-cell text-muted-foreground">
                {new Date(f.created_at).toLocaleString()}
              </TableCell>
              <TableCell className="hidden md:table-cell text-muted-foreground">
                {new Date(f.expires_at).toLocaleDateString()}
              </TableCell>
              <TableCell className="text-right">
                <Button size="sm" variant="secondary" onClick={() => onDownload(f.storage_path)}>
                  <Download className="h-4 w-4 mr-2" />
                  Baixar
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
