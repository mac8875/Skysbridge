CREATE OR REPLACE FUNCTION public.guard_approved_memorial_style_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
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
