import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import BadgeStatut from '../components/BadgeStatut'
import Fenetre, { boutonPrincipal, boutonSecondaire, champ, etiquette } from '../components/Fenetre'
import Gabarit from '../components/Gabarit'
import { IconePlus } from '../components/Icones'
import { euros } from '../lib/dates'
import { supabase } from '../lib/supabase'
import { CHAMPS_ACOMPTE, type Acompte } from '../lib/types'

const fmtDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

/** Demandes d'acompte sur salaire de l'employé : nouvelle demande, suivi de la réponse, annulation. */
export default function MesAcomptes() {
  const { profil } = useAuth()
  const [acomptes, setAcomptes] = useState<Acompte[] | null>(null)
  const [demande, setDemande] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'erreur'; texte: string } | null>(null)

  const charger = useCallback(
    () =>
      supabase
        .from('acomptes')
        .select(CHAMPS_ACOMPTE)
        .eq('employe_id', profil!.id)
        .order('cree_le', { ascending: false })
        .then(({ data, error }) => {
          if (error) setMessage({ type: 'erreur', texte: 'Impossible de charger vos demandes.' })
          else setAcomptes(data as Acompte[])
        }),
    [profil],
  )

  useEffect(() => {
    void charger()
  }, [charger])

  const enAttente = (acomptes ?? []).some((a) => a.statut === 'en_attente')

  async function annuler(a: Acompte) {
    if (!window.confirm("Annuler cette demande d'acompte ?")) return
    const { error } = await supabase.from('acomptes').delete().eq('id', a.id)
    setMessage(error ? { type: 'erreur', texte: 'Annulation impossible.' } : { type: 'ok', texte: 'Demande annulée.' })
    void charger()
  }

  return (
    <Gabarit
      titre="Mes acomptes"
      actions={
        <button
          type="button"
          disabled={enAttente}
          title={enAttente ? 'Une demande est déjà en attente de réponse.' : undefined}
          onClick={() => setDemande(true)}
          className="flex h-11 items-center gap-2 rounded-xl bg-marque px-4 text-sm font-bold text-white hover:bg-marque-fonce disabled:opacity-50 sm:text-[15px]"
        >
          <IconePlus />
          Demander un acompte
        </button>
      }
    >
      {enAttente && (
        <p className="mb-4 rounded-lg bg-[#FFF1C2] px-3 py-2 text-sm text-[#6B4E00]">
          Une demande est en attente : vous pourrez en faire une autre après la réponse (ou en l'annulant).
        </p>
      )}
      {message && (
        <p
          role={message.type === 'erreur' ? 'alert' : 'status'}
          className={`mb-4 rounded-lg px-3 py-2 text-sm ${message.type === 'erreur' ? 'bg-red-50 text-red-800' : 'bg-[#DDF5E6] text-[#145C32]'}`}
        >
          {message.texte}
        </p>
      )}

      {acomptes === null ? (
        <p className="text-gris">Chargement…</p>
      ) : acomptes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#C9CCD4] bg-white p-8 text-center text-gris">
          Vous n'avez encore fait aucune demande d'acompte.
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {acomptes.map((a) => (
            <li key={a.id} className="rounded-2xl border border-ligne bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-auto text-lg font-extrabold">{euros(a.montant)}</span>
                <BadgeStatut statut={a.statut} />
              </div>
              <div className="mt-1 text-sm text-gris">
                Demandé le {fmtDate.format(new Date(a.cree_le))}
                {a.motif && ` · ${a.motif}`}
              </div>
              {a.reponse && (
                <div className="mt-2 rounded-lg bg-fond px-3 py-2 text-sm">
                  <span className="font-semibold">Réponse : </span>
                  {a.reponse}
                </div>
              )}
              {a.statut === 'en_attente' && (
                <button
                  type="button"
                  onClick={() => void annuler(a)}
                  className="mt-3 h-10 rounded-lg border border-[#C9CCD4] px-3 text-sm font-semibold hover:bg-fond"
                >
                  Annuler la demande
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {demande && (
        <FenetreDemande
          employeId={profil!.id}
          onFermer={() => setDemande(false)}
          onEnvoyee={() => {
            setDemande(false)
            setMessage({ type: 'ok', texte: 'Demande envoyée. Vous verrez ici la réponse de votre responsable.' })
            void charger()
          }}
        />
      )}
    </Gabarit>
  )
}

function FenetreDemande({ employeId, onFermer, onEnvoyee }: { employeId: string; onFermer: () => void; onEnvoyee: () => void }) {
  const [montant, setMontant] = useState('')
  const [motif, setMotif] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)
  // Virgule ou point acceptés (« 80,50 » ou « 80.50 »).
  const valeur = /^\d+([.,]\d{1,2})?$/.test(montant.trim()) ? Number(montant.trim().replace(',', '.')) : 0
  const valide = valeur > 0 && valeur <= 10000

  async function envoyer(e: FormEvent) {
    e.preventDefault()
    if (!valide) return
    setEnvoi(true)
    const { error } = await supabase
      .from('acomptes')
      .insert({ employe_id: employeId, montant: Math.round(valeur * 100) / 100, motif: motif.trim() || null })
    setEnvoi(false)
    if (error) {
      return setErreur(error.code === '23505' ? 'Une demande est déjà en attente.' : 'Envoi impossible. Réessayez.')
    }
    onEnvoyee()
  }

  return (
    <Fenetre titre="Demander un acompte" onFermer={onFermer}>
      <form onSubmit={envoyer} className="flex flex-col gap-4">
        <label className={etiquette}>
          Montant (€)
          <input
            type="text"
            required
            inputMode="decimal"
            autoComplete="off"
            placeholder="Ex. : 200"
            value={montant}
            onChange={(e) => setMontant(e.target.value)}
            className={champ}
          />
        </label>
        <label className={etiquette}>
          Motif (facultatif)
          <input
            type="text"
            maxLength={300}
            placeholder="Ex. : dépense imprévue"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            className={champ}
          />
        </label>
        <p className="-mt-1 text-[13px] text-gris">L'acompte sera déduit de votre prochain salaire.</p>
        {erreur && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            {erreur}
          </p>
        )}
        <div className="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onFermer} className={boutonSecondaire}>
            Annuler
          </button>
          <button type="submit" disabled={envoi || !valide} className={boutonPrincipal}>
            {envoi ? 'Envoi…' : 'Envoyer la demande'}
          </button>
        </div>
      </form>
    </Fenetre>
  )
}
