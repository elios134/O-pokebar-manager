import { useState, type FormEvent } from 'react'
import { lireTemperature, texteTemperature, type Frigo } from '../../lib/cuisine'
import { supabase } from '../../lib/supabase'
import Fenetre, { boutonPrincipal, champ, etiquette } from '../Fenetre'

/** Admin : liste des frigos et de leurs températures autorisées. */
export default function FenetreFrigos({ frigos, onFermer, onChange }: { frigos: Frigo[]; onFermer: () => void; onChange: () => void }) {
  const [nom, setNom] = useState('')
  const [min, setMin] = useState('0')
  const [max, setMax] = useState('4')
  const [erreur, setErreur] = useState<string | null>(null)
  const tMin = lireTemperature(min)
  const tMax = lireTemperature(max)
  const valide = !!nom.trim() && tMin !== null && tMax !== null && tMin < tMax

  async function ajouter(e: FormEvent) {
    e.preventDefault()
    if (!valide) return
    setErreur(null)
    const { error } = await supabase
      .from('frigos')
      .insert({ nom: nom.trim(), temp_min: tMin, temp_max: tMax, ordre: Math.max(0, ...frigos.map((f) => f.ordre)) + 1 })
    if (error) return setErreur(error.code === '23505' ? 'Un frigo porte déjà ce nom.' : 'Ajout impossible.')
    setNom('')
    onChange()
  }

  async function supprimer(f: Frigo) {
    if (!window.confirm(`Supprimer « ${f.nom} » et tous ses relevés ?`)) return
    const { error } = await supabase.from('frigos').delete().eq('id', f.id)
    if (error) return setErreur('Suppression impossible.')
    onChange()
  }

  return (
    <Fenetre titre="Frigos" onFermer={onFermer}>
      <ul className="mb-4 flex flex-col gap-2">
        {frigos.map((f) => (
          <li key={f.id} className="flex items-center gap-2 rounded-xl border border-ligne px-3 py-2">
            <span className="mr-auto">
              <b>{f.nom}</b>
              <span className="block text-xs text-gris">
                {texteTemperature(f.temp_min)} à {texteTemperature(f.temp_max)}
              </span>
            </span>
            <button
              type="button"
              onClick={() => void supprimer(f)}
              className="h-9 rounded-lg px-2 text-sm font-semibold text-[#9B1C1C] hover:bg-red-50"
            >
              Supprimer
            </button>
          </li>
        ))}
        {frigos.length === 0 && <li className="text-sm text-gris">Aucun frigo pour l'instant.</li>}
      </ul>
      <form onSubmit={ajouter} className="flex flex-col gap-3 border-t border-ligne pt-4">
        <h3 className="font-bold">Ajouter un frigo</h3>
        <label className={etiquette}>
          Nom
          <input maxLength={40} placeholder="Ex. : frigo cuisine, congélateur…" value={nom} onChange={(e) => setNom(e.target.value)} className={champ} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={etiquette}>
            Mini (°C)
            <input inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} className={champ} />
          </label>
          <label className={etiquette}>
            Maxi (°C)
            <input inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value)} className={champ} />
          </label>
        </div>
        {tMin !== null && tMax !== null && tMin >= tMax && <p className="text-sm font-semibold text-red-800">Le mini doit être plus bas que le maxi.</p>}
        {erreur && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            {erreur}
          </p>
        )}
        <button type="submit" disabled={!valide} className={boutonPrincipal}>
          Ajouter le frigo
        </button>
      </form>
    </Fenetre>
  )
}
