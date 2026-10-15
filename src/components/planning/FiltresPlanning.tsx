import type { Couleur } from '../../lib/couleurs'
import type { Equipe, Profil } from '../../lib/types'

const liste = 'h-11 w-full rounded-xl border border-[#C9CCD4] bg-white px-3 text-sm font-semibold text-encre'

/** Colonne de gauche du planning admin : filtres Équipe puis Employé, et légende des couleurs. */
export default function FiltresPlanning({
  profils,
  equipes,
  couleurs,
  equipe,
  employe,
  chargement,
  onEquipe,
  onEmploye,
}: {
  profils: Profil[]
  equipes: Equipe[]
  couleurs: Map<string, Couleur>
  equipe: string
  employe: string
  chargement: boolean
  onEquipe: (id: string) => void
  onEmploye: (id: string) => void
}) {
  // Employés de l'équipe choisie (sous-filtre).
  const membres = profils.filter((p) => (!equipe ? true : equipe === 'aucune' ? !p.equipe_id : p.equipe_id === equipe))

  return (
    <aside className="flex flex-col gap-3 lg:w-60 lg:shrink-0">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-1 lg:rounded-2xl lg:border lg:border-ligne lg:bg-white lg:p-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="filtre-equipe" className="text-[13px] font-bold text-gris">
            Équipe
          </label>
          <select id="filtre-equipe" value={equipe} onChange={(e) => onEquipe(e.target.value)} className={liste}>
            <option value="">Toutes les équipes</option>
            {equipes.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nom}
              </option>
            ))}
            <option value="aucune">Sans équipe</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="filtre-employe" className="text-[13px] font-bold text-gris">
            Employé
          </label>
          <select id="filtre-employe" value={employe} onChange={(e) => onEmploye(e.target.value)} className={liste}>
            <option value="">Tous les employés</option>
            {membres.map((p) => (
              <option key={p.id} value={p.id}>
                {p.prenom} {p.nom}
                {p.actif ? '' : ' (désactivé)'}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Légende des couleurs pour les personnes affichées */}
      <ul className="-mx-4 flex gap-x-4 gap-y-1 overflow-x-auto px-4 text-sm lg:mx-0 lg:flex-col lg:px-1">
        {membres
          .filter((p) => !employe || p.id === employe)
          .map((p) => (
            <li key={p.id} className="flex shrink-0 items-center gap-2 whitespace-nowrap">
              <span className="size-3 rounded-full" style={{ background: couleurs.get(p.id)?.trait }} />
              {p.prenom} {p.nom}
            </li>
          ))}
        {chargement && <li className="text-gris">Chargement…</li>}
        {profils.length > 0 && membres.length === 0 && <li className="text-gris">Aucun employé dans cette équipe.</li>}
      </ul>
    </aside>
  )
}
