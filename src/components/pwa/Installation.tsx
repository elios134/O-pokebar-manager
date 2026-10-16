import { useState } from 'react'
import { appareil, useInstallation, type Appareil } from '../../lib/installation'
import Fenetre, { boutonPrincipal } from '../Fenetre'

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

function Aide({ onFermer }: { onFermer: () => void }) {
  return (
    <Fenetre titre="Installer l'application" onFermer={onFermer}>
      <ol className="flex list-decimal flex-col gap-3 pl-5 text-[15px]">
        {ETAPES[appareil()].map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ol>
      <button type="button" onClick={onFermer} className={`${boutonPrincipal} mt-6 w-full`}>
        J'ai compris
      </button>
    </Fenetre>
  )
}

/**
 * Bouton « Installer » de l'en-tête, discret :
 * - affiché si le navigateur propose l'installation directe ;
 * - sur téléphone ou tablette sinon, jusqu'à ce que la personne ait lu les explications.
 * Sur ordinateur sans installation directe, il n'apparaît pas (l'option reste dans « Mon compte »).
 */
export function BoutonInstaller() {
  const inst = useInstallation()
  const [aide, setAide] = useState(false)
  const mobile = appareil() !== 'ordinateur'
  if (inst.installee || (!inst.direct && (!mobile || inst.masque))) return null

  return (
    <>
      <button
        type="button"
        onClick={async () => {
          if (!(await inst.installer())) setAide(true)
        }}
        className="flex h-10 items-center gap-1.5 rounded-lg bg-marque-doux px-3 text-sm font-bold text-marque-fonce hover:bg-[#FBDCD8]"
      >
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
        </svg>
        Installer
      </button>
      {aide && (
        <Aide
          onFermer={() => {
            setAide(false)
            inst.masquer()
          }}
        />
      )}
    </>
  )
}

/** Encart « Installer l'application » de la page Mon compte (toujours là tant que ce n'est pas installé). */
export function CarteInstallation() {
  const inst = useInstallation()
  const [aide, setAide] = useState(false)
  if (inst.installee) return null
  return (
    <section className="rounded-2xl border border-ligne bg-white p-5">
      <h2 className="text-lg font-extrabold">Installer l'application</h2>
      <p className="mt-1 text-sm text-gris">
        Ajoutez le planning sur votre écran d'accueil : il s'ouvre comme une application, même sans connexion.
      </p>
      <button
        type="button"
        onClick={async () => {
          if (!(await inst.installer())) setAide(true)
        }}
        className={`${boutonPrincipal} mt-4 w-full sm:w-auto`}
      >
        Installer sur cet appareil
      </button>
      {aide && <Aide onFermer={() => setAide(false)} />}
    </section>
  )
}
