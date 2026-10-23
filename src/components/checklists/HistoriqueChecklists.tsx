import { useEffect, useState } from 'react'
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

const NB_JOURS = 7
const fmtCol = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric' })

/** Admin : qui a coché quoi et à quelle heure, sur les 7 derniers jours. Les tâches oubliées sont en rouge. */
export default function HistoriqueChecklists() {
  const [jours] = useState(() =>
    Array.from({ length: NB_JOURS }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (NB_JOURS - 1 - i))
      return jourLocal(d)
    }),
  )
  const [listes, setListes] = useState<Checklist[]>([])
  const [taches, setTaches] = useState<Tache[]>([])
  const [coches, setCoches] = useState<Coche[]>([])
  const [noms, setNoms] = useState<Noms>({})
  const [choisie, setChoisie] = useState('')
  const [charge, setCharge] = useState(false)

  useEffect(() => {
    void Promise.all([
      supabase.from('checklists').select(CHAMPS_CHECKLIST).order('ordre').order('nom'),
      supabase.from('checklist_taches').select(CHAMPS_TACHE).order('ordre'),
      supabase.from('checklist_coches').select(CHAMPS_COCHE).gte('jour', jours[0]),
      supabase.rpc('noms_equipe'),
    ]).then(([l, t, c, n]) => {
      setListes((l.data ?? []) as Checklist[])
      setTaches((t.data ?? []) as Tache[])
      setCoches((c.data ?? []) as Coche[])
      setNoms(
        Object.fromEntries(
          ((n.data ?? []) as { id: string; prenom: string; nom: string }[]).map((p) => [p.id, nomCourt(p)]),
        ),
      )
      setCharge(true)
    })
  }, [jours])

  if (!charge) return <p className="text-gris">Chargement…</p>
  if (!listes.length) return <p className="text-gris">Aucune liste pour l'instant.</p>

  const liste = listes.find((x) => x.id === choisie) ?? listes[0]
  const aujourdhui = jours[jours.length - 1]
  // Tâches actives, et tâches retirées qui ont encore des coches dans la période.
  const lignes = taches.filter(
    (t) => t.checklist_id === liste.id && (t.active || coches.some((c) => c.tache_id === t.id)),
  )

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5 text-sm font-semibold sm:w-72">
        Liste
        <select
          value={liste.id}
          onChange={(e) => setChoisie(e.target.value)}
          className="h-11 rounded-lg border border-[#C9CCD4] bg-white px-2"
        >
          {listes.map((l) => (
            <option key={l.id} value={l.id}>
              {l.nom}
            </option>
          ))}
        </select>
      </label>
      <div className="overflow-x-auto rounded-2xl border border-ligne bg-white">
        <table className="w-full min-w-[720px] border-collapse text-[13px]">
          <caption className="sr-only">Historique de la liste {liste.nom} sur 7 jours</caption>
          <thead className="bg-[#F8F9FB] text-gris">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Tâche</th>
              {jours.map((j) => (
                <th key={j} className="px-2 py-2 text-center font-semibold first-letter:uppercase">
                  {fmtCol.format(new Date(`${j}T12:00`))}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lignes.map((t) => (
              <tr key={t.id} className="border-t border-ligne">
                <th scope="row" className="px-3 py-2 text-left font-semibold">
                  {t.texte}
                  {!t.active && <span className="block text-xs font-medium text-gris">(retirée)</span>}
                </th>
                {jours.map((j) => {
                  const c = coches.find((x) => x.tache_id === t.id && x.jour === j)
                  if (c)
                    return (
                      <td key={j} className="px-2 py-2 text-center text-[#145C32]">
                        {(c.coche_par && noms[c.coche_par]) || '—'}
                        <span className="block text-xs">{heureLocale(new Date(c.coche_le))}</span>
                      </td>
                    )
                  if (!aFaireLe(liste, j) || jourLocal(new Date(t.cree_le)) > j)
                    return (
                      <td key={j} className="px-2 py-2 text-center text-gris">
                        —
                      </td>
                    )
                  if (j === aujourdhui)
                    return (
                      <td key={j} className="px-2 py-2 text-center text-gris">
                        À faire
                      </td>
                    )
                  return (
                    <td key={j} className="bg-[#FDE2E2] px-2 py-2 text-center font-bold text-[#9B1C1C]">
                      Oublié
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[13px] text-gris">« — » : liste pas prévue ce jour-là. Les tâches oubliées sont en rouge.</p>
    </div>
  )
}
