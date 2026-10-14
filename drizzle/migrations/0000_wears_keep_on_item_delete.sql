ALTER TABLE public.wears DROP CONSTRAINT IF EXISTS wears_top_id_fkey;
ALTER TABLE public.wears DROP CONSTRAINT IF EXISTS wears_bottom_id_fkey;
ALTER TABLE public.wears ADD CONSTRAINT wears_top_id_fkey FOREIGN KEY (top_id) REFERENCES public.items(id) ON DELETE SET NULL;
ALTER TABLE public.wears ADD CONSTRAINT wears_bottom_id_fkey FOREIGN KEY (bottom_id) REFERENCES public.items(id) ON DELETE SET NULL;
COMMENT ON COLUMN public.wears.top_id IS 'NULL means the piece was deleted (shown as Purged clothing)';
COMMENT ON COLUMN public.wears.bottom_id IS 'NULL means the piece was deleted (shown as Purged clothing)';