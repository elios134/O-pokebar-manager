// Fonction serveur réservée aux admins : créer un compte, activer / désactiver un compte.
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
    const role = corps.role === 'admin' ? 'admin' : 'employe'

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

    // Le profil est créé par le trigger (rôle 'employe'). On applique le rôle demandé.
    if (role === 'admin') {
      await admin.from('profiles').update({ role }).eq('id', data.user.id)
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

  return erreur('Action inconnue.')
})
