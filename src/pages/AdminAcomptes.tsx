import { useCallback, useEffect, useMemo, useState } from 'react'
import BadgeStatut from '../components/BadgeStatut'
import FenetreAjoutAcompte from '../components/acomptes/FenetreAjoutAcompte'
import { champ } from '../components/Fenetre'
import Gabarit from '../components/Gabarit'
import { IconePlus } from '../components/Icones'
import { couleurDe, initiales } from '../lib/couleurs'
import { euros } from '../lib/dates'
import { supabase } from '../lib/supabase'
import { CHAMPS_ACOMPTE, CHAMPS_PROFIL, type Acompte, type Equipe, type Profil, type StatutConge } from '../lib/types'
import { signalerDemandesModifiees } from '../lib/useDemandesEnAttente'

type Onglet = 'en_attente' | 'traitees'

const fmtDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' })

/** Demandes d'acompte sur salaire : l'admin accepte ou refuse, avec un message facultatif. */
export default function AdminAcomptes() {
  const [onglet, setOnglet] = useState<Onglet>('en_attente')
  const [acomptes, setAcomptes] = useState<Acompte[] | null>(null)
  const [profils, setProfils] = useState<Profil[]>([])
  const [equipes, setEquipes] = useState<Equipe[]>([])
  const [ajout, setAjout] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'erreur'; texte: string } | null>(null)
  const [debutMois] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })

  const charger = useCallback(
    () =>
      Promise.all([
        supabase.from('acomptes').select(CHAMPS_ACOMPTE).order('cree_le'),
        supabase.from('profiles').select(CHAMPS_PROFIL).order('prenom'),
        supabase.from('equipes').select('id, nom').order('nom'),
      ]).then(([a, p, e]) => {
        if (a.error || p.error) return setMessage({ type: 'erreur', texte: 'Impossible de charger les demandes.' })
        setAcomptes(a.data as Acompte[])
        setProfils(p.data as Profil[])
        setEquipes((e.data ?? []) as Equipe[])
      }),
    [],
  )

  useEffect(() => {
    void charger()
  }, [charger])

  async function repondre(c: Acompte, statut: StatutConge, reponse: string) {
    const { error } = await supabase
      .from('acomptes')
      .update({ statut, reponse: reponse.trim() || null })
      .eq('id', c.id)
    const p = profils.find((x) => x.id === c.employe_id)
    setMessage(
      error
        ? { type: 'erreur', texte: 'Réponse impossible. Réessayez.' }
        : { type: 'ok', texte: `Acompte de ${p?.prenom ?? "l'employé"} ${statut === 'accepte' ? 'accepté' : statut === 'refuse' ? 'refusé' : 'remis en attente'}.` },
    )
    signalerDemandesModifiees('acomptes')
    void charger()
  }

  const index = useMemo(() => new Map(profils.map((p, i) => [p.id, i])), [profils])
  // Acomptes déjà accordés ce mois-ci, par employé (pour aider à décider).
  const accordesCeMois = (id: string) =>
    (acomptes ?? [])
      .filter((a) => a.employe_id === id && a.statut === 'accepte' && a.traite_le && new Date(a.traite_le) >= debutMois)
      .reduce((t, a) => t + Number(a.montant), 0)

  const visibles = (acomptes ?? []).filter((c) => (onglet === 'en_attente') === (c.statut === 'en_attente'))
  if (onglet === 'traitees') visibles.reverse()
  const nbAttente = (acomptes ?? []).filter((c) => c.statut === 'en_attente').length

  return (
    <Gabarit
      titre="Demandes d'acompte"
      actions={
        <button
          type="button"
          onClick={() => setAjout(true)}
          className="flex h-11 items-center gap-2 rounded-xl bg-marque px-4 text-sm font-bold text-white hover:bg-marque-fonce sm:text-[15px]"
        >
          <IconePlus />
          Ajouter un acompte
        </button>
      }
    >
      <div role="tablist" className="mb-4 flex w-fit gap-1 rounded-xl bg-[#E8E9EE] p-1">
        {(
          [
            ['en_attente', `En attente${nbAttente ? ` (${nbAttente})` : ''}`],
            ['traitees', 'Traitées'],
          ] as const
        ).map(([id, texte]) => (
          <button
            key={id}
            role="tab"
            aria-selected={onglet === id}
            onClick={() => setOnglet(id)}
            className={`h-10 rounded-lg px-4 text-sm ${
              onglet === id ? 'bg-white font-bold shadow-sm' : 'font-semibold text-[#4A5060]'
            }`}
          >
            {texte}
          </button>
        ))}
      </div>

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

      {acomptes === null ? (
        <p className="text-gris">Chargement…</p>
      ) : visibles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#C9CCD4] bg-white p-8 text-center text-gris">
          {onglet === 'en_attente' ? 'Aucune demande en attente.' : 'Aucune demande traitée pour le moment.'}
        </div>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {visibles.map((c) => {
            const p = profils.find((x) => x.id === c.employe_id)
            const couleur = couleurDe(index.get(c.employe_id) ?? 0)
            const equipe = equipes.find((e) => e.id === p?.equipe_id)
            return (
              <CarteAcompte
                key={c.id}
                acompte={c}
                nom={p ? `${p.prenom} ${p.nom}` : 'Employé'}
                ini={p ? initiales(p.prenom, p.nom) : '?'}
                couleur={couleur}
                equipe={equipe?.nom}
                dejaCeMois={accordesCeMois(c.employe_id)}
                onRepondre={repondre}
              />
            )
          })}
        </ul>
      )}

      {ajout && (
        <FenetreAjoutAcompte
          employes={profils.filter((p) => p.actif)}
          onFermer={() => setAjout(false)}
          onAjoute={(texte) => {
            setAjout(false)
            setOnglet('traitees')
            setMessage({ type: 'ok', texte })
            void charger()
          }}
        />
      )}
    </Gabarit>
  )
}

function CarteAcompte({
  acompte: c,
  nom,
  ini,
  couleur,
  equipe,
  dejaCeMois,
  onRepondre,
}: {
  acompte: Acompte
  nom: string
  ini: string
  couleur: { fond: string; texte: string }
  equipe?: string
  dejaCeMois: number
  onRepondre: (c: Acompte, statut: StatutConge, reponse: string) => Promise<void>
}) {
  const [reponse, setReponse] = useState('')
  const [envoi, setEnvoi] = useState(false)

  async function agir(statut: StatutConge) {
    setEnvoi(true)
    await onRepondre(c, statut, reponse)
    setEnvoi(false)
  }

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-ligne bg-white p-4">
      <div className="flex items-center gap-3">
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-[13px] font-bold"
          style={{ background: couleur.fond, color: couleur.texte }}
        >
          {ini}
        </div>
        <div className="mr-auto min-w-0">
          <div className="truncate font-bold">{nom}</div>
          {equipe && <div className="text-xs font-semibold text-gris">Équipe {equipe}</div>}
        </div>
        <BadgeStatut statut={c.statut} />
      </div>
      <div>
        <div className="text-xl font-extrabold">{euros(c.montant)}</div>
        <div className="text-sm text-gris">
          Demandé le {fmtDate.format(new Date(c.cree_le))}
          {c.motif && ` · ${c.motif}`}
        </div>
      </div>

      {c.statut === 'en_attente' ? (
        <>
          {dejaCeMois > 0 && (
            <p className="rounded-lg bg-[#FFF1C2] px-3 py-2 text-sm text-[#6B4E00]">
              Déjà {euros(dejaCeMois)} d'acompte accordé ce mois-ci.
            </p>
          )}
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Message pour l'employé (facultatif)
            <input
              type="text"
              maxLength={300}
              value={reponse}
              onChange={(e) => setReponse(e.target.value)}
              className={champ}
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={envoi}
              onClick={() => void agir('refuse')}
              className="h-11 rounded-xl border border-[#F1B4B4] font-bold text-[#9B1C1C] hover:bg-red-50 disabled:opacity-60"
            >
              Refuser
            </button>
            <button
              type="button"
              disabled={envoi}
              onClick={() => void agir('accepte')}
              className="h-11 rounded-xl bg-[#1F7A45] font-bold text-white hover:bg-[#145C32] disabled:opacity-60"
            >
              Accepter
            </button>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-sm text-gris">
          {c.reponse && <span className="rounded-lg bg-fond px-3 py-1.5 text-encre">« {c.reponse} »</span>}
          <button
            type="button"
            disabled={envoi}
            onClick={() => void agir('en_attente')}
            className="ml-auto h-9 rounded-lg px-2 text-sm font-semibold text-marque-fonce hover:bg-marque-doux"
          >
            Remettre en attente
          </button>
        </div>
      )}
    </li>
  )
}
