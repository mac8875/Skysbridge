-- Sky's Bridge Version 22: memorial dates
alter table public.memorials add column if not exists birth_date date;
alter table public.memorials add column if not exists passing_date date;

comment on column public.memorials.birth_date is 'Optional date of birth used for the annual birthday sparkle.';
comment on column public.memorials.passing_date is 'Optional date of passing used for the annual remembrance candle.';
