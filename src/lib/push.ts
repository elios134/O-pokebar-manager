import { appareil, estInstallee } from './installation'
import { supabase } from './supabase'

/** Notifications sur le téléphone (Web Push). La clé publique n'a rien de secret. */
const CLE_PUBLIQUE = 'BF6SvBpsvNg5baRWqhzfnt0djhvuRyaKQk-l2Yi5gL426fkBOr6CdSxXX3VKJ0WKAuhzJu3sBTLTJqKgiJ8aiLM'

export type EtatPush = 'indisponible' | 'installer-iphone' | 'refuse' | 'actif' | 'inactif'

export const pushPossible = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

function octets(base64: string) {
  const b = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(b), (c) => c.charCodeAt(0))
}

const abonnementActuel = async () => (await navigator.serviceWorker.ready).pushManager.getSubscription()

async function enregistrer(abonnement: PushSubscription) {
  const j = abonnement.toJSON()
  const { error } = await supabase.rpc('enregistrer_abonnement_push', {
    p_endpoint: j.endpoint,
    p_p256dh: j.keys?.p256dh,
    p_auth: j.keys?.auth,
  })
  return !error
}

export async function etatPush(): Promise<EtatPush> {
  // Sur iPhone, les notifications ne marchent que dans l'application ajoutée à l'écran d'accueil.
  if (appareil() === 'ios' && !estInstallee()) return 'installer-iphone'
  if (!pushPossible()) return 'indisponible'
  if (Notification.permission === 'denied') return 'refuse'
  if (Notification.permission !== 'granted') return 'inactif'
  return (await abonnementActuel()) ? 'actif' : 'inactif'
}

/** Demande l'autorisation et enregistre ce téléphone pour la personne connectée. */
export async function activerPush(): Promise<EtatPush> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'refuse' : 'inactif'
  const reg = await navigator.serviceWorker.ready
  const abonnement =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: octets(CLE_PUBLIQUE) }))
  return (await enregistrer(abonnement)) ? 'actif' : 'inactif'
}

/** Arrête les notifications sur ce téléphone. */
export async function desactiverPush() {
  const abonnement = await abonnementActuel()
  if (!abonnement) return
  await supabase.rpc('retirer_abonnement_push', { p_endpoint: abonnement.endpoint })
  await abonnement.unsubscribe()
}

/** Déconnexion : ce téléphone ne reçoit plus les notifications de ce compte (il les retrouvera à la reconnexion). */
export async function oublierAppareil() {
  if (!pushPossible() || Notification.permission !== 'granted') return
  const abonnement = await Promise.race([abonnementActuel(), new Promise<null>((r) => setTimeout(() => r(null), 2000))])
  if (abonnement) await supabase.rpc('retirer_abonnement_push', { p_endpoint: abonnement.endpoint })
}

/** À la connexion : si ce téléphone avait déjà accepté, on le relie au compte connecté. */
export async function synchroniserPush() {
  if (!pushPossible() || Notification.permission !== 'granted') return
  const abonnement = await abonnementActuel()
  if (abonnement) await enregistrer(abonnement)
}
