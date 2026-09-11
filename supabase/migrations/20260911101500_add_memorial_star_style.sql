alter table public.memorials
  add column if not exists star_style text not null default 'radiant';

alter table public.memorials
  drop constraint if exists memorials_star_style_check;

alter table public.memorials
  add constraint memorials_star_style_check
  check (star_style in ('radiant', 'classic', 'guiding', 'halo'));

comment on column public.memorials.star_style is
  'Family-selected visual style for the memorial star.';
