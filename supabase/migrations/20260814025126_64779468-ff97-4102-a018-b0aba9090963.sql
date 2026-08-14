CREATE TABLE public.items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('top','bottom')),
  color TEXT NOT NULL DEFAULT 'neutral',
  pattern TEXT NOT NULL DEFAULT 'solid',
  image_path TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','seasonal','special','sell','unloved')),
  last_worn_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.items TO authenticated;
GRANT ALL ON public.items TO service_role;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own items" ON public.items FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX items_user_idx ON public.items(user_id, category, status);

CREATE TABLE public.outfits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  top_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  bottom_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  suggested_on DATE NOT NULL DEFAULT CURRENT_DATE,
  rating SMALLINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, suggested_on, top_id, bottom_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.outfits TO authenticated;
GRANT ALL ON public.outfits TO service_role;
ALTER TABLE public.outfits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own outfits" ON public.outfits FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.item_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  value SMALLINT NOT NULL CHECK (value IN (-1, 1)),
  day DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_id, day, value)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.item_feedback TO authenticated;
GRANT ALL ON public.item_feedback TO service_role;
ALTER TABLE public.item_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own feedback" ON public.item_feedback FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.wears (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  top_id UUID REFERENCES public.items(id) ON DELETE CASCADE,
  bottom_id UUID REFERENCES public.items(id) ON DELETE CASCADE,
  worn_on DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wears TO authenticated;
GRANT ALL ON public.wears TO service_role;
ALTER TABLE public.wears ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own wears" ON public.wears FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX wears_user_date_idx ON public.wears(user_id, worn_on DESC);

CREATE TABLE public.unloved_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  reviewed_on DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.unloved_reviews TO authenticated;
GRANT ALL ON public.unloved_reviews TO service_role;
ALTER TABLE public.unloved_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own reviews" ON public.unloved_reviews FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;
CREATE TRIGGER items_updated_at BEFORE UPDATE ON public.items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();