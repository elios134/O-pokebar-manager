// Envoie une notification sur les téléphones de son destinataire (Web Push).
// Appelée seulement par la base de données (déclencheur sur « notifications »), avec une clé partagée.
// Les clés sont dans le coffre de Supabase (Vault) et lues avec la clé secrète du projet.
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

const reponse = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reponse({ erreur: 'Méthode non autorisée.' }, 405)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: cles, error: errCles } = await admin.rpc('cles_push').single<{
    cle: string | null
    vapid_publique: string | null
    vapid_privee: string | null
  }>()
  if (errCles || !cles?.cle || !cles.vapid_publique || !cles.vapid_privee) return reponse({ erreur: 'Clés manquantes.' }, 500)
  if (req.headers.get('x-cle-push') !== cles.cle) return reponse({ erreur: 'Non autorisé.' }, 401)

  let id = ''
  try {
    id = String((await req.json()).id ?? '')
  } catch {
    return reponse({ erreur: 'Requête invalide.' }, 400)
  }

  const { data: notif } = await admin.from('notifications').select('id, destinataire_id, titre, texte, lien').eq('id', id).maybeSingle()
  if (!notif) return reponse({ erreur: 'Notification introuvable.' }, 404)

  const { data: appareils } = await admin
    .from('abonnements_push')
    .select('id, endpoint, p256dh, auth')
    .eq('profil_id', notif.destinataire_id)

  webpush.setVapidDetails('https://o-pokebar-manager-5ir7.vercel.app', cles.vapid_publique, cles.vapid_privee)
  const contenu = JSON.stringify({ id: notif.id, titre: notif.titre, texte: notif.texte, lien: notif.lien })

  let envoyes = 0
  for (const a of appareils ?? []) {
    try {
      await webpush.sendNotification({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } }, contenu, {
        TTL: 60 * 60 * 24,
        urgency: 'normal',
      })
      envoyes++
    } catch (e) {
      // Appareil qui n'existe plus (désinstallé, notifications coupées) : on l'oublie.
      const code = (e as { statusCode?: number }).statusCode
      if (code === 404 || code === 410) await admin.from('abonnements_push').delete().eq('id', a.id)
      else console.error('Envoi impossible', code, (e as Error).message)
    }
  }
  return reponse({ envoyes })
})
