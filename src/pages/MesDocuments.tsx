import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import Gabarit from '../components/Gabarit'
import Message, { type TypeMessage } from '../components/Message'
import { estPdf, liensSignes } from '../lib/fichiers'
import { CHAMPS_DOCUMENT, TYPES_DOCUMENT, type DocumentEmploye, type TypeDocument } from '../lib/rh'
import { supabase } from '../lib/supabase'

const fmtDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

/** Documents de l'employé connecté (fiches de paie, contrats…), déposés par l'admin. */
export default function MesDocuments() {
  const { profil } = useAuth()
  const [documents, setDocuments] = useState<DocumentEmploye[] | null>(null)
  const [liens, setLiens] = useState<Record<string, string>>({})
  const [filtre, setFiltre] = useState<TypeDocument | ''>('')
  const [message, setMessage] = useState<TypeMessage | null>(null)

  useEffect(() => {
    void supabase
      .from('documents')
      .select(CHAMPS_DOCUMENT)
      .eq('employe_id', profil!.id)
      .order('cree_le', { ascending: false })
      .then(async ({ data, error }) => {
        if (error) return setMessage({ type: 'erreur', texte: 'Impossible de charger vos documents.' })
        const liste = data as DocumentEmploye[]
        setDocuments(liste)
        setLiens(
          await liensSignes(
            'documents',
            liste.map((d) => d.chemin),
          ),
        )
      })
  }, [profil])

  function ouvert(d: DocumentEmploye) {
    if (d.vu_le) return
    // (une requête Supabase ne part que si on attend sa réponse)
    void supabase.rpc('document_vu', { p_id: d.id }).then()
    setDocuments((liste) => liste?.map((x) => (x.id === d.id ? { ...x, vu_le: new Date().toISOString() } : x)) ?? null)
  }

  const visibles = (documents ?? []).filter((d) => !filtre || d.type === filtre)
  const puce = (actif: boolean) =>
    `h-9 rounded-full px-3.5 text-[13px] ${actif ? 'bg-encre font-bold text-white' : 'border border-[#C9CCD4] bg-white font-semibold'}`

  return (
    <Gabarit titre="Mes documents">
      <div role="group" aria-label="Type de document" className="mb-4 flex flex-wrap gap-2">
        <button type="button" aria-pressed={!filtre} onClick={() => setFiltre('')} className={puce(!filtre)}>
          Tous
        </button>
        {TYPES_DOCUMENT.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={filtre === t.id}
            onClick={() => setFiltre(t.id)}
            className={puce(filtre === t.id)}
          >
            {t.pluriel}
          </button>
        ))}
      </div>
      <Message message={message} />

      {documents === null ? (
        <p className="text-gris">Chargement…</p>
      ) : visibles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#C9CCD4] bg-white p-8 text-center text-gris">
          Aucun document pour le moment. Votre responsable les déposera ici.
        </div>
      ) : (
        <ul className="flex flex-col gap-2 sm:max-w-2xl">
          {visibles.map((d) => (
            <li key={d.id} className="flex items-center gap-3 rounded-2xl border border-ligne bg-white p-3">
              <span
                className={`flex size-10 shrink-0 items-center justify-center rounded-lg text-[11px] font-extrabold ${
                  d.type === 'paie' ? 'bg-marque-doux text-marque-fonce' : 'bg-[#E6EEFB] text-[#1D4E9E]'
                }`}
              >
                {estPdf(d.chemin) ? 'PDF' : 'IMG'}
              </span>
              <div className="mr-auto min-w-0">
                <div className="font-bold">
                  {d.titre}
                  {!d.vu_le && (
                    <span className="ml-2 rounded-full bg-marque px-2 py-0.5 text-[11px] font-extrabold text-white">
                      Nouveau
                    </span>
                  )}
                </div>
                <div className="text-xs text-gris">Ajouté le {fmtDate.format(new Date(d.cree_le))}</div>
              </div>
              {liens[d.chemin] && (
                <a
                  href={liens[d.chemin]}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => ouvert(d)}
                  className="flex h-11 items-center rounded-lg border border-[#C9CCD4] px-3 text-sm font-bold text-encre hover:bg-fond"
                >
                  Ouvrir
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-[13px] text-gris">Vous recevez une notification à chaque nouveau document.</p>
    </Gabarit>
  )
}
