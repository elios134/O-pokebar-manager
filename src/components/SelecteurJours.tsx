import { useState } from 'react'
import { jourLocal } from '../lib/dates'

const fmtMois = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' })
const ENTETES = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

/** Mini-calendrier : on touche les jours pour les sélectionner ou les retirer. */
export default function SelecteurJours({
  selection,
  onBasculer,
  joursConge,
}: {
  selection: Set<string>
  onBasculer: (jour: string) => void
  /** Jours où l'employé est en congé accepté */
  joursConge: Set<string>
}) {
  const [mois, setMois] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [aujourdhui] = useState(() => jourLocal(new Date()))

  const premier = new Date(mois)
  const decalage = (premier.getDay() + 6) % 7
  const nbJours = new Date(mois.getFullYear(), mois.getMonth() + 1, 0).getDate()
  const cases: (string | null)[] = Array.from({ length: decalage }, () => null)
  for (let j = 1; j <= nbJours; j++) cases.push(jourLocal(new Date(mois.getFullYear(), mois.getMonth(), j)))

  const changerMois = (n: number) => setMois(new Date(mois.getFullYear(), mois.getMonth() + n, 1))

  return (
    <div className="rounded-xl border border-ligne p-3">
      <div className="mb-2 flex items-center">
        <button
          type="button"
          onClick={() => changerMois(-1)}
          aria-label="Mois précédent"
          className="flex size-10 items-center justify-center rounded-lg hover:bg-fond"
        >
          ‹
        </button>
        <span className="flex-1 text-center font-bold first-letter:uppercase">{fmtMois.format(mois)}</span>
        <button
          type="button"
          onClick={() => changerMois(1)}
          aria-label="Mois suivant"
          className="flex size-10 items-center justify-center rounded-lg hover:bg-fond"
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {ENTETES.map((e, i) => (
          <span key={i} className="text-[11px] font-bold text-gris">
            {e}
          </span>
        ))}
        {cases.map((jour, i) =>
          jour ? (
            <button
              key={jour}
              type="button"
              onClick={() => onBasculer(jour)}
              aria-pressed={selection.has(jour)}
              aria-label={`${jour}${joursConge.has(jour) ? ' (en congé)' : ''}`}
              className={`relative h-10 rounded-lg text-sm font-semibold ${
                selection.has(jour)
                  ? 'bg-marque text-white'
                  : jour === aujourdhui
                    ? 'bg-marque-doux text-marque-fonce'
                    : 'hover:bg-fond'
              }`}
            >
              {Number(jour.slice(8))}
              {joursConge.has(jour) && (
                <span className="absolute bottom-1 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-[#D9822B]" />
              )}
            </button>
          ) : (
            <span key={`vide-${i}`} />
          ),
        )}
      </div>
      {joursConge.size > 0 && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-gris">
          <span className="size-1.5 rounded-full bg-[#D9822B]" /> Jour de congé accepté
        </p>
      )}
    </div>
  )
}
