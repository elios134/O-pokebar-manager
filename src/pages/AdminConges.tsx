import { useCallback, useEffect, useMemo, useState } from 'react'
import BadgeStatut from '../components/BadgeStatut'
import { champ } from '../components/Fenetre'
import Gabarit from '../components/Gabarit'
import { couleurDe, initiales } from '../lib/couleurs'
import { dateDuJour, formatPeriode, jourSuivant, nbJours } from '../lib/dates'
import { supabase } from '../lib/supabase'
import { CHAMPS_CONGE, CHAMPS_PROFIL, type Conge, type Equipe, type Profil, type StatutConge } from '../lib/types'
import { signalerDemandesModifiees } from '../lib/useDemandesEnAttente'

type Onglet = 'en_attente' | 'traitees'

export default function AdminConges() {
  const [onglet, setOnglet] = useState<Onglet>('en_attente')
  const [conges, setConges] = useState<Conge[] | null>(null)
  const [profils, setProfils] = useState<Profil[]>([])
  const [equipes, setEquipes] = useState<Equipe[]>([])
  const [horairesPendant, setHorairesPendant] = useState<Record<string, number>>({})
  const [message, setMessage] = useState<{ type: 'ok' | 'erreur'; texte: string } | null>(null)

  async function afficher(
    c: { data: unknown; error: unknown },
    p: { data: unknown; error: unknown },
    e: { data: unknown },
  ) {
    if (c.error || p.error) return setMessage({ type: 'erreur', texte: 'Impossible de charger les demandes.' })
    const liste = c.data as Conge[]
    setConges(liste)
    setProfils(p.data as Profil[])
    setEquipes((e.data ?? []) as Equipe[])

    // Horaires déjà prévus pendant les congés en attente (pour aider à décider).
    const attente = liste.filter((x) => x.statut === 'en_attente')
    const comptes: Record<string, number> = {}
    await Promise.all(
      attente.map(async (x) => {
        const { count } = await supabase
          .from('shifts')
          .select('id', { count: 'exact', head: true })
          .eq('employe_id', x.employe_id)
          .lt('debut', dateDuJour(jourSuivant(x.fin)).toISOString())
          .gt('fin', dateDuJour(x.debut).toISOString())
        comptes[x.id] = count ?? 0
      }),
    )
    setHorairesPendant(comptes)
  }

  const charger = useCallback(
    () =>
      Promise.all([
        supabase.from('conges').select(CHAMPS_CONGE).order('debut'),
        supabase.from('profiles').select(CHAMPS_PROFIL).order('prenom'),
        supabase.from('equipes').select('id, nom').order('nom'),
      ]).then(([c, p, e]) => afficher(c, p, e)),
    [],
  )

  useEffect(() => {
    void charger()
  }, [charger])

  async function repondre(c: Conge, statut: StatutConge, reponse: string) {
    const { error } = await supabase
      .from('conges')
      .update({ statut, reponse: reponse.trim() || null })
      .eq('id', c.id)
    const p = profils.find((x) => x.id === c.employe_id)
    setMessage(
      error
        ? { type: 'erreur', texte: 'Réponse impossible. Réessayez.' }
        : { type: 'ok', texte: `Congé de ${p?.prenom ?? "l'employé"} ${statut === 'accepte' ? 'accepté' : 'refusé'}.` },
    )
    signalerDemandesModifiees('conges')
    void charger()
  }

  const index = useMemo(() => new Map(profils.map((p, i) => [p.id, i])), [profils])
  const visibles = (conges ?? []).filter((c) => (onglet === 'en_attente') === (c.statut === 'en_attente'))
  if (onglet === 'traitees') visibles.reverse()
  const nbAttente = (conges ?? []).filter((c) => c.statut === 'en_attente').length

  return (
    <Gabarit titre="Demandes de congé">
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

      {conges === null ? (
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
              <CarteConge
                key={c.id}
                conge={c}
                nom={p ? `${p.prenom} ${p.nom}` : 'Employé'}
                ini={p ? initiales(p.prenom, p.nom) : '?'}
                couleur={couleur}
                equipe={equipe?.nom}
                horaires={horairesPendant[c.id] ?? 0}
                onRepondre={repondre}
              />
            )
          })}
        </ul>
      )}
    </Gabarit>
  )
}

function CarteConge({
  conge: c,
  nom,
  ini,
  couleur,
  equipe,
  horaires,
  onRepondre,
}: {
  conge: Conge
  nom: string
  ini: string
  couleur: { fond: string; texte: string }
  equipe?: string
  horaires: number
  onRepondre: (c: Conge, statut: StatutConge, reponse: string) => Promise<void>
}) {
  const [reponse, setReponse] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const jours = nbJours(c.debut, c.fin)

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
        <div className="font-semibold first-letter:uppercase">{formatPeriode(c.debut, c.fin)}</div>
        <div className="text-sm text-gris">
          {jours} jour{jours > 1 ? 's' : ''}
          {c.motif && ` · ${c.motif}`}
        </div>
      </div>

      {c.statut === 'en_attente' ? (
        <>
          {horaires > 0 && (
            <p className="rounded-lg bg-[#FFF1C2] px-3 py-2 text-sm text-[#6B4E00]">
              {horaires} horaire{horaires > 1 ? 's' : ''} déjà prévu{horaires > 1 ? 's' : ''} pendant ce congé.
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
