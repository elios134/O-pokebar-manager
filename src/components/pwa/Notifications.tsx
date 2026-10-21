import { useEffect, useState } from 'react'
import { activerPush, desactiverPush, etatPush, type EtatPush } from '../../lib/push'
import { boutonPrincipal, boutonSecondaire } from '../Fenetre'

function useEtatPush() {
  const [etat, setEtat] = useState<EtatPush | null>(null)
  useEffect(() => {
    let annule = false
    void etatPush().then((e) => !annule && setEtat(e))
    return () => {
      annule = true
    }
  }, [])
  return [etat, setEtat] as const
}

const TEXTES: Record<EtatPush, string> = {
  actif: 'Activées sur cet appareil : vous êtes prévenu dès que votre planning ou un congé change.',
  inactif: 'Recevez une notification sur cet appareil dès que votre planning ou un congé change, même application fermée.',
  refuse:
    'Les notifications sont bloquées pour ce site. Autorisez-les dans les réglages du navigateur (icône à gauche de l’adresse), puis revenez ici.',
  'installer-iphone':
    "Sur iPhone, ajoutez d'abord l'application à l'écran d'accueil (encart « Installer l'application »), puis ouvrez-la depuis son icône.",
  indisponible: "Ce navigateur ne permet pas les notifications. Essayez avec Chrome, Edge, Firefox ou Safari à jour.",
}

/** Encart « Notifications sur cet appareil » de la page Mon compte. */
export function CarteNotifications() {
  const [etat, setEtat] = useEtatPush()
  const [envoi, setEnvoi] = useState(false)
  if (!etat) return null

  async function basculer() {
    setEnvoi(true)
    if (etat === 'actif') {
      await desactiverPush()
      setEtat('inactif')
    } else setEtat(await activerPush().catch((): EtatPush => 'indisponible'))
    setEnvoi(false)
  }

  return (
    <section className="rounded-2xl border border-ligne bg-white p-5">
      <h2 className="text-lg font-extrabold">Notifications sur cet appareil</h2>
      <p className="mt-1 text-sm text-gris" role="status">
        {TEXTES[etat]}
      </p>
      {(etat === 'actif' || etat === 'inactif') && (
        <button
          type="button"
          disabled={envoi}
          onClick={() => void basculer()}
          className={`${etat === 'actif' ? boutonSecondaire : boutonPrincipal} mt-4 w-full sm:w-auto`}
        >
          {envoi ? '…' : etat === 'actif' ? 'Désactiver les notifications' : 'Activer les notifications'}
        </button>
      )}
    </section>
  )
}

const MASQUE = 'opk-notif-bandeau-masque'

/** Petit bandeau sur le planning pour proposer les notifications (une seule fois, on peut le fermer). */
export function BandeauNotifications() {
  const [etat, setEtat] = useEtatPush()
  const [masque, setMasque] = useState(() => {
    try {
      return localStorage.getItem(MASQUE) === '1'
    } catch {
      return false
    }
  })
  if (masque || etat !== 'inactif') return null

  const fermer = () => {
    try {
      localStorage.setItem(MASQUE, '1')
    } catch {
      /* tant pis */
    }
    setMasque(true)
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-ligne bg-white px-4 py-3">
      <span className="mr-auto text-sm font-semibold">Être prévenu sur ce téléphone quand votre planning change ?</span>
      <button type="button" onClick={fermer} className="h-10 rounded-lg px-3 text-sm font-semibold text-gris hover:bg-fond">
        Non merci
      </button>
      <button
        type="button"
        onClick={async () => {
          const e = await activerPush().catch((): 'indisponible' => 'indisponible')
          setEtat(e)
          if (e !== 'inactif') fermer()
        }}
        className="h-10 rounded-lg bg-marque px-4 text-sm font-bold text-white hover:bg-marque-fonce"
      >
        Activer
      </button>
    </div>
  )
}
