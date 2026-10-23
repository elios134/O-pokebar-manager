// Fonction serveur réservée aux admins : créer un compte, activer / désactiver un compte,
// donner un nouveau mot de passe, changer l'email, supprimer un compte.
// Elle utilise la clé secrète du projet, qui ne doit jamais aller dans le navigateur.
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function reponse(corps: unknown, status = 200) {
  return new Response(JSON.stringify(corps), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

const erreur = (message: string, status = 400) => reponse({ erreur: message }, status)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return erreur('Méthode non autorisée.', 405)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  // 1. Qui appelle ? Il faut un admin actif.
  const jeton = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: appelant, error: errAppelant } = await admin.auth.getUser(jeton)
  if (errAppelant || !appelant.user) return erreur('Non connecté.', 401)

  const { data: profilAppelant } = await admin
    .from('profiles')
    .select('role, actif')
    .eq('id', appelant.user.id)
    .maybeSingle()
  if (!profilAppelant || profilAppelant.role !== 'admin' || !profilAppelant.actif) {
    return erreur('Réservé aux administrateurs.', 403)
  }

  let corps: Record<string, unknown>
  try {
    corps = await req.json()
  } catch {
    return erreur('Requête invalide.')
  }

  // 2. Créer un compte
  if (corps.action === 'creer') {
    const email = String(corps.email ?? '').trim().toLowerCase()
    const motDePasse = String(corps.motDePasse ?? '')
    const prenom = String(corps.prenom ?? '').trim()
    const nom = String(corps.nom ?? '').trim()
    const role = corps.role === 'admin' || corps.role === 'cuisine' ? corps.role : 'employe'

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return erreur('Email invalide.')
    if (motDePasse.length < 8) return erreur('Le mot de passe doit faire au moins 8 caractères.')
    if (!prenom || !nom) return erreur('Prénom et nom sont obligatoires.')

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: motDePasse,
      email_confirm: true,
      user_metadata: { prenom, nom },
    })
    if (error || !data.user) {
      const existe = /already|registered|exists/i.test(error?.message ?? '')
      return erreur(existe ? 'Un compte existe déjà avec cet email.' : 'Création impossible.')
    }

    // Le profil est créé par le trigger (rôle 'employe', sans équipe). On applique le rôle et l'équipe demandés.
    const equipeId = typeof corps.equipe_id === 'string' && corps.equipe_id ? corps.equipe_id : null
    if (role !== 'employe' || equipeId) {
      await admin.from('profiles').update({ role, equipe_id: equipeId }).eq('id', data.user.id)
    }
    return reponse({ id: data.user.id })
  }

  // 3. Activer / désactiver un compte
  if (corps.action === 'statut') {
    const id = String(corps.id ?? '')
    const actif = corps.actif === true
    if (!id) return erreur('Compte manquant.')
    if (id === appelant.user.id) return erreur('Vous ne pouvez pas désactiver votre propre compte.')

    // Bloque (ou débloque) la connexion elle-même, en plus du statut du profil.
    const { error: errBan } = await admin.auth.admin.updateUserById(id, {
      ban_duration: actif ? 'none' : '876000h',
    })
    if (errBan) return erreur('Compte introuvable.', 404)

    const { error } = await admin.from('profiles').update({ actif }).eq('id', id)
    if (error) return erreur('Mise à jour impossible.', 500)
    return reponse({ ok: true })
  }

  // 4. Donner un nouveau mot de passe (employé qui a oublié le sien)
  if (corps.action === 'motdepasse') {
    const id = String(corps.id ?? '')
    const motDePasse = String(corps.motDePasse ?? '')
    if (!id) return erreur('Compte manquant.')
    if (motDePasse.length < 8) return erreur('Le mot de passe doit faire au moins 8 caractères.')
    const { error } = await admin.auth.admin.updateUserById(id, { password: motDePasse })
    if (error) return erreur('Changement impossible.')
    return reponse({ ok: true })
  }

  // 5. Changer l'email de connexion (y compris le sien pour un admin)
  if (corps.action === 'email') {
    const id = String(corps.id ?? '')
    const email = String(corps.email ?? '').trim().toLowerCase()
    if (!id) return erreur('Compte manquant.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return erreur('Email invalide.')
    const { error } = await admin.auth.admin.updateUserById(id, { email, email_confirm: true })
    if (error) {
      const existe = /already|registered|exists/i.test(error.message)
      return erreur(existe ? 'Un compte existe déjà avec cet email.' : 'Changement impossible.')
    }
    await admin.from('profiles').update({ email }).eq('id', id)
    return reponse({ ok: true })
  }

  // 6. Supprimer un compte (avec ses horaires et ses congés)
  if (corps.action === 'supprimer') {
    const id = String(corps.id ?? '')
    if (!id) return erreur('Compte manquant.')
    if (id === appelant.user.id) return erreur('Vous ne pouvez pas supprimer votre propre compte.')
    const { error } = await admin.auth.admin.deleteUser(id)
    if (error) return erreur('Suppression impossible.')
    return reponse({ ok: true })
  }

  return erreur('Action inconnue.')
})
