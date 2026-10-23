import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { aFaireLe, CHAMPS_CHECKLIST, type Checklist } from '../../lib/checklists'
import { jourLocal } from '../../lib/dates'
import { supabase } from '../../lib/supabase'

/** Carte « Checklists du jour » sur le planning : avancement de chaque liste, lien vers la page. */
export default function CarteChecklists() {
  const [resume, setResume] = useState<{ nom: string; faites: number; total: number }[] | null>(null)

  useEffect(() => {
    if (!navigator.onLine) return
    const aujourdhui = jourLocal(new Date())
    void Promise.all([
      supabase.from('checklists').select(CHAMPS_CHECKLIST).order('ordre').order('nom'),
      supabase.from('checklist_taches').select('id, checklist_id').eq('active', true),
      supabase.from('checklist_coches').select('tache_id').eq('jour', aujourdhui),
    ]).then(([l, t, c]) => {
      if (l.error || t.error || c.error) return
      const taches = t.data as { id: string; checklist_id: string }[]
      const cochees = new Set((c.data as { tache_id: string }[]).map((x) => x.tache_id))
      setResume(
        (l.data as Checklist[])
          .filter((x) => aFaireLe(x, aujourdhui))
          .map((x) => {
            const siennes = taches.filter((tc) => tc.checklist_id === x.id)
            return { nom: x.nom, total: siennes.length, faites: siennes.filter((tc) => cochees.has(tc.id)).length }
          })
          .filter((x) => x.total > 0),
      )
    })
  }, [])

  if (!resume?.length) return null
  return (
    <Link
      to="/taches"
      className="col-span-2 block rounded-2xl border border-ligne bg-white p-4 text-encre hover:bg-fond lg:col-span-1"
    >
      <div className="text-[13px] font-semibold text-gris">Checklists du jour</div>
      <ul className="mt-1 flex flex-col gap-0.5">
        {resume.map((x) => (
          <li key={x.nom} className="flex gap-2 text-sm">
            <span className="mr-auto font-bold">{x.nom}</span>
            <span className={x.faites === x.total ? 'font-bold text-[#145C32]' : 'text-gris'}>
              {x.faites === x.total ? 'Fait ✓' : `${x.faites}/${x.total}`}
            </span>
          </li>
        ))}
      </ul>
    </Link>
  )
}
