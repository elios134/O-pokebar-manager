import { useCallback, useEffect, useState } from 'react'
import {
  aFaireLe,
  CHAMPS_CHECKLIST,
  CHAMPS_COCHE,
  CHAMPS_TACHE,
  nomCourt,
  type Checklist,
  type Coche,
  type Noms,
  type Tache,
} from '../../lib/checklists'
import { heureLocale, jourLocal } from '../../lib/dates'
import { supabase } from '../../lib/supabase'
import Message, { type TypeMessage } from '../Message'
import Onglets from '../Onglets'

const fmtJour = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

/** Les listes du jour à cocher (chacun coche en son nom ; on peut décocher sa propre coche le jour même). */
export default function ChecklistsDuJour({ moi, admin }: { moi: string; admin: boolean }) {
  const [aujourdhui] = useState(() => jourLocal(new Date()))
  const [listes, setListes] = useState<Checklist[] | null>(null)
  const [taches, setTaches] = useState<Tache[]>([])
  const [coches, setCoches] = useState<Coche[]>([])
  const [noms, setNoms] = useState<Noms>({})
  const [choisie, setChoisie] = useState<string | null>(null)
  const [message, setMessage] = useState<TypeMessage | null>(null)

  const charger = useCallback(
    () =>
      Promise.all([
        supabase.from('checklists').select(CHAMPS_CHECKLIST).order('ordre').order('nom'),
        supabase.from('checklist_taches').select(CHAMPS_TACHE).eq('active', true).order('ordre'),
        supabase.from('checklist_coches').select(CHAMPS_COCHE).eq('jour', aujourdhui),
        supabase.rpc('noms_equipe'),
      ]).then(([l, t, c, n]) => {
        if (l.error || t.error || c.error)
          return setMessage({ type: 'erreur', texte: 'Impossible de charger les checklists.' })
        setListes((l.data as Checklist[]).filter((x) => aFaireLe(x, aujourdhui)))
        setTaches(t.data as Tache[])
        setCoches(c.data as Coche[])
        setNoms(
          Object.fromEntries(
            ((n.data ?? []) as { id: string; prenom: string; nom: string }[]).map((p) => [p.id, nomCourt(p)]),
          ),
        )
      }),
    [aujourdhui],
  )

  useEffect(() => {
    void charger()
  }, [charger])

  async function basculer(t: Tache, coche: Coche | undefined) {
    setMessage(null)
    if (coche) {
      if (coche.coche_par !== moi && !admin) return
      const { error } = await supabase.from('checklist_coches').delete().eq('id', coche.id)
      if (error) setMessage({ type: 'erreur', texte: 'Impossible de décocher.' })
    } else {
      const { error } = await supabase.from('checklist_coches').insert({ tache_id: t.id })
      // Déjà cochée par quelqu'un d'autre entre-temps : on recharge simplement.
      if (error && error.code !== '23505')
        setMessage({ type: 'erreur', texte: 'Impossible de cocher. Vérifiez la connexion.' })
    }
    void charger()
  }

  if (listes === null) return message ? <Message message={message} /> : <p className="text-gris">Chargement…</p>
  if (listes.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#C9CCD4] bg-white p-8 text-center text-gris">
        Aucune checklist aujourd'hui.{admin && ' Créez-en une dans « Gérer les listes ».'}
      </div>
    )
  }

  const actuelle = listes.find((x) => x.id === choisie) ?? listes[0]
  const dansListe = (id: string) => taches.filter((t) => t.checklist_id === id)
  const coche = (t: Tache) => coches.find((c) => c.tache_id === t.id)
  const faites = (id: string) => dansListe(id).filter(coche).length
  const liste = dansListe(actuelle.id)
  const pourcent = liste.length ? Math.round((faites(actuelle.id) / liste.length) * 100) : 0

  return (
    <div className="sm:max-w-2xl">
      <p className="mb-3 text-sm text-gris first-letter:uppercase">{fmtJour.format(new Date(`${aujourdhui}T12:00`))}</p>
      <Onglets
        large
        onglets={listes.map((l) => {
          const n = dansListe(l.id).length
          const f = faites(l.id)
          return { id: l.id, texte: `${l.nom} ${n && f === n ? '✓' : `${f}/${n}`}` }
        })}
        actif={actuelle.id}
        onChoisir={setChoisie}
      />
      <Message message={message} />
      <div
        className="mb-3 h-2 overflow-hidden rounded-full bg-ligne"
        role="progressbar"
        aria-label={`Avancement ${actuelle.nom}`}
        aria-valuenow={pourcent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full bg-[#1F7A45] transition-[width]" style={{ width: `${pourcent}%` }} />
      </div>
      {liste.length === 0 ? (
        <p className="text-gris">Cette liste n'a pas encore de tâche.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {liste.map((t) => {
            const c = coche(t)
            const verrouillee = !!c && c.coche_par !== moi && !admin
            return (
              <li key={t.id}>
                <label
                  className={`flex min-h-14 items-center gap-3 rounded-2xl border border-ligne bg-white px-4 py-2 ${verrouillee ? '' : 'cursor-pointer'}`}
                >
                  <input
                    type="checkbox"
                    checked={!!c}
                    disabled={verrouillee}
                    onChange={() => void basculer(t, c)}
                    className="size-6 shrink-0 accent-[#1F7A45]"
                  />
                  <span className="min-w-0">
                    <span className={`block font-bold ${c ? 'text-gris line-through' : ''}`}>{t.texte}</span>
                    {c && (
                      <span className="text-xs text-gris">
                        {(c.coche_par && noms[c.coche_par]) || 'Quelqu’un'} · {heureLocale(new Date(c.coche_le))}
                      </span>
                    )}
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
