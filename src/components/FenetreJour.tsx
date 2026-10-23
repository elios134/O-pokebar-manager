import { dateDuJour, dureeHeures, formatHeures, formatJour, heureLocale, textePause } from '../lib/dates'
import { estArret } from '../lib/rh'
import type { Conge, Horaire } from '../lib/types'
import Fenetre, { boutonPrincipal } from './Fenetre'

/** Détail d'une journée du planning de l'employé : services, pauses, notes, congé. */
export default function FenetreJour({
  jour,
  horaires,
  conges,
  onFermer,
}: {
  jour: string
  horaires: Horaire[]
  conges: Conge[]
  onFermer: () => void
}) {
  const total = horaires.reduce((t, h) => t + dureeHeures(new Date(h.debut), new Date(h.fin), h.pause_minutes), 0)
  const titre = formatJour.format(dateDuJour(jour)).replace(/^./, (c) => c.toUpperCase())

  return (
    <Fenetre titre={titre} onFermer={onFermer}>
      <div className="flex flex-col gap-3">
        {conges.map((c) => (
          <div
            key={c.id}
            className={`rounded-xl px-4 py-3 text-sm ${
              c.statut === 'accepte' ? 'bg-[#DCEBFF] text-[#1E4E8C]' : 'border border-dashed border-[#3B76C4] text-[#1E4E8C]'
            }`}
          >
            <div className="font-bold">{estArret(c) ? 'Arrêt maladie' : c.statut === 'accepte' ? 'Congé' : 'Congé demandé (en attente de réponse)'}</div>
            {c.motif && <div>{c.motif}</div>}
          </div>
        ))}

        {horaires.length === 0 && !conges.length && <p className="text-gris">Pas de service ce jour-là.</p>}

        {horaires.map((h) => {
          const debut = new Date(h.debut)
          const fin = new Date(h.fin)
          const lendemain = fin.getDate() !== debut.getDate() && fin.getHours() + fin.getMinutes() > 0
          return (
            <div key={h.id} className="rounded-xl border border-ligne p-4">
              <div className="text-xl font-extrabold tabular-nums">
                {heureLocale(debut)} – {heureLocale(fin)}
                {lendemain && <span className="ml-2 text-sm font-semibold text-gris">(lendemain)</span>}
              </div>
              {h.pause_debut && <div className="mt-1 text-sm text-gris first-letter:uppercase">{textePause(h)}</div>}
              <div className="mt-1 text-sm">
                Temps de travail : <b>{formatHeures(dureeHeures(debut, fin, h.pause_minutes))}</b>
              </div>
              {h.note && <div className="mt-2 rounded-lg bg-fond px-3 py-2 text-sm">{h.note}</div>}
            </div>
          )
        })}

        {horaires.length > 1 && (
          <p className="text-sm">
            Total de la journée : <b>{formatHeures(total)}</b>
          </p>
        )}

        <button type="button" onClick={onFermer} className={`${boutonPrincipal} mt-2 w-full`}>
          Fermer
        </button>
      </div>
    </Fenetre>
  )
}
