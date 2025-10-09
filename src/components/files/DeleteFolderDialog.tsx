import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface DeleteFolderDialogProps {
  folderId: string;
  folderName: string;
  companyId: string;
}

export default function DeleteFolderDialog({
  folderId,
  folderName,
  companyId,
}: DeleteFolderDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleDelete = async () => {
    setLoading(true);

    try {
      // Buscar todos os arquivos da pasta recursivamente
      const { data: files, error: filesError } = await supabase
        .from("files")
        .select("id, storage_path, bucket_id")
        .eq("folder_id", folderId);

      if (filesError) throw filesError;

      // Deletar arquivos do storage
      if (files && files.length > 0) {
        for (const file of files) {
          const { error: storageError } = await supabase.storage
            .from(file.bucket_id)
            .remove([file.storage_path]);

          if (storageError) {
            console.error("Error deleting file from storage:", storageError);
          }
        }

        // Deletar registros de files
        const { error: deleteFilesError } = await supabase
          .from("files")
          .delete()
          .eq("folder_id", folderId);

        if (deleteFilesError) throw deleteFilesError;
      }

      // Buscar subpastas
      const { data: subfolders, error: subfoldersError } = await supabase
        .from("folders")
        .select("id")
        .eq("parent_id", folderId);

      if (subfoldersError) throw subfoldersError;

      // Deletar subpastas recursivamente
      if (subfolders && subfolders.length > 0) {
        for (const subfolder of subfolders) {
          // Recursivamente deletar cada subpasta
          const { error: deleteSubfolderError } = await supabase
            .from("folders")
            .delete()
            .eq("id", subfolder.id);

          if (deleteSubfolderError) throw deleteSubfolderError;
        }
      }

      // Deletar a pasta principal
      const { error: deleteFolderError } = await supabase
        .from("folders")
        .delete()
        .eq("id", folderId);

      if (deleteFolderError) throw deleteFolderError;

      toast({
        title: "Sucesso",
        description: `Pasta "${folderName}" excluída com sucesso!`,
      });

      queryClient.invalidateQueries({ queryKey: ["folders"] });
      queryClient.invalidateQueries({ queryKey: ["files"] });
      setOpen(false);
    } catch (error: any) {
      console.error("Error deleting folder:", error);
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação não pode ser desfeita. Isso irá excluir permanentemente a pasta{" "}
            <strong>"{folderName}"</strong> e todos os arquivos e subpastas dentro dela.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={loading}>
            {loading ? "Excluindo..." : "Excluir Pasta"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
