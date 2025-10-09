-- Tabela de configurações de notificações
CREATE TABLE IF NOT EXISTS public.notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  notify_expiration BOOLEAN DEFAULT true,
  notify_new_files BOOLEAN DEFAULT true,
  expiration_days_before INTEGER DEFAULT 7,
  webhook_url TEXT,
  webhook_secret TEXT,
  custom_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id)
);

-- RLS para notification_settings
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company admins manage notification settings"
ON public.notification_settings FOR ALL
USING (
  public.is_company_admin(company_id) OR public.has_role(auth.uid(), 'super_admin')
)
WITH CHECK (
  public.is_company_admin(company_id) OR public.has_role(auth.uid(), 'super_admin')
);

-- Tabela de logs de notificações
CREATE TABLE IF NOT EXISTS public.notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  file_id UUID REFERENCES public.files(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'sent',
  error_message TEXT
);

-- RLS para notification_logs
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company admins read notification logs"
ON public.notification_logs FOR SELECT
USING (
  public.is_company_admin(company_id) OR public.has_role(auth.uid(), 'super_admin')
);

-- Trigger para atualizar updated_at em notification_settings
CREATE TRIGGER set_notification_settings_updated_at
BEFORE UPDATE ON public.notification_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();