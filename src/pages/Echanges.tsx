import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import CarteEchange from '../components/CarteEchange'
import Fenetre, { boutonPrincipal, boutonSecondaire, champ, etiquette } from '../components/Fenetre'
import Gabarit from '../components/Gabarit'
import { IconePlus } from '../components/Icones'
import { action, chargerEchanges, texteHoraire, type Echange } from '../lib/echanges'
import { supabase } from '../lib/supabase'
import { signalerEchangesModifies } from '../lib/useCongesEnAttente'

type Message = { type: 'ok' | 'erreur'; texte: string } | null

export default function Echanges() {
  const { profil } = useAuth()
  const [liste, setListe] = useState<Echange[] | null>(null)
  const [proposition, setProposition] = useState(false)
  const [message, setMessage] = useState<Message>(null)
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

  async function faire(id: string, nom: string, params: Record<string, unknown>, ok: string) {
    setEnCours(id)
    const err = await action(nom, params)
    setEnCours(null)
    setMessage(err ? { type: 'erreur', texte: err } : { type: 'ok', texte: ok })
    signalerEchangesModifies()
    void charger()
  }

  const moi = profil?.id
  const aRepondre = (liste ?? []).filter((e) => e.destinataire_id === moi && e.statut === 'attente_collegue')
  const autres = (liste ?? []).filter((e) => !aRepondre.includes(e))

  return (
    <Gabarit
      titre="Échanges d'horaires"
      actions={
        <button
          type="button"
          onClick={() => setProposition(true)}
          className="flex h-11 items-center gap-2 rounded-xl bg-marque px-4 text-sm font-bold text-white hover:bg-marque-fonce sm:text-[15px]"
        >
          <IconePlus />
          Proposer un échange
        </button>
      }
    >
      <p className="mb-4 text-sm text-gris">
        Proposez un de vos horaires à un collègue (en échange d'un des siens, ou en le lui cédant). Une fois accepté par le
        collègue, votre responsable valide et le planning se met à jour.
      </p>

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
          {aRepondre.length > 0 && (
            <section className="mb-6">
              <h2 className="mb-2 text-lg font-extrabold">À vous de répondre</h2>
              <ul className="grid gap-3 lg:grid-cols-2">
                {aRepondre.map((e) => (
                  <CarteEchange key={e.id} e={e}>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={enCours === e.id}
                        onClick={() => void faire(e.id, 'repondre_echange', { p_id: e.id, p_accepte: false }, 'Échange refusé.')}
                        className="h-11 rounded-xl border border-[#F1B4B4] font-bold text-[#9B1C1C] hover:bg-red-50 disabled:opacity-60"
                      >
                        Refuser
                      </button>
                      <button
                        type="button"
                        disabled={enCours === e.id}
                        onClick={() =>
                          void faire(e.id, 'repondre_echange', { p_id: e.id, p_accepte: true }, 'Accepté. Il reste la validation du responsable.')
                        }
                        className="h-11 rounded-xl bg-[#1F7A45] font-bold text-white hover:bg-[#145C32] disabled:opacity-60"
                      >
                        Accepter
                      </button>
                    </div>
                  </CarteEchange>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2 className="mb-2 text-lg font-extrabold">Mes échanges</h2>
            {autres.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#C9CCD4] bg-white p-8 text-center text-gris">
                Aucun échange pour le moment.
              </div>
            ) : (
              <ul className="grid gap-3 lg:grid-cols-2">
                {autres.map((e) => (
                  <CarteEchange key={e.id} e={e}>
                    {e.demandeur_id === moi && (e.statut === 'attente_collegue' || e.statut === 'attente_admin') && (
                      <button
                        type="button"
                        disabled={enCours === e.id}
                        onClick={() => void faire(e.id, 'annuler_echange', { p_id: e.id }, 'Demande annulée.')}
                        className="h-10 self-start rounded-lg border border-[#C9CCD4] px-3 text-sm font-semibold hover:bg-fond"
                      >
                        Annuler la demande
                      </button>
                    )}
                  </CarteEchange>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {proposition && profil && (
        <FenetreProposition
          moi={profil.id}
          onFermer={() => setProposition(false)}
          onEnvoye={() => {
            setProposition(false)
            setMessage({ type: 'ok', texte: 'Proposition envoyée à votre collègue.' })
            signalerEchangesModifies()
            void charger()
          }}
        />
      )}
    </Gabarit>
  )
}

interface Option {
  id: string
  debut: string
  fin: string
}

function FenetreProposition({ moi, onFermer, onEnvoye }: { moi: string; onFermer: () => void; onEnvoye: () => void }) {
  const [mesHoraires, setMesHoraires] = useState<Option[] | null>(null)
  const [collegues, setCollegues] = useState<{ id: string; prenom: string; nom: string }[]>([])
  const [horairesCollegue, setHorairesCollegue] = useState<Option[]>([])
  const [monHoraire, setMonHoraire] = useState('')
  const [collegue, setCollegue] = useState('')
  const [type, setType] = useState<'echange' | 'cession'>('echange')
  const [sonHoraire, setSonHoraire] = useState('')
  const [texte, setTexte] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)

  useEffect(() => {
    void Promise.all([
      supabase
        .from('shifts')
        .select('id, debut, fin')
        .eq('employe_id', moi)
        .gt('debut', new Date().toISOString())
        .order('debut')
        .limit(60),
      supabase.rpc('collegues'),
    ]).then(([h, c]) => {
      setMesHoraires((h.data ?? []) as Option[])
      setCollegues((c.data ?? []) as { id: string; prenom: string; nom: string }[])
    })
  }, [moi])

  useEffect(() => {
    if (!collegue) return
    let annule = false
    void supabase.rpc('horaires_collegue', { p_collegue: collegue }).then(({ data }) => {
      if (!annule) setHorairesCollegue((data ?? []) as Option[])
    })
    return () => {
      annule = true
    }
  }, [collegue])

  const pret = monHoraire && collegue && (type === 'cession' || sonHoraire)

  async function envoyer(e: FormEvent) {
    e.preventDefault()
    if (!pret) return
    setEnvoi(true)
    setErreur(null)
    const err = await action('proposer_echange', {
      p_horaire: monHoraire,
      p_collegue: collegue,
      p_horaire_collegue: type === 'echange' ? sonHoraire : null,
      p_message: texte,
    })
    setEnvoi(false)
    if (err) return setErreur(err)
    onEnvoye()
  }

  return (
    <Fenetre titre="Proposer un échange" onFermer={onFermer}>
      <form onSubmit={envoyer} className="flex flex-col gap-4">
        <label className={etiquette}>
          Mon horaire
          <select required value={monHoraire} onChange={(e) => setMonHoraire(e.target.value)} className={champ}>
            <option value="">{mesHoraires === null ? 'Chargement…' : mesHoraires.length ? 'Choisir…' : 'Aucun horaire à venir'}</option>
            {(mesHoraires ?? []).map((h) => (
              <option key={h.id} value={h.id}>
                {texteHoraire(h.debut, h.fin)}
              </option>
            ))}
          </select>
        </label>
        <label className={etiquette}>
          Collègue
          <select
            required
            value={collegue}
            onChange={(e) => {
              setCollegue(e.target.value)
              setSonHoraire('')
              setHorairesCollegue([])
            }}
            className={champ}
          >
            <option value="">Choisir…</option>
            {collegues.map((c) => (
              <option key={c.id} value={c.id}>
                {c.prenom} {c.nom}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-semibold">Type</legend>
          <label className="flex min-h-11 items-center gap-2.5 rounded-lg border border-ligne px-3 text-[15px]">
            <input type="radio" name="type" checked={type === 'echange'} onChange={() => setType('echange')} className="size-4" />
            Échanger contre un de ses horaires
          </label>
          <label className="flex min-h-11 items-center gap-2.5 rounded-lg border border-ligne px-3 text-[15px]">
            <input type="radio" name="type" checked={type === 'cession'} onChange={() => setType('cession')} className="size-4" />
            Lui céder mon horaire (rien en retour)
          </label>
        </fieldset>
        {type === 'echange' && (
          <label className={etiquette}>
            Son horaire
            <select required value={sonHoraire} disabled={!collegue} onChange={(e) => setSonHoraire(e.target.value)} className={champ}>
              <option value="">
                {!collegue ? "Choisissez d'abord un collègue" : horairesCollegue.length ? 'Choisir…' : 'Aucun horaire à venir'}
              </option>
              {horairesCollegue.map((h) => (
                <option key={h.id} value={h.id}>
                  {texteHoraire(h.debut, h.fin)}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className={etiquette}>
          Message (facultatif)
          <input type="text" maxLength={300} value={texte} onChange={(e) => setTexte(e.target.value)} className={champ} />
        </label>
        {erreur && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            {erreur}
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onFermer} className={boutonSecondaire}>
            Annuler
          </button>
          <button type="submit" disabled={envoi || !pret} className={boutonPrincipal}>
            {envoi ? 'Envoi…' : 'Envoyer la proposition'}
          </button>
        </div>
      </form>
    </Fenetre>
  )
}
