import type { ReactNode } from 'react'
import { LIBELLES, texteHoraire, type Echange } from '../lib/echanges'

/** Résumé d'un échange : qui donne quoi à qui. Les boutons d'action sont passés en enfants. */
export default function CarteEchange({ e, children }: { e: Echange; children?: ReactNode }) {
  const statut = LIBELLES[e.statut]
  const cession = !e.debut_destinataire
  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-ligne bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-auto font-bold">
          {cession ? `${e.demandeur} cède un horaire à ${e.destinataire}` : `${e.demandeur} ↔ ${e.destinataire}`}
        </span>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap ${statut.classe}`}>{statut.texte}</span>
      </div>
      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <div className="rounded-lg bg-fond px-3 py-2">
          <div className="text-xs font-semibold text-gris">Horaire de {e.demandeur}</div>
          <div className="font-semibold first-letter:uppercase">{texteHoraire(e.debut_demandeur, e.fin_demandeur)}</div>
          <div className="text-xs text-gris">→ passe à {e.destinataire}</div>
        </div>
        {!cession && (
          <div className="rounded-lg bg-fond px-3 py-2">
            <div className="text-xs font-semibold text-gris">Horaire de {e.destinataire}</div>
            <div className="font-semibold first-letter:uppercase">{texteHoraire(e.debut_destinataire!, e.fin_destinataire!)}</div>
            <div className="text-xs text-gris">→ passe à {e.demandeur}</div>
          </div>
        )}
      </div>
      {e.message && <p className="text-sm">« {e.message} »</p>}
      {children}
    </li>
  )
}
