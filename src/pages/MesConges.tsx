import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import BadgeStatut from '../components/BadgeStatut'
import Fenetre, { boutonPrincipal, boutonSecondaire, champ, etiquette } from '../components/Fenetre'
import Gabarit from '../components/Gabarit'
import { IconePlus } from '../components/Icones'
import { formatPeriode, jourLocal, nbJours } from '../lib/dates'
import { supabase } from '../lib/supabase'
import { CHAMPS_CONGE, type Conge } from '../lib/types'

export default function MesConges() {
  const { profil } = useAuth()
  const [conges, setConges] = useState<Conge[] | null>(null)
  const [demande, setDemande] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'erreur'; texte: string } | null>(null)

  const charger = useCallback(
    () =>
      supabase
        .from('conges')
        .select(CHAMPS_CONGE)
        .eq('employe_id', profil!.id)
        .order('debut', { ascending: false })
        .then(({ data, error }) => {
          if (error) setMessage({ type: 'erreur', texte: 'Impossible de charger vos demandes.' })
          else setConges(data as Conge[])
        }),
    [profil],
  )

  useEffect(() => {
    void charger()
  }, [charger])

  async function annuler(c: Conge) {
    if (!window.confirm('Annuler cette demande de congé ?')) return
    const { error } = await supabase.from('conges').delete().eq('id', c.id)
    setMessage(error ? { type: 'erreur', texte: 'Annulation impossible.' } : { type: 'ok', texte: 'Demande annulée.' })
    void charger()
  }

  return (
    <Gabarit
      titre="Mes congés"
      actions={
        <button
          type="button"
          onClick={() => setDemande(true)}
          className="flex h-11 items-center gap-2 rounded-xl bg-marque px-4 text-sm font-bold text-white hover:bg-marque-fonce sm:text-[15px]"
        >
          <IconePlus />
          Demander un congé
        </button>
      }
    >
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

      {conges === null ? (
        <p className="text-gris">Chargement…</p>
      ) : conges.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#C9CCD4] bg-white p-8 text-center text-gris">
          Vous n'avez encore fait aucune demande de congé.
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {conges.map((c) => (
            <li key={c.id} className="rounded-2xl border border-ligne bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-auto font-bold first-letter:uppercase">{formatPeriode(c.debut, c.fin)}</span>
                <BadgeStatut statut={c.statut} />
              </div>
              <div className="mt-1 text-sm text-gris">
                {nbJours(c.debut, c.fin)} jour{nbJours(c.debut, c.fin) > 1 ? 's' : ''}
                {c.motif && ` · ${c.motif}`}
              </div>
              {c.reponse && (
                <div className="mt-2 rounded-lg bg-fond px-3 py-2 text-sm">
                  <span className="font-semibold">Réponse : </span>
                  {c.reponse}
                </div>
              )}
              {c.statut === 'en_attente' && (
                <button
                  type="button"
                  onClick={() => void annuler(c)}
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

function FenetreDemande({
  employeId,
  onFermer,
  onEnvoyee,
}: {
  employeId: string
  onFermer: () => void
  onEnvoyee: () => void
}) {
  const [debut, setDebut] = useState(() => jourLocal(new Date()))
  const [fin, setFin] = useState(debut)
  const [motif, setMotif] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const datesValides = Boolean(debut && fin && fin >= debut)

  async function envoyer(e: FormEvent) {
    e.preventDefault()
    if (!datesValides) return
    setEnvoi(true)
    const { error } = await supabase
      .from('conges')
      .insert({ employe_id: employeId, debut, fin, motif: motif.trim() || null })
    setEnvoi(false)
    if (error) return setErreur("Envoi impossible. Vérifiez les dates et réessayez.")
    onEnvoyee()
  }

  return (
    <Fenetre titre="Demander un congé" onFermer={onFermer}>
      <form onSubmit={envoyer} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <label className={etiquette}>
            Du
            <input
              type="date"
              required
              value={debut}
              onChange={(e) => {
                setDebut(e.target.value)
                if (fin < e.target.value) setFin(e.target.value)
              }}
              className={champ}
            />
          </label>
          <label className={etiquette}>
            Au (inclus)
            <input type="date" required min={debut} value={fin} onChange={(e) => setFin(e.target.value)} className={champ} />
          </label>
        </div>
        {datesValides ? (
          <p className="-mt-2 text-[13px] text-gris">
            {nbJours(debut, fin)} jour{nbJours(debut, fin) > 1 ? 's' : ''}
          </p>
        ) : (
          <p className="-mt-2 text-[13px] font-semibold text-red-800">La date de fin doit être après la date de début.</p>
        )}
        <label className={etiquette}>
          Motif (facultatif)
          <input
            type="text"
            maxLength={300}
            placeholder="Ex. : vacances, rendez-vous…"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            className={champ}
          />
        </label>
        {erreur && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            {erreur}
          </p>
        )}
        <div className="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onFermer} className={boutonSecondaire}>
            Annuler
          </button>
          <button type="submit" disabled={envoi || !datesValides} className={boutonPrincipal}>
            {envoi ? 'Envoi…' : 'Envoyer la demande'}
          </button>
        </div>
      </form>
    </Fenetre>
  )
}
