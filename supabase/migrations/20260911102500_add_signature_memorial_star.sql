alter table public.memorials
  drop constraint if exists memorials_star_style_check;

alter table public.memorials
  add constraint memorials_star_style_check
  check (star_style in ('radiant', 'classic', 'guiding', 'halo', 'signature'));
