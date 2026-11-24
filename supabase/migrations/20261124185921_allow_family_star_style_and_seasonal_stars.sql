ALTER TABLE public.memorials
  DROP CONSTRAINT IF EXISTS memorials_star_style_check;

ALTER TABLE public.memorials
  ADD CONSTRAINT memorials_star_style_check
  CHECK (star_style IN (
    'radiant', 'classic', 'guiding', 'halo', 'signature', 'comet', 'petal', 'north',
    'morning', 'evening', 'heart', 'spark', 'christmas', 'snow'
  ));

DROP POLICY IF EXISTS "Owners can update their active memorial star style" ON public.memorials;
CREATE POLICY "Owners can update their active memorial star style"
ON public.memorials
FOR UPDATE TO authenticated
USING (
  (SELECT auth.uid()) = user_id
  AND archived = false
  AND rejection_reason IS NULL
  AND ((SELECT auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'true')
)
WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND archived = false
  AND rejection_reason IS NULL
  AND ((SELECT auth.jwt() ->> 'is_anonymous') IS DISTINCT FROM 'true')
);

CREATE OR REPLACE FUNCTION public.guard_approved_memorial_style_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF OLD.approved THEN
    IF auth.uid() IS DISTINCT FROM OLD.user_id
       OR auth.uid() IS DISTINCT FROM NEW.user_id
       OR (to_jsonb(NEW) - 'star_style') IS DISTINCT FROM (to_jsonb(OLD) - 'star_style') THEN
      RAISE EXCEPTION 'Approved memorials may only change star_style';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_approved_memorial_style_update ON public.memorials;
CREATE TRIGGER guard_approved_memorial_style_update
BEFORE UPDATE ON public.memorials
FOR EACH ROW
EXECUTE FUNCTION public.guard_approved_memorial_style_update();
