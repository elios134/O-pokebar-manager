import { useEffect, useState } from 'react'
import Fenetre, { boutonPrincipal } from './Fenetre'

interface EvenementInstallation extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const dejaInstallee = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

type Appareil = 'ios' | 'android' | 'ordinateur'
function appareil(): Appareil {
  const ua = navigator.userAgent
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return 'ios'
  if (/android/i.test(ua)) return 'android'
  return 'ordinateur'
}

const ETAPES: Record<Appareil, string[]> = {
  ios: [
    'Touchez le bouton Partager (le carré avec une flèche vers le haut).',
    "Choisissez « Sur l'écran d'accueil ».",
    "Touchez « Ajouter » : l'icône Planning apparaît sur votre écran.",
  ],
  android: [
    'Ouvrez le menu du navigateur (les 3 points ⋮, en haut ou en bas à droite).',
    "Choisissez « Installer l'application » ou « Ajouter à l'écran d'accueil ».",
    "Confirmez : l'icône Planning apparaît sur votre écran.",
  ],
  ordinateur: [
    "Cliquez sur l'icône d'installation à droite de la barre d'adresse (un écran avec une flèche).",
    "Ou ouvrez le menu du navigateur et choisissez « Installer O'pokebar · Planning ».",
    "L'application s'ouvre dans sa propre fenêtre.",
  ],
}

/**
 * Bouton « Installer » toujours visible tant que l'app n'est pas installée.
 * Si le navigateur propose l'installation directe, on l'utilise ; sinon on explique comment faire
 * (iPhone, Brave, Firefox… n'ont pas toujours l'installation directe).
 */
export default function BoutonInstaller() {
  const [evenement, setEvenement] = useState<EvenementInstallation | null>(null)
  const [aide, setAide] = useState(false)
  const [installee, setInstallee] = useState(dejaInstallee)

  useEffect(() => {
    const garder = (e: Event) => {
      e.preventDefault()
      setEvenement(e as EvenementInstallation)
    }
    const fini = () => {
      setInstallee(true)
      setEvenement(null)
    }
    window.addEventListener('beforeinstallprompt', garder)
    window.addEventListener('appinstalled', fini)
    return () => {
      window.removeEventListener('beforeinstallprompt', garder)
      window.removeEventListener('appinstalled', fini)
    }
  }, [])

  if (installee) return null

  async function installer() {
    if (!evenement) return setAide(true)
    await evenement.prompt()
    const { outcome } = await evenement.userChoice
    setEvenement(null)
    if (outcome === 'accepted') setInstallee(true)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void installer()}
        className="flex h-10 items-center gap-1.5 rounded-lg bg-marque-doux px-3 text-sm font-bold text-marque-fonce hover:bg-[#FBDCD8]"
      >
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
        </svg>
        Installer
      </button>
      {aide && (
        <Fenetre titre="Installer l'application" onFermer={() => setAide(false)}>
          <ol className="flex list-decimal flex-col gap-3 pl-5 text-[15px]">
            {ETAPES[appareil()].map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ol>
          <button type="button" onClick={() => setAide(false)} className={`${boutonPrincipal} mt-6 w-full`}>
            J'ai compris
          </button>
        </Fenetre>
      )}
    </>
  )
}
