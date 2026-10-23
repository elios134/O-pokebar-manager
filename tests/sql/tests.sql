-- Vérifications de la base. Chaque test s'arrête net avec un message clair s'il échoue.
\set QUIET on
\o /dev/null
set client_min_messages = warning;

-- ---------- Outils de test ----------
create schema test;
grant usage on schema test to authenticated, anon;

create function test.verifier(ok boolean, quoi text) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'ÉCHEC : %', quoi; end if;
  raise notice 'ok  %', quoi;
end $$;

-- La commande doit être refusée (erreur ou aucune ligne touchée).
create function test.refuse(commande text, quoi text) returns void language plpgsql as $$
declare n bigint;
begin
  execute commande;
  get diagnostics n = row_count;
  if n > 0 then raise exception 'ÉCHEC (accepté alors qu''il devait être refusé) : %', quoi; end if;
  raise notice 'ok  %', quoi;
exception
  when raise_exception then
    if sqlerrm like 'ÉCHEC%' then raise; end if;
    raise notice 'ok  %', quoi;
  when others then
    raise notice 'ok  %', quoi;
end $$;

-- Se mettre à la place de quelqu'un (null = personne de connecté, en tant que « anon »).
create function test.connecte(qui uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(qui::text, ''), false);
end $$;

grant execute on all functions in schema test to authenticated, anon;
set client_min_messages = notice;

-- ---------- Données ----------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@test.fr', '{"prenom":"Ada","nom":"Admin"}'),
  ('00000000-0000-0000-0000-000000000001', 'lea@test.fr',   '{"prenom":"Léa","nom":"Martin"}'),
  ('00000000-0000-0000-0000-000000000002', 'tom@test.fr',   '{"prenom":"Tom","nom":"Petit"}');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a';

select test.verifier((select count(*) = 3 from public.profiles), 'un profil est créé pour chaque compte');
select test.verifier((select email = 'lea@test.fr' and prenom = 'Léa' from public.profiles
  where id = '00000000-0000-0000-0000-000000000001'), 'le profil reprend email, prénom et nom');

-- ---------- Personne de connecté ----------
set role anon;
select test.connecte(null);
select test.refuse('select * from public.profiles', 'un visiteur non connecté ne lit pas les profils');
select test.refuse('select * from public.shifts', 'un visiteur non connecté ne lit pas les horaires');
reset role;

-- ---------- Admin ----------
set role authenticated;
select test.connecte('00000000-0000-0000-0000-00000000000a');
insert into public.equipes (nom) values ('Cuisine');
update public.profiles set equipe_id = (select id from public.equipes)
  where id = '00000000-0000-0000-0000-000000000001';
select test.verifier((select equipe_id is not null from public.profiles
  where id = '00000000-0000-0000-0000-000000000001'), 'l''admin range un employé dans une équipe');

insert into public.shifts (employe_id, debut, fin, pause_debut, pause_fin) values
  ('00000000-0000-0000-0000-000000000001', now() + interval '1 day', now() + interval '1 day 8 hours',
   now() + interval '1 day 3 hours', now() + interval '1 day 3 hours 30 minutes'),
  ('00000000-0000-0000-0000-000000000002', now() + interval '1 day', now() + interval '1 day 6 hours', null, null);
select test.verifier((select pause_minutes = 30 from public.shifts
  where employe_id = '00000000-0000-0000-0000-000000000001'), 'la durée de pause est calculée toute seule');
select test.verifier((select pause_minutes = 0 from public.shifts
  where employe_id = '00000000-0000-0000-0000-000000000002'), 'un horaire sans pause est accepté');
select test.refuse($$insert into public.shifts (employe_id, debut, fin) values
  ('00000000-0000-0000-0000-000000000001', now(), now() - interval '1 hour')$$, 'un horaire qui finit avant de commencer est refusé');
select test.refuse($$insert into public.shifts (employe_id, debut, fin, pause_debut, pause_fin) values
  ('00000000-0000-0000-0000-000000000001', now(), now() + interval '2 hours', now() + interval '3 hours', now() + interval '4 hours')$$,
  'une pause en dehors du service est refusée');
select test.refuse($$update public.profiles set role = 'employe' where id = '00000000-0000-0000-0000-00000000000a'$$,
  'l''admin ne peut pas se retirer son propre rôle');
select test.refuse($$update public.profiles set actif = false where id = '00000000-0000-0000-0000-00000000000a'$$,
  'l''admin ne peut pas se désactiver lui-même');
update public.profiles set email = 'pirate@test.fr' where id = '00000000-0000-0000-0000-000000000001';
select test.verifier((select email = 'lea@test.fr' from public.profiles
  where id = '00000000-0000-0000-0000-000000000001'), 'l''email du profil ne se change pas depuis le site');
reset role;

-- ---------- Employé ----------
set role authenticated;
select test.connecte('00000000-0000-0000-0000-000000000001');
select test.verifier((select count(*) = 1 from public.profiles), 'un employé ne voit que son propre profil');
select test.verifier((select count(*) = 1 from public.shifts), 'un employé ne voit que ses propres horaires');
select test.verifier((select count(*) >= 1 from public.notifications where titre = 'Nouvel horaire'),
  'l''employé reçoit une notification pour son nouvel horaire');
select test.refuse($$insert into public.shifts (employe_id, debut, fin) values
  ('00000000-0000-0000-0000-000000000001', now(), now() + interval '1 hour')$$, 'un employé ne crée pas d''horaire');
select test.refuse('update public.shifts set fin = fin + interval ''1 hour''', 'un employé ne modifie pas ses horaires');
select test.refuse('delete from public.shifts', 'un employé ne supprime pas d''horaire');
select test.refuse($$update public.profiles set role = 'admin'$$, 'un employé ne se donne pas le rôle admin');
select test.refuse($$insert into public.equipes (nom) values ('Pirates')$$, 'un employé ne crée pas d''équipe');
select test.refuse('update public.notifications set titre = ''faux''', 'seule la case « lue » d''une notification se modifie');
update public.notifications set lue = true;
select test.verifier((select bool_and(lue) from public.notifications), 'un employé marque ses notifications comme lues');

-- Congés
insert into public.conges (employe_id, debut, fin, motif)
  values ('00000000-0000-0000-0000-000000000001', current_date + 10, current_date + 12, 'Vacances');
select test.refuse($$insert into public.conges (employe_id, debut, fin)
  values ('00000000-0000-0000-0000-000000000002', current_date + 10, current_date + 12)$$, 'un employé ne demande pas de congé pour un autre');
select test.refuse($$insert into public.conges (employe_id, debut, fin, statut)
  values ('00000000-0000-0000-0000-000000000001', current_date + 20, current_date + 21, 'accepte')$$, 'un employé ne s''accorde pas un congé');
select test.refuse($$update public.conges set statut = 'accepte'$$, 'un employé ne valide pas sa propre demande');

-- Échanges d'horaires retirés
select test.verifier(to_regclass('public.echanges') is null, 'la table des échanges n''existe plus');
reset role;

-- ---------- Réponse de l'admin aux congés ----------
set role authenticated;
select test.connecte('00000000-0000-0000-0000-00000000000a');
select test.verifier((select count(*) = 1 from public.notifications where titre = 'Demande de congé'),
  'l''admin est prévenu d''une demande de congé');
update public.conges set statut = 'accepte', reponse = 'Bonnes vacances';
select test.verifier((select traite_par = '00000000-0000-0000-0000-00000000000a' and traite_le is not null
  from public.conges), 'la réponse garde qui a répondu et quand');
reset role;
select test.verifier((select count(*) = 1 from public.notifications
  where destinataire_id = '00000000-0000-0000-0000-000000000001' and titre = 'Congé accepté'),
  'l''employé est prévenu que son congé est accepté');

set role authenticated;
select test.connecte('00000000-0000-0000-0000-000000000001');
select test.refuse('delete from public.conges', 'un employé ne retire pas un congé déjà accepté');
reset role;

-- ---------- Grille rapide ----------
set role authenticated;
select test.connecte('00000000-0000-0000-0000-00000000000a');
select test.verifier((select count(*) = 5 from public.modeles_horaires), 'l''admin voit les horaires types de départ');
select test.refuse($$insert into public.modeles_horaires (nom, code, creneaux) values ('Trop', 'O', '[{"debut":"9:00","fin":"10:00"}]')$$,
  'deux horaires types ne peuvent pas avoir la même lettre');
select test.refuse($$insert into public.modeles_horaires (nom, code, creneaux) values ('Vide', 'V', '[]')$$,
  'un horaire type a au moins un créneau');
-- Case de Tom demain : son horaire est remplacé par une coupure (2 créneaux).
select public.remplir_grille(jsonb_build_array(jsonb_build_object(
  'employe_id', '00000000-0000-0000-0000-000000000002',
  'de', date_trunc('day', now() + interval '1 day'), 'a', date_trunc('day', now() + interval '2 days'),
  'horaires', jsonb_build_array(
    jsonb_build_object('debut', date_trunc('day', now() + interval '1 day') + interval '11 hours',
                       'fin', date_trunc('day', now() + interval '1 day') + interval '15 hours'),
    jsonb_build_object('debut', date_trunc('day', now() + interval '1 day') + interval '18 hours',
                       'fin', date_trunc('day', now() + interval '1 day') + interval '22 hours',
                       'pause_debut', date_trunc('day', now() + interval '1 day') + interval '20 hours',
                       'pause_fin', date_trunc('day', now() + interval '1 day') + interval '20 hours 15 minutes',
                       'note', ' Inventaire ')))));
select test.verifier((select count(*) = 1 from public.shifts where employe_id = '00000000-0000-0000-0000-000000000002' and note = 'Inventaire'),
  'la grille enregistre la note d''un horaire');
select test.verifier((select count(*) = 2 and sum(pause_minutes) = 15 from public.shifts
  where employe_id = '00000000-0000-0000-0000-000000000002'), 'la grille remplace un horaire par une coupure');
select test.refuse($$select public.remplir_grille(jsonb_build_array(jsonb_build_object(
  'employe_id', '00000000-0000-0000-0000-000000000002',
  'de', date_trunc('day', now() + interval '1 day'), 'a', date_trunc('day', now() + interval '2 days'),
  'horaires', jsonb_build_array(
    jsonb_build_object('debut', date_trunc('day', now() + interval '1 day') + interval '9 hours',
                       'fin', date_trunc('day', now() + interval '1 day') + interval '12 hours'),
    jsonb_build_object('debut', date_trunc('day', now() + interval '1 day') + interval '13 hours',
                       'fin', date_trunc('day', now() + interval '1 day') + interval '12 hours')))))$$,
  'une grille avec une erreur est refusée en entier');
select test.verifier((select count(*) = 2 and min(extract(hour from debut at time zone current_setting('TimeZone'))) = 11
  from public.shifts where employe_id = '00000000-0000-0000-0000-000000000002'), 'après un refus, rien n''a changé');
select public.remplir_grille(jsonb_build_array(jsonb_build_object(
  'employe_id', '00000000-0000-0000-0000-000000000002',
  'de', date_trunc('day', now() + interval '1 day'), 'a', date_trunc('day', now() + interval '2 days'),
  'horaires', '[]'::jsonb)));
select test.verifier((select count(*) = 0 from public.shifts where employe_id = '00000000-0000-0000-0000-000000000002'),
  'vider une case supprime les horaires du jour');
reset role;

set role authenticated;
select test.connecte('00000000-0000-0000-0000-000000000001');
select test.verifier((select count(*) = 0 from public.modeles_horaires), 'un employé ne voit pas les horaires types');
select test.refuse($$insert into public.modeles_horaires (nom, code, creneaux) values ('X', 'X', '[{"debut":"9:00","fin":"10:00"}]')$$,
  'un employé ne crée pas d''horaire type');
select test.refuse($$select public.remplir_grille('[]'::jsonb)$$, 'un employé ne peut pas utiliser la grille');
reset role;

-- ---------- Contrat et semaine type ----------
set role authenticated;
select test.connecte('00000000-0000-0000-0000-00000000000a');
update public.profiles set heures_contrat = 35,
  semaine_type = '[[{"debut":"10:00","fin":"15:00"}],[],[],[],[],[],[]]'
  where id = '00000000-0000-0000-0000-000000000002';
select test.verifier((select heures_contrat = 35 and jsonb_array_length(semaine_type) = 7 from public.profiles
  where id = '00000000-0000-0000-0000-000000000002'), 'l''admin enregistre le contrat et la semaine type');
select test.refuse($$update public.profiles set semaine_type = '[[]]' where id = '00000000-0000-0000-0000-000000000002'$$,
  'une semaine type a toujours 7 jours');
select test.refuse($$update public.profiles set heures_contrat = 90 where id = '00000000-0000-0000-0000-000000000002'$$,
  'un contrat de plus de 60 h est refusé');
reset role;
set role authenticated;
select test.connecte('00000000-0000-0000-0000-000000000001');
select test.refuse($$update public.profiles set heures_contrat = 10 where id = '00000000-0000-0000-0000-000000000001'$$,
  'un employé ne change pas son contrat');
reset role;

-- ---------- Notifications sur téléphone ----------
insert into vault.decrypted_secrets values ('push_url', 'https://exemple.test/envoyer-push'), ('push_cle', 'cle-secrete');
set role authenticated;
select test.connecte('00000000-0000-0000-0000-000000000001');
select public.enregistrer_abonnement_push('https://push.exemple/abc', 'cleP', 'cleA');
select test.verifier((select count(*) = 1 from public.abonnements_push), 'un employé enregistre son téléphone');
select test.refuse($$insert into public.abonnements_push (profil_id, endpoint, p256dh, auth)
  values ('00000000-0000-0000-0000-000000000001', 'https://push.exemple/x', 'a', 'b')$$, 'pas d''ajout direct dans la table');
select test.refuse($$select public.enregistrer_abonnement_push('http://pas-https', 'a', 'b')$$, 'adresse non sécurisée refusée');
reset role;
-- Le même téléphone passe sur le compte de l'admin : il change de propriétaire.
set role authenticated;
select test.connecte('00000000-0000-0000-0000-00000000000a');
select test.verifier((select count(*) = 0 from public.abonnements_push), 'l''admin ne voit pas les appareils des autres');
select public.retirer_abonnement_push('https://push.exemple/abc');
reset role;
select test.verifier((select count(*) = 1 from public.abonnements_push), 'on ne peut pas retirer l''appareil de quelqu''un d''autre');
set role authenticated;
select test.connecte('00000000-0000-0000-0000-00000000000a');
select public.enregistrer_abonnement_push('https://push.exemple/abc', 'cleP2', 'cleA2');
reset role;
select test.verifier((select profil_id = '00000000-0000-0000-0000-00000000000a' and p256dh = 'cleP2' from public.abonnements_push),
  'un appareil réutilisé change de compte');
-- Une notification pour l'admin déclenche l'envoi ; pour Léa (plus d'appareil), rien.
delete from net.appels;
select prive.notifier('00000000-0000-0000-0000-00000000000a', 'Essai', 'Texte', '/admin/planning');
select prive.notifier('00000000-0000-0000-0000-000000000001', 'Essai', 'Texte', '/mon-planning');
select test.verifier((select count(*) = 1 and bool_and(headers->>'x-cle-push' = 'cle-secrete' and url = 'https://exemple.test/envoyer-push') from net.appels),
  'une notification part vers le téléphone de son destinataire seulement');
-- Si l'envoi plante, la notification (et donc le planning) est quand même enregistrée.
drop function net.http_post(text, jsonb, jsonb, jsonb, integer);
select prive.notifier('00000000-0000-0000-0000-00000000000a', 'Essai 2', null, null);
select test.verifier((select count(*) = 1 from public.notifications where titre = 'Essai 2'), 'un envoi raté ne bloque rien');
set role authenticated;
select test.connecte('00000000-0000-0000-0000-00000000000a');
select public.retirer_abonnement_push('https://push.exemple/abc');
reset role;
select test.verifier((select count(*) = 0 from public.abonnements_push), 'l''admin retire son appareil');
set role authenticated;
select test.connecte('00000000-0000-0000-0000-00000000000a');
select test.refuse('select * from public.cles_push()', 'même un admin ne lit pas les clés d''envoi');
reset role;

-- ---------- Acomptes ----------
set role authenticated;
select test.connecte('00000000-0000-0000-0000-000000000001');
insert into public.acomptes (employe_id, montant, motif) values ('00000000-0000-0000-0000-000000000001', 150, 'Réparation voiture');
select test.verifier((select count(*) = 1 from public.acomptes), 'un employé demande un acompte');
select test.refuse($$insert into public.acomptes (employe_id, montant) values ('00000000-0000-0000-0000-000000000001', 50)$$,
  'une seule demande d''acompte en attente à la fois');
select test.refuse($$insert into public.acomptes (employe_id, montant) values ('00000000-0000-0000-0000-000000000002', 50)$$,
  'pas de demande d''acompte pour un autre');
select test.refuse($$insert into public.acomptes (employe_id, montant) values ('00000000-0000-0000-0000-000000000001', -5)$$,
  'montant négatif refusé');
select test.refuse($$update public.acomptes set statut = 'accepte'$$, 'un employé ne valide pas son acompte');
reset role;
set role authenticated;
select test.connecte('00000000-0000-0000-0000-000000000002');
select test.verifier((select count(*) = 0 from public.acomptes), 'un employé ne voit pas les acomptes des autres');
reset role;
set role authenticated;
select test.connecte('00000000-0000-0000-0000-00000000000a');
select test.verifier((select count(*) = 1 from public.notifications where titre = 'Demande d''acompte' and texte like '%150,00 €'),
  'l''admin est prévenu d''une demande d''acompte');
update public.acomptes set statut = 'accepte', reponse = 'Versé vendredi', montant = 9999;
select test.verifier((select montant = 150 and traite_par = '00000000-0000-0000-0000-00000000000a' from public.acomptes),
  'acompte accepté : montant inchangé, qui a répondu est noté');
reset role;
select test.verifier((select count(*) = 1 from public.notifications where destinataire_id = '00000000-0000-0000-0000-000000000001'
  and titre = 'Acompte accepté' and texte like '150,00 € · « Versé vendredi »'), 'l''employé est prévenu de la réponse');
set role authenticated;
select test.connecte('00000000-0000-0000-0000-000000000001');
select test.refuse('delete from public.acomptes', 'un acompte accepté ne peut plus être retiré par l''employé');
insert into public.acomptes (employe_id, montant) values ('00000000-0000-0000-0000-000000000001', 80);
delete from public.acomptes where statut = 'en_attente';
select test.verifier((select count(*) = 1 from public.acomptes), 'l''employé retire une demande en attente');
reset role;

-- ---------- Congé saisi par l'admin ----------
set role authenticated;
select test.connecte('00000000-0000-0000-0000-00000000000a');
insert into public.conges (employe_id, debut, fin, motif, statut)
  values ('00000000-0000-0000-0000-000000000002', current_date + 30, current_date + 31, 'Arrêt maladie', 'accepte');
select test.verifier((select traite_par = '00000000-0000-0000-0000-00000000000a' and traite_le is not null
  from public.conges where motif = 'Arrêt maladie'), 'l''admin saisit un congé déjà accepté, signé de son nom');
reset role;
select test.verifier((select count(*) = 1 from public.notifications where destinataire_id = '00000000-0000-0000-0000-000000000002'
  and titre = 'Congé ajouté par votre responsable' and texte like '%Arrêt maladie'), 'l''employé est prévenu du congé saisi');
select test.verifier((select count(*) = 0 from public.notifications where titre = 'Demande de congé' and texte like 'Tom%'),
  'un congé saisi par l''admin n''apparaît pas comme une demande');
set role authenticated;
select test.connecte('00000000-0000-0000-0000-000000000001');
select test.refuse($$insert into public.conges (employe_id, debut, fin, statut)
  values ('00000000-0000-0000-0000-000000000002', current_date + 40, current_date + 41, 'accepte')$$,
  'un employé ne saisit pas de congé pour un autre');
reset role;

-- ---------- Vider ses notifications ----------
set role authenticated;
select test.connecte('00000000-0000-0000-0000-000000000001');
delete from public.notifications;
select test.verifier((select count(*) = 0 from public.notifications), 'un employé vide ses notifications');
reset role;
select test.verifier((select count(*) > 0 from public.notifications where destinataire_id <> '00000000-0000-0000-0000-000000000001'),
  'les notifications des autres ne sont pas effacées');

-- ---------- Acompte saisi par l'admin ----------
set role authenticated;
select test.connecte('00000000-0000-0000-0000-00000000000a');
insert into public.acomptes (employe_id, montant, motif, statut)
  values ('00000000-0000-0000-0000-000000000002', 60, 'Avance en liquide', 'accepte');
select test.verifier((select traite_par = '00000000-0000-0000-0000-00000000000a' and traite_le is not null
  from public.acomptes where motif = 'Avance en liquide'), 'l''admin saisit un acompte déjà accepté, signé de son nom');
reset role;
select test.verifier((select count(*) = 1 from public.notifications where destinataire_id = '00000000-0000-0000-0000-000000000002'
  and titre = 'Acompte ajouté par votre responsable' and texte = '60,00 € · Avance en liquide'), 'l''employé est prévenu de l''acompte saisi');
set role authenticated;
select test.connecte('00000000-0000-0000-0000-000000000001');
select test.refuse($$insert into public.acomptes (employe_id, montant, statut)
  values ('00000000-0000-0000-0000-000000000002', 10, 'accepte')$$, 'un employé ne saisit pas d''acompte pour un autre');
select test.refuse($$insert into public.acomptes (employe_id, montant, statut)
  values ('00000000-0000-0000-0000-000000000001', 10, 'accepte')$$, 'un employé ne s''accorde pas un acompte');
reset role;

-- ---------- Espace Cuisine ----------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000003', 'chef@test.fr', '{"prenom":"Chloé","nom":"Chef"}');
update public.profiles set role = 'cuisine' where id = '00000000-0000-0000-0000-000000000003';
select test.refuse($$update public.profiles set role = 'patron' where id = '00000000-0000-0000-0000-000000000003'$$, 'rôle inconnu refusé');

set role authenticated;
select test.connecte('00000000-0000-0000-0000-00000000000a');
insert into public.frigos (nom, temp_min, temp_max, ordre) values ('Frigo 1', 0, 4, 1), ('Congélateur', -25, -18, 2);
reset role;

set role authenticated;
select test.connecte('00000000-0000-0000-0000-000000000003');
insert into public.dlc_produits (nom, ouvert_le, dlc, photo) values ('Crème fraîche', current_date, current_date + 1, 'chef/creme.jpg');
select test.verifier((select count(*) = 1 and bool_and(ajoute_par = '00000000-0000-0000-0000-000000000003') from public.dlc_produits),
  'un cuisinier ajoute un produit DLC');
insert into storage.objects (bucket_id, name) values ('dlc', 'chef/creme.jpg');
select test.verifier((select count(*) = 1 from storage.objects), 'un cuisinier envoie une photo d''étiquette');
select test.refuse($$insert into public.frigos (nom) values ('Frigo pirate')$$, 'un cuisinier ne crée pas de frigo');
insert into public.releves_temperature (frigo_id, temperature) select id, 3.5 from public.frigos where nom = 'Frigo 1';
select test.verifier((select count(*) = 1 from public.releves_temperature), 'un cuisinier note une température');
select test.refuse($$insert into public.releves_temperature (frigo_id, temperature) select id, 2 from public.frigos where nom = 'Frigo 1'$$,
  'un seul relevé par frigo et par jour');
update public.releves_temperature set temperature = 7.5;
insert into public.commandes (produit, quantite) values ('Saumon', '3 kg');
select test.refuse($$insert into public.commandes (produit, statut) values ('Riz', 'recu')$$, 'une commande commence « à commander »');
select test.refuse($$update public.commandes set statut = 'commande'$$, 'seul l''admin coche « commandé »');
reset role;
select test.verifier((select count(*) = 1 from public.notifications where titre = 'Température hors limites' and texte like 'Frigo 1 : 7,5 °C%'),
  'température hors limites : l''admin est prévenu');
select test.verifier((select count(*) = 1 from public.notifications where titre = 'À commander' and texte like 'Saumon (3 kg)%'),
  'produit à commander : l''admin est prévenu');

-- Un employé « normal » ne voit rien de la cuisine.
update public.profiles set actif = true where id = '00000000-0000-0000-0000-000000000002';
set role authenticated;
select test.connecte('00000000-0000-0000-0000-000000000002');
select test.verifier((select count(*) = 0 from public.dlc_produits) and (select count(*) = 0 from public.frigos)
  and (select count(*) = 0 from public.commandes) and (select count(*) = 0 from storage.objects),
  'un employé sans rôle cuisine ne voit ni DLC, ni frigos, ni commandes, ni photos');
select test.refuse($$insert into public.dlc_produits (nom, dlc) values ('X', current_date)$$, 'un employé n''ajoute pas de DLC');
reset role;

set role authenticated;
select test.connecte('00000000-0000-0000-0000-00000000000a');
update public.commandes set statut = 'commande';
select test.verifier((select commande_le is not null from public.commandes), 'l''admin coche « commandé » (date notée)');
update public.commandes set statut = 'recu';
select test.verifier((select recu_le is not null and commande_le is not null from public.commandes), 'l''admin coche « reçu »');
reset role;

-- Rappels du jour
select prive.rappel_dlc();
select prive.rappel_temperatures();
select test.verifier((select count(*) = 1 from public.notifications where destinataire_id = '00000000-0000-0000-0000-000000000003'
  and titre = 'DLC à surveiller' and texte = '1 produit à utiliser aujourd''hui ou demain'), 'rappel DLC envoyé à la cuisine');
select test.verifier((select count(*) = 1 from public.notifications where destinataire_id = '00000000-0000-0000-0000-000000000003'
  and titre = 'Températures à relever' and texte = 'Congélateur'), 'rappel des frigos non relevés envoyé à la cuisine');

-- ---------- Arrêts maladie ----------
-- (Tom, employé, est actif ici ; Chloé est en cuisine)
set role authenticated;
select test.connecte('00000000-0000-0000-0000-000000000002');
insert into public.arrets_maladie (employe_id, debut, fin, message) values ('00000000-0000-0000-0000-000000000002', current_date, current_date + 4, 'papier demain');
select test.refuse($$insert into public.arrets_maladie (employe_id, debut, fin) values ('00000000-0000-0000-0000-000000000003', current_date, current_date)$$,
  'un employé ne déclare pas l''arrêt d''un autre');
insert into public.arrets_maladie (employe_id, debut, fin, recu_le) values ('00000000-0000-0000-0000-000000000002', current_date + 10, current_date + 10, now());
select test.verifier((select recu_le is null from public.arrets_maladie where debut = current_date + 10), 'un employé ne se marque pas « arrêt reçu »');
delete from public.arrets_maladie where debut = current_date + 10;
insert into storage.objects (bucket_id, name) values ('arrets', '00000000-0000-0000-0000-000000000002/arret.jpg');
select test.refuse($$insert into storage.objects (bucket_id, name) values ('arrets', '00000000-0000-0000-0000-000000000003/x.jpg')$$,
  'un employé ne dépose pas de fichier dans le dossier d''un autre');
update public.arrets_maladie set photo = '00000000-0000-0000-0000-000000000002/arret.jpg', fin = current_date + 30, recu_le = now();
select test.verifier((select photo is not null and fin = current_date + 4 and recu_le is null from public.arrets_maladie),
  'un employé ajoute la photo de son arrêt, sans changer les dates ni « reçu »');
reset role;
select test.verifier((select count(*) = 1 from public.notifications where titre = 'Arrêt maladie' and texte = 'Tom Petit : du ' || to_char(current_date, 'DD/MM') || ' au ' || to_char(current_date + 4, 'DD/MM') || ' (arrêt de travail à venir)'),
  'arrêt déclaré : l''admin est prévenu');
select test.verifier((select count(*) = 1 from public.notifications where titre = 'Arrêt de travail ajouté'),
  'photo de l''arrêt ajoutée : l''admin est prévenu');

set role authenticated;
select test.connecte('00000000-0000-0000-0000-000000000003');
select test.verifier((select count(*) = 0 from public.arrets_maladie) and (select count(*) = 0 from storage.objects where bucket_id = 'arrets'),
  'un collègue (même cuisine) ne voit ni l''arrêt ni sa photo');
select test.connecte('00000000-0000-0000-0000-00000000000a');
update public.arrets_maladie set recu_le = now();
select test.verifier((select recu_par = '00000000-0000-0000-0000-00000000000a' from public.arrets_maladie), 'l''admin coche « arrêt reçu »');
select test.verifier((select count(*) = 1 from storage.objects where bucket_id = 'arrets'), 'l''admin voit la photo de l''arrêt');
insert into public.arrets_maladie (employe_id, debut, fin) values ('00000000-0000-0000-0000-000000000003', current_date, current_date);
reset role;
select test.verifier((select count(*) = 1 from public.notifications where destinataire_id = '00000000-0000-0000-0000-000000000003'
  and titre = 'Arrêt maladie enregistré par votre responsable'), 'arrêt saisi par l''admin : l''employé est prévenu');
set role authenticated;
select test.connecte('00000000-0000-0000-0000-000000000002');
select test.refuse($$delete from public.arrets_maladie$$, 'un arrêt déjà reçu ne peut plus être retiré par l''employé');
reset role;

-- ---------- Compteur de congés ----------
update public.profiles set conges_depuis = date_trunc('month', current_date - interval '4 months')::date
  where id = '00000000-0000-0000-0000-000000000002';
insert into public.conges (employe_id, debut, fin, statut) values
  ('00000000-0000-0000-0000-000000000002', date '2030-06-03', date '2030-06-09', 'accepte'), -- lundi → dimanche : 6 jours ouvrables
  ('00000000-0000-0000-0000-000000000002', date '2030-07-01', date '2030-07-02', 'refuse');
set role authenticated;
select test.connecte('00000000-0000-0000-0000-00000000000a');
insert into public.conges_corrections (employe_id, jours, motif) values ('00000000-0000-0000-0000-000000000002', -1.25, 'Maladie 2 semaines');
select test.verifier((select acquis = 10 and pris = 7 and corrections = -1.25 and restant = 1.75
  from public.soldes_conges() where employe_id = '00000000-0000-0000-0000-000000000002'),
  'solde calculé : 4 mois × 2,5 − 7 jours pris (1 + 6) − 1,25 de correction, congé refusé ignoré');
select test.verifier(prive.jours_ouvrables('2030-06-03', '2030-06-09') = 6, 'une semaine de congé = 6 jours ouvrables (dimanche exclu)');
select test.verifier((select count(*) >= 3 from public.soldes_conges()), 'l''admin voit les soldes de tous');
select test.connecte('00000000-0000-0000-0000-000000000002');
select test.verifier((select count(*) = 1 and bool_and(employe_id = '00000000-0000-0000-0000-000000000002') from public.soldes_conges()),
  'un employé ne voit que son solde');
select test.refuse($$insert into public.conges_corrections (employe_id, jours, motif) values ('00000000-0000-0000-0000-000000000002', 10, 'cadeau')$$,
  'un employé ne corrige pas son solde');
select test.refuse($$update public.profiles set conges_depuis = '2000-01-01' where id = '00000000-0000-0000-0000-000000000002'$$,
  'un employé ne change pas la date de départ de son compteur');
reset role;
select test.verifier((select count(*) = 1 from public.notifications where titre = 'Solde de congés corrigé' and texte = '-1,25 j · Maladie 2 semaines'),
  'correction du solde : l''employé est prévenu');

-- ---------- Documents ----------
set role authenticated;
select test.connecte('00000000-0000-0000-0000-00000000000a');
insert into storage.objects (bucket_id, name) values ('documents', '00000000-0000-0000-0000-000000000002/paie-09.pdf');
insert into public.documents (employe_id, type, titre, mois, chemin)
  values ('00000000-0000-0000-0000-000000000002', 'paie', 'Fiche de paie · septembre 2026', '2026-09-01', '00000000-0000-0000-0000-000000000002/paie-09.pdf');
select test.connecte('00000000-0000-0000-0000-000000000003');
select test.verifier((select count(*) = 0 from public.documents) and (select count(*) = 0 from storage.objects where bucket_id = 'documents'),
  'un collègue ne voit pas les documents d''un autre');
select test.connecte('00000000-0000-0000-0000-000000000002');
select test.verifier((select count(*) = 1 from public.documents) and (select count(*) = 1 from storage.objects where bucket_id = 'documents'),
  'l''employé voit son document');
select test.refuse($$insert into storage.objects (bucket_id, name) values ('documents', '00000000-0000-0000-0000-000000000002/faux.pdf')$$,
  'un employé ne dépose pas de document');
select test.refuse($$delete from public.documents$$, 'un employé ne supprime pas ses documents');
select public.document_vu((select id from public.documents));
select test.verifier((select vu_le is not null from public.documents), 'document ouvert : « vu » noté');
reset role;
select test.verifier((select count(*) = 1 from public.notifications where destinataire_id = '00000000-0000-0000-0000-000000000002'
  and titre = 'Nouveau document' and lien = '/mes-documents'), 'nouveau document : l''employé est prévenu');

-- ---------- Checklists ----------
set role authenticated;
select test.connecte('00000000-0000-0000-0000-00000000000a');
insert into public.checklists (nom, ordre) values ('Fermeture', 1);
insert into public.checklists (nom, cuisine_seulement, ordre) values ('Cuisine', true, 2);
insert into public.checklist_taches (checklist_id, texte, ordre) select id, 'Couper le gaz', 1 from public.checklists where nom = 'Fermeture';
insert into public.checklist_taches (checklist_id, texte, ordre) select id, 'Nettoyer la plancha', 1 from public.checklists where nom = 'Cuisine';
select test.connecte('00000000-0000-0000-0000-000000000002');
select test.verifier((select count(*) = 1 from public.checklists) and (select count(*) = 1 from public.checklist_taches),
  'un employé voit les listes, pas celle réservée à la cuisine');
select test.refuse($$insert into public.checklist_taches (checklist_id, texte) select id, 'X' from public.checklists$$, 'un employé ne crée pas de tâche');
insert into public.checklist_coches (tache_id, jour) select id, current_date - 3 from public.checklist_taches;
select test.verifier((select jour = (now() at time zone 'Europe/Paris')::date and coche_par = '00000000-0000-0000-0000-000000000002' from public.checklist_coches),
  'un employé coche une tâche (toujours pour aujourd''hui, à son nom)');
select test.refuse($$insert into public.checklist_coches (tache_id) select id from public.checklist_taches$$, 'une tâche ne se coche qu''une fois par jour');
select test.refuse($$insert into public.checklist_coches (tache_id) select t.id from public.checklist_taches t
  join public.checklists c on c.id = t.checklist_id where c.nom = 'Cuisine'$$, 'un employé ne coche pas la liste cuisine');
select test.connecte('00000000-0000-0000-0000-000000000003');
insert into public.checklist_coches (tache_id) select t.id from public.checklist_taches t join public.checklists c on c.id = t.checklist_id where c.nom = 'Cuisine';
select test.refuse($$delete from public.checklist_coches where coche_par = '00000000-0000-0000-0000-000000000002'$$, 'on ne décoche pas la tâche d''un autre');
select test.verifier((select count(*) >= 3 from public.noms_equipe()), 'les noms de l''équipe sont lisibles pour l''historique');
select test.connecte('00000000-0000-0000-0000-000000000002');
delete from public.checklist_coches;
select test.verifier((select count(*) = 0 from public.checklist_coches), 'un employé décoche sa tâche du jour');
reset role;

-- ---------- Fournisseurs et livraisons ----------
set role authenticated;
select test.connecte('00000000-0000-0000-0000-000000000003');
insert into public.fournisseurs (nom, telephone, livraison) values ('Metro', '01 02 03 04 05', 'mardi et vendredi');
update public.fournisseurs set contact = 'Julien';
select test.refuse($$delete from public.fournisseurs$$, 'seul l''admin supprime un fournisseur');
insert into public.commandes (produit, fournisseur_id) select 'Riz', id from public.fournisseurs;
insert into public.livraisons (fournisseur_id, fournisseur, temperature, lot, conforme)
  select id, 'x', 9.5, 'L1', false from public.fournisseurs;
select test.verifier((select fournisseur = 'Metro' and recu_par = '00000000-0000-0000-0000-000000000003' from public.livraisons),
  'livraison enregistrée (nom du fournisseur et cuisinier notés)');
select test.connecte('00000000-0000-0000-0000-000000000002');
select test.verifier((select count(*) = 0 from public.fournisseurs) and (select count(*) = 0 from public.livraisons),
  'un employé ne voit ni fournisseurs ni livraisons');
select test.connecte('00000000-0000-0000-0000-00000000000a');
delete from public.fournisseurs;
select test.verifier((select fournisseur = 'Metro' and fournisseur_id is null from public.livraisons),
  'fournisseur supprimé : la livraison garde son nom');
reset role;
select test.verifier((select count(*) = 1 from public.notifications where titre = 'Livraison non conforme' and texte = 'Metro · 9,5 °C'),
  'livraison non conforme : l''admin est prévenu');

-- ---------- Compte désactivé ----------
update public.profiles set actif = false where id = '00000000-0000-0000-0000-000000000002';
set role authenticated;
select test.connecte('00000000-0000-0000-0000-000000000002');
select test.verifier((select count(*) = 0 from public.shifts), 'un compte désactivé ne voit plus ses horaires');
select test.refuse($$insert into public.conges (employe_id, debut, fin)
  values ('00000000-0000-0000-0000-000000000002', current_date + 1, current_date + 1)$$, 'un compte désactivé ne demande pas de congé');
reset role;

-- ---------- Suppression d'un compte ----------
delete from auth.users where id = '00000000-0000-0000-0000-000000000001';
select test.verifier((select count(*) = 0 from public.profiles where id = '00000000-0000-0000-0000-000000000001')
  and (select count(*) = 0 from public.shifts where employe_id = '00000000-0000-0000-0000-000000000001')
  and (select count(*) = 0 from public.conges where employe_id = '00000000-0000-0000-0000-000000000001'),
  'supprimer un compte efface son profil, ses horaires et ses congés');

\o
\echo 'Tous les tests de la base sont passés.'
