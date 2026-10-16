import { useSyncExternalStore } from 'react'
import { CLE_SESSION } from './supabase'

/**
 * Hors connexion : on garde sur l'appareil les dernières données lues (profil, planning),
 * pour pouvoir les montrer quand il n'y a pas de réseau. Tout est effacé à la déconnexion.
 */

const PREFIXE = 'opk:'

export function garder(cle: string, valeur: unknown) {
  try {
    localStorage.setItem(PREFIXE + cle, JSON.stringify({ quand: Date.now(), valeur }))
  } catch {
    /* stockage plein ou bloqué : on fait sans */
  }
}

export function relire<T>(cle: string): { quand: number; valeur: T } | null {
  try {
    const brut = localStorage.getItem(PREFIXE + cle)
    return brut ? JSON.parse(brut) : null
  } catch {
    return null
  }
}

export function toutEffacer() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIXE))
      .forEach((k) => localStorage.removeItem(k))
  } catch {
    /* rien à effacer */
  }
}

/** Identifiant du dernier compte connecté sur cet appareil (même si sa session a expiré). */
export function dernierCompte(): string | null {
  try {
    return JSON.parse(localStorage.getItem(CLE_SESSION) ?? 'null')?.user?.id ?? null
  } catch {
    return null
  }
}

const abonner = (f: () => void) => {
  window.addEventListener('online', f)
  window.addEventListener('offline', f)
  return () => {
    window.removeEventListener('online', f)
    window.removeEventListener('offline', f)
  }
}

/** true quand l'appareil a du réseau. */
export const useEnLigne = () => useSyncExternalStore(abonner, () => navigator.onLine)

const fmtJour = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })
const fmtHeure = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })
/** "16 oct. à 14:32" */
export const texteQuand = (quand: number) => `${fmtJour.format(quand)} à ${fmtHeure.format(quand)}`
