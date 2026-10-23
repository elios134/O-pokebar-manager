import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { CHAMPS_CORRECTION, texteJours, type Correction, type Solde } from '../../lib/rh'

const fmtDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

function premierDuMoisSuivant() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth() + 1, 1)
}

/** Solde de congés de l'employé connecté : acquis, pris, corrections, restant, et le détail. */
export default function CarteSolde({ employeId }: { employeId: string }) {
  const [solde, setSolde] = useState<Solde | null>(null)
  const [corrections, setCorrections] = useState<Correction[]>([])
  const [detail, setDetail] = useState(false)
  const [prochain] = useState(premierDuMoisSuivant)

  useEffect(() => {
    void Promise.all([
      supabase.rpc('soldes_conges'),
      supabase.from('conges_corrections').select(CHAMPS_CORRECTION).eq('employe_id', employeId).order('le'),
    ]).then(([s, c]) => {
      const ligne = ((s.data ?? []) as Solde[]).find((x) => x.employe_id === employeId)
      if (ligne) setSolde(ligne)
      setCorrections((c.data ?? []) as Correction[])
    })
  }, [employeId])

  if (!solde) return null
  const restant = Number(solde.restant)
  return (
    <section
      aria-label="Mon solde de congés"
      className="mb-4 flex flex-col gap-3 rounded-2xl border border-ligne bg-white p-4 sm:max-w-md"
    >
      <div className="flex items-baseline gap-2">
        <span className="mr-auto text-sm font-bold text-gris">Mon solde</span>
        <span className={`text-3xl font-extrabold ${restant < 0 ? 'text-[#9B1C1C]' : 'text-[#145C32]'}`}>
          {texteJours(restant)}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {(
          [
            ['acquis', texteJours(solde.acquis)],
            ['pris', texteJours(-solde.pris)],
            ['corrections', texteJours(solde.corrections, true)],
          ] as const
        ).map(([nom, valeur]) => (
          <div key={nom} className="rounded-lg bg-fond px-1 py-2">
            <div className="font-extrabold">{valeur}</div>
            <div className="text-xs text-gris">{nom}</div>
          </div>
        ))}
      </div>
      <p className="text-xs text-gris">+2,5 j chaque mois · prochain ajout le {fmtDate.format(prochain)}</p>
      <button
        type="button"
        onClick={() => setDetail((d) => !d)}
        aria-expanded={detail}
        className="w-fit text-sm font-bold text-marque-fonce"
      >
        {detail ? 'Masquer le détail' : 'Voir le détail'}
      </button>
      {detail && (
        <ul className="flex flex-col gap-1.5 border-t border-ligne pt-3 text-sm">
          <li className="flex gap-2">
            <span className="mr-auto">Acquis depuis le {fmtDate.format(new Date(`${solde.depuis}T12:00`))}</span>
            <b>{texteJours(solde.acquis, true)}</b>
          </li>
          <li className="flex gap-2">
            <span className="mr-auto">Congés acceptés (lundi au samedi)</span>
            <b>{texteJours(-solde.pris)}</b>
          </li>
          {corrections.map((c) => (
            <li key={c.id} className="flex gap-2">
              <span className="mr-auto">
                {c.motif} <span className="text-gris">· {fmtDate.format(new Date(`${c.le}T12:00`))}</span>
              </span>
              <b>{texteJours(c.jours, true)}</b>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
