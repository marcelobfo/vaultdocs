import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Bell } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface NotificationSettingsDialogProps {
  companyId: string;
}

export default function NotificationSettingsDialog({ companyId }: NotificationSettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ["notification-settings", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_settings")
        .select("*")
        .eq("company_id", companyId)
        .maybeSingle();

      if (error) throw error;
      return data || {
        notify_expiration: true,
        notify_new_files: true,
        expiration_days_before: 7,
        webhook_url: "",
        webhook_secret: "",
        custom_message: "",
      };
    },
    enabled: open,
  });

  const [formData, setFormData] = useState({
    notify_expiration: settings?.notify_expiration ?? true,
    notify_new_files: settings?.notify_new_files ?? true,
    expiration_days_before: settings?.expiration_days_before ?? 7,
    webhook_url: settings?.webhook_url ?? "",
    webhook_secret: settings?.webhook_secret ?? "",
    custom_message: settings?.custom_message ?? "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from("notification_settings")
        .upsert({
          company_id: companyId,
          ...formData,
        });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Configurações de notificação salvas!",
      });

      queryClient.invalidateQueries({ queryKey: ["notification-settings"] });
      setOpen(false);
    } catch (error: any) {
      console.error("Error saving notification settings:", error);
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Bell className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurações de Notificação</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="notify_expiration">Notificar Expiração</Label>
            <Switch
              id="notify_expiration"
              checked={formData.notify_expiration}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, notify_expiration: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="notify_new_files">Notificar Novos Arquivos</Label>
            <Switch
              id="notify_new_files"
              checked={formData.notify_new_files}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, notify_new_files: checked })
              }
            />
          </div>

          <div>
            <Label htmlFor="expiration_days_before">Dias Antes da Expiração</Label>
            <Input
              id="expiration_days_before"
              type="number"
              min="1"
              max="365"
              value={formData.expiration_days_before}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  expiration_days_before: parseInt(e.target.value),
                })
              }
            />
          </div>

          <div>
            <Label htmlFor="custom_message">Mensagem Personalizada (Expiração)</Label>
            <Textarea
              id="custom_message"
              value={formData.custom_message}
              onChange={(e) =>
                setFormData({ ...formData, custom_message: e.target.value })
              }
              placeholder="Mensagem adicional para emails de expiração..."
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="webhook_url">Webhook URL</Label>
            <Input
              id="webhook_url"
              type="url"
              value={formData.webhook_url}
              onChange={(e) =>
                setFormData({ ...formData, webhook_url: e.target.value })
              }
              placeholder="https://seu-webhook.com/notificacoes"
            />
          </div>

          <div>
            <Label htmlFor="webhook_secret">Webhook Secret (HMAC)</Label>
            <Input
              id="webhook_secret"
              type="password"
              value={formData.webhook_secret}
              onChange={(e) =>
                setFormData({ ...formData, webhook_secret: e.target.value })
              }
              placeholder="Chave secreta para validação HMAC"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
