-- Rôle « cuisine » autorisé sur les profils (en plus de « employe » et « admin »).
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('employe', 'cuisine', 'admin'));
