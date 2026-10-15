alter table public.shifts
  add column if not exists pause_minutes integer not null default 0;

alter table public.shifts
  add constraint pause_valide check (
    pause_minutes >= 0
    and pause_minutes * 60 < extract(epoch from (fin - debut))
  );
