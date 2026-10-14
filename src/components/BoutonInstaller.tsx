import { useEffect, useState } from 'react'
import Fenetre, { boutonPrincipal } from './Fenetre'

interface EvenementInstallation extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const dejaInstallee = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

const estIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)

/** Bouton « Installer l'app » : installation directe (Android, ordinateur) ou explication (iPhone). */
export default function BoutonInstaller() {
  const [evenement, setEvenement] = useState<EvenementInstallation | null>(null)
  const [aideIOS, setAideIOS] = useState(false)
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

  if (installee || (!evenement && !estIOS())) return null

  async function installer() {
    if (!evenement) return setAideIOS(true)
    await evenement.prompt()
    await evenement.userChoice
    setEvenement(null)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void installer()}
        className="flex h-10 items-center gap-1.5 rounded-lg bg-marque-doux px-3 text-sm font-bold text-marque-fonce hover:bg-[#E2E5FF]"
      >
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
        </svg>
        Installer
      </button>
      {aideIOS && (
        <Fenetre titre="Installer l'application" onFermer={() => setAideIOS(false)}>
          <ol className="flex list-decimal flex-col gap-3 pl-5 text-[15px]">
            <li>
              Dans Safari, touchez le bouton <strong>Partager</strong> (le carré avec une flèche vers le haut).
            </li>
            <li>
              Choisissez <strong>Sur l'écran d'accueil</strong>.
            </li>
            <li>
              Touchez <strong>Ajouter</strong>. L'icône Planning apparaît sur votre écran.
            </li>
          </ol>
          <button type="button" onClick={() => setAideIOS(false)} className={`${boutonPrincipal} mt-6 w-full`}>
            J'ai compris
          </button>
        </Fenetre>
      )}
    </>
  )
}
