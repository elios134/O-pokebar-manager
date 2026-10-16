import type { Creneau } from '../../lib/creneaux'
import BlocPause, { petitChamp } from '../BlocPause'

const NOUVEAU_SOIR: Creneau = { debut: '18:00', fin: '22:00', pauseDebut: '', pauseFin: '' }

/** Saisie d'un ou deux créneaux (deux = coupure), chacun avec une pause facultative. */
export default function EditeurCreneaux({ valeur, onChange }: { valeur: Creneau[]; onChange: (c: Creneau[]) => void }) {
  const modifier = (i: number, champs: Partial<Creneau>) => onChange(valeur.map((c, j) => (j === i ? { ...c, ...champs } : c)))

  return (
    <div className="flex flex-col gap-3">
      {valeur.map((c, i) => (
        <fieldset key={i} className="rounded-xl border border-ligne bg-fond/60 p-3">
          <legend className="px-1 text-sm font-semibold">{valeur.length > 1 ? `Créneau ${i + 1}` : 'Horaire'}</legend>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-xs font-semibold">
              Début
              <input type="time" required value={c.debut} onChange={(e) => modifier(i, { debut: e.target.value })} className={petitChamp} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold">
              Fin
              <input type="time" required value={c.fin} onChange={(e) => modifier(i, { fin: e.target.value })} className={petitChamp} />
            </label>
            <BlocPause ligne={c} onChange={(champs) => modifier(i, champs)} />
          </div>
          {i > 0 && (
            <button
              type="button"
              onClick={() => onChange(valeur.filter((_, j) => j !== i))}
              className="mt-2 text-sm font-semibold text-[#9B1C1C] hover:underline"
            >
              Retirer ce créneau
            </button>
          )}
        </fieldset>
      ))}
      {valeur.length === 1 && (
        <button
          type="button"
          onClick={() => onChange([...valeur, NOUVEAU_SOIR])}
          className="h-11 rounded-lg border border-dashed border-[#9AA0AC] bg-white text-sm font-semibold text-marque-fonce hover:bg-marque-doux"
        >
          + Ajouter un 2e créneau (coupure)
        </button>
      )}
    </div>
  )
}
