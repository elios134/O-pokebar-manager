import { useSyncExternalStore } from 'react'

/** Installation de l'application (PWA) : suivie dès le chargement de la page, pour ne rien rater. */

interface EvenementInstallation extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type Appareil = 'ios' | 'android' | 'ordinateur'

export function appareil(): Appareil {
  const ua = navigator.userAgent
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return 'ios'
  if (/android/i.test(ua)) return 'android'
  return 'ordinateur'
}

export const estInstallee = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

const MASQUE = 'opk-installer-masque'

let etat = {
  installee: estInstallee(),
  direct: null as EvenementInstallation | null, // installation directe proposée par le navigateur
  masque: (() => {
    try {
      return localStorage.getItem(MASQUE) === '1'
    } catch {
      return false
    }
  })(),
}
const abonnes = new Set<() => void>()
const changer = (maj: Partial<typeof etat>) => {
  etat = { ...etat, ...maj }
  abonnes.forEach((f) => f())
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  changer({ direct: e as EvenementInstallation })
})
window.addEventListener('appinstalled', () => changer({ installee: true, direct: null }))

export function useInstallation() {
  const e = useSyncExternalStore(
    (f) => {
      abonnes.add(f)
      return () => abonnes.delete(f)
    },
    () => etat,
  )
  return {
    ...e,
    /** Lance l'installation directe ; renvoie false si le navigateur ne la propose pas. */
    async installer() {
      if (!e.direct) return false
      await e.direct.prompt()
      const { outcome } = await e.direct.userChoice
      changer({ direct: null, installee: outcome === 'accepted' })
      return true
    },
    /** Ne plus montrer le bouton dans l'en-tête (il reste dans « Mon compte »). */
    masquer() {
      try {
        localStorage.setItem(MASQUE, '1')
      } catch {
        /* stockage indisponible : tant pis */
      }
      changer({ masque: true })
    },
  }
}
