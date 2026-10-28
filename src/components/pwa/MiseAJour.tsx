import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

const TRENTE_MINUTES = 30 * 60 * 1000

/** Prévient quand une nouvelle version du site est prête, au lieu de la changer sans rien dire. */
export default function MiseAJour() {
  const [masque, setMasque] = useState(false)
  const {
    needRefresh: [nouvelle],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, enregistrement) {
      if (!enregistrement) return
      // Vérifie régulièrement s'il y a une nouvelle version (l'app peut rester ouverte longtemps).
      window.setInterval(() => void enregistrement.update(), TRENTE_MINUTES)
      // Et à chaque retour sur l'app : sur téléphone, elle est souvent remise au premier plan sans être rechargée.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && navigator.onLine) void enregistrement.update()
      })
    },
  })

  // « Plus tard » : le message revient la prochaine fois qu'on revient sur l'app.
  useEffect(() => {
    if (!masque) return
    const revenir = () => document.visibilityState === 'visible' && setMasque(false)
    document.addEventListener('visibilitychange', revenir)
    return () => document.removeEventListener('visibilitychange', revenir)
  }, [masque])

  if (!nouvelle || masque) return null
  return (
    <div
      role="status"
      className="fixed inset-x-3 top-[72px] z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-nuit px-4 py-3 text-white shadow-2xl"
    >
      <span className="mr-auto text-sm font-semibold">Une nouvelle version est disponible.</span>
      <button type="button" onClick={() => setMasque(true)} className="h-10 rounded-lg px-2 text-sm font-semibold text-white/80 hover:text-white">
        Plus tard
      </button>
      <button
        type="button"
        onClick={() => void updateServiceWorker(true)}
        className="h-10 rounded-lg bg-white px-3 text-sm font-bold text-nuit hover:bg-white/90"
      >
        Mettre à jour
      </button>
    </div>
  )
}
