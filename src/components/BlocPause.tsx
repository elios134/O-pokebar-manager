import type { Creneau } from '../lib/creneaux'

export const petitChamp =
  'h-11 w-full min-w-0 rounded-lg border border-[#C9CCD4] bg-white px-2 text-[15px] outline-none focus:border-marque'

/** Pause facultative : un bouton pour l'ajouter, deux heures et un bouton pour la retirer. */
export default function BlocPause({ ligne, onChange }: { ligne: Creneau; onChange: (champs: Partial<Creneau>) => void }) {
  if (!ligne.pauseDebut && !ligne.pauseFin) {
    return (
      <button
        type="button"
        onClick={() => onChange(pauseParDefaut(ligne))}
        className="col-span-2 h-11 rounded-lg border border-dashed border-[#9AA0AC] bg-white text-sm font-semibold text-marque-fonce hover:bg-marque-doux"
      >
        + Ajouter une pause
      </button>
    )
  }
  return (
    <>
      <label className="flex flex-col gap-1 text-xs font-semibold">
        Début de pause
        <input type="time" required value={ligne.pauseDebut} onChange={(e) => onChange({ pauseDebut: e.target.value })} className={petitChamp} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold">
        Fin de pause
        <input type="time" required value={ligne.pauseFin} onChange={(e) => onChange({ pauseFin: e.target.value })} className={petitChamp} />
      </label>
      <button
        type="button"
        onClick={() => onChange({ pauseDebut: '', pauseFin: '' })}
        className="col-span-2 justify-self-start text-sm font-semibold text-[#9B1C1C] hover:underline"
      >
        Retirer la pause
      </button>
    </>
  )
}

/** Pause de 30 min proposée au milieu de l'horaire. */
function pauseParDefaut(l: Creneau): Partial<Creneau> {
  const [hd, md] = l.debut.split(':').map(Number)
  const [hf, mf] = l.fin.split(':').map(Number)
  let debut = hd * 60 + md
  let fin = hf * 60 + mf
  if (fin <= debut) fin += 24 * 60
  const milieu = Math.floor((debut + fin) / 2 / 30) * 30
  debut = milieu % (24 * 60)
  const h = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  return { pauseDebut: h(debut), pauseFin: h(debut + 30) }
}
