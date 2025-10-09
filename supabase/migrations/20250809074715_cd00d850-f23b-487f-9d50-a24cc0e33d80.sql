-- Create trigger to auto-create Root folder for each new company
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname = 'create_company_root_folder'
      AND n.nspname = 'public'
  ) THEN
    CREATE TRIGGER create_company_root_folder
    AFTER INSERT ON public.companies
    FOR EACH ROW
    EXECUTE FUNCTION public.create_root_folder();
  END IF;
END
$$;