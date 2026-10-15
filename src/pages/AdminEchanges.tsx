import { useCallback, useEffect, useState } from 'react'
import CarteEchange from '../components/CarteEchange'
import Gabarit from '../components/Gabarit'
import { action, chargerEchanges, type Echange } from '../lib/echanges'
import { signalerEchangesModifies } from '../lib/useCongesEnAttente'

export default function AdminEchanges() {
  const [liste, setListe] = useState<Echange[] | null>(null)
  const [message, setMessage] = useState<{ type: 'ok' | 'erreur'; texte: string } | null>(null)
  const [enCours, setEnCours] = useState<string | null>(null)

  const charger = useCallback(
    () =>
      chargerEchanges().then((l) => {
        if (l === null) setMessage({ type: 'erreur', texte: 'Impossible de charger les échanges.' })
        else setListe(l)
      }),
    [],
  )

  useEffect(() => {
    void charger()
  }, [charger])

  async function valider(e: Echange, accepte: boolean) {
    setEnCours(e.id)
    const err = await action('valider_echange', { p_id: e.id, p_accepte: accepte })
    setEnCours(null)
    setMessage(
      err
        ? { type: 'erreur', texte: err }
        : { type: 'ok', texte: accepte ? 'Échange validé : le planning est à jour.' : 'Échange refusé.' },
    )
    signalerEchangesModifies()
    void charger()
  }

  const aValider = (liste ?? []).filter((e) => e.statut === 'attente_admin')
  const autres = (liste ?? []).filter((e) => e.statut !== 'attente_admin')

  return (
    <Gabarit titre="Échanges d'horaires">
      {message && (
        <p
          role={message.type === 'erreur' ? 'alert' : 'status'}
          className={`mb-4 rounded-lg px-3 py-2 text-sm ${
            message.type === 'erreur' ? 'bg-red-50 text-red-800' : 'bg-[#DDF5E6] text-[#145C32]'
          }`}
        >
          {message.texte}
        </p>
      )}
      {liste === null ? (
        <p className="text-gris">Chargement…</p>
      ) : (
        <>
          <section className="mb-6">
            <h2 className="mb-2 text-lg font-extrabold">À valider ({aValider.length})</h2>
            {aValider.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#C9CCD4] bg-white p-6 text-center text-gris">
                Aucun échange à valider.
              </div>
            ) : (
              <ul className="grid gap-3 lg:grid-cols-2">
                {aValider.map((e) => (
                  <CarteEchange key={e.id} e={e}>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={enCours === e.id}
                        onClick={() => void valider(e, false)}
                        className="h-11 rounded-xl border border-[#F1B4B4] font-bold text-[#9B1C1C] hover:bg-red-50 disabled:opacity-60"
                      >
                        Refuser
                      </button>
                      <button
                        type="button"
                        disabled={enCours === e.id}
                        onClick={() => void valider(e, true)}
                        className="h-11 rounded-xl bg-[#1F7A45] font-bold text-white hover:bg-[#145C32] disabled:opacity-60"
                      >
                        Valider l'échange
                      </button>
                    </div>
                  </CarteEchange>
                ))}
              </ul>
            )}
          </section>
          {autres.length > 0 && (
            <section>
              <h2 className="mb-2 text-lg font-extrabold">Tous les échanges</h2>
              <ul className="grid gap-3 lg:grid-cols-2">
                {autres.map((e) => (
                  <CarteEchange key={e.id} e={e} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </Gabarit>
  )
}
