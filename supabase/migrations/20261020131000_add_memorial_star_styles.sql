-- Keep the database allowlist in sync with the additional star shapes.
alter table public.memorials
  drop constraint if exists memorials_star_style_check;

alter table public.memorials
  add constraint memorials_star_style_check
  check (star_style = any (array[
    'radiant', 'classic', 'guiding', 'halo', 'signature',
    'comet', 'petal', 'north'
  ]::text[]));
