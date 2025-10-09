
-- 1) Garantir tipo ENUM para Tipo de Inspeção
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inspection_type') THEN
    CREATE TYPE public.inspection_type AS ENUM (
      'tanques',
      'vasos_de_pressao',
      'tubulacoes',
      'ensaio_nao_destrutivo',
      'outros'
    );
  END IF;
END
$$;

-- Se a coluna files.inspection ainda não for desse tipo, converte.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='files'
      AND column_name='inspection'
      AND udt_name <> 'inspection_type'
  ) THEN
    ALTER TABLE public.files
      ALTER COLUMN inspection TYPE public.inspection_type
      USING (
        CASE
          WHEN inspection::text IN ('tanques','vasos_de_pressao','tubulacoes','ensaio_nao_destrutivo','outros')
            THEN inspection::text::public.inspection_type
          ELSE NULL
        END
      );
  ELSIF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='files'
      AND column_name='inspection'
  ) THEN
    ALTER TABLE public.files
      ADD COLUMN inspection public.inspection_type;
  END IF;
END
$$;

-- Índices úteis para listagens/relatórios
CREATE INDEX IF NOT EXISTS idx_files_company_folder ON public.files (company_id, folder_id);
CREATE INDEX IF NOT EXISTS idx_files_created_at ON public.files (created_at);

-- 2) Bucket público para logos das empresas
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-logos', 'company-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas do bucket company-logos
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'company-logos: public read') THEN
    DROP POLICY "company-logos: public read" ON storage.objects;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'company-logos: admins write') THEN
    DROP POLICY "company-logos: admins write" ON storage.objects;
  END IF;
END
$$;

CREATE POLICY "company-logos: public read"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'company-logos');

CREATE POLICY "company-logos: admins write"
  ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'company-logos'
    AND (public.has_role(auth.uid(), 'super_admin'::app_role)
         OR public.is_company_admin(public.object_company_id(name)))
  )
  WITH CHECK (
    bucket_id = 'company-logos'
    AND (public.has_role(auth.uid(), 'super_admin'::app_role)
         OR public.is_company_admin(public.object_company_id(name)))
  );
