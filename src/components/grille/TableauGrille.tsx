import { Fragment, useState } from 'react'
import type { Couleur } from '../../lib/couleurs'
import { texteHeures } from '../../lib/creneaux'
import { dateDuJour, jourLocal } from '../../lib/dates'
import Cellule, { type ActionsCase, type CaseGrille } from './Cellule'

export interface LigneGrille {
  id: string
  nom: string
  initiales: string
  couleur: Couleur
  total: number
  contrat: number | null
  cases: CaseGrille[]
}

const fmtJourCourt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' })
const SEUIL_PAR_DEFAUT = 35
const depasse = (l: LigneGrille) => l.total > (l.contrat ?? SEUIL_PAR_DEFAUT)

/** Le tableau : une ligne par employé, une colonne par jour, comme un tableur. */
export default function TableauGrille({
  jours,
  groupes,
  pied,
  totalSemaine,
  actions,
  onEmploye,
}: {
  jours: string[]
  groupes: { nom: string; lignes: LigneGrille[] }[]
  pied: { presents: number; heures: number }[]
  totalSemaine: number
  actions: ActionsCase
  onEmploye: (id: string) => void
}) {
  const [aujourdhui] = useState(() => jourLocal(new Date()))
  let index = 0

  return (
    <div className="max-h-[68dvh] overflow-auto rounded-2xl border border-ligne bg-white">
      <table className="w-full min-w-[640px] table-fixed border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className="sticky top-0 left-0 z-20 w-[104px] border-b border-ligne bg-[#F8F9FB] px-3 py-2 text-left text-xs font-bold text-gris sm:w-[200px] sm:px-4">
              Employé
            </th>
            {jours.map((j) => {
              const d = dateDuJour(j)
              const weekend = d.getDay() === 0 || d.getDay() === 6
              return (
                <th
                  key={j}
                  scope="col"
                  className={`sticky top-0 z-10 min-w-[68px] border-b border-l border-ligne px-1 py-1.5 text-center text-xs font-bold text-gris uppercase ${
                    weekend ? 'bg-[#F1F2F5]' : 'bg-[#F8F9FB]'
                  }`}
                >
                  {fmtJourCourt.format(d).replace('.', '')}
                  <span
                    className={`mx-auto mt-0.5 flex size-7 items-center justify-center rounded-full text-[15px] font-extrabold ${
                      j === aujourdhui ? 'bg-marque text-white' : 'text-encre'
                    }`}
                  >
                    {d.getDate()}
                  </span>
                </th>
              )
            })}
            <th scope="col" className="sticky top-0 z-10 w-20 border-b border-l border-ligne bg-[#F8F9FB] px-2 text-center text-xs font-bold text-gris">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {groupes.map((g) => (
            <Fragment key={g.nom}>
              <tr>
                <th
                  colSpan={jours.length + 2}
                  scope="colgroup"
                  className="border-b border-ligne bg-[#FFF8F6] px-3 py-1.5 text-left text-xs font-extrabold tracking-wide text-marque-fonce uppercase sm:px-4"
                >
                  <span className="sticky left-3">{g.nom}</span>
                </th>
              </tr>
              {g.lignes.map((l) => {
                const ligne = index++
                return (
                  <tr key={l.id}>
                    <th scope="row" className="sticky left-0 z-[5] border-b border-ligne bg-white px-3 py-1 text-left sm:px-4">
                      <span className="flex items-center gap-2.5">
                        <span
                          className="hidden size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold sm:flex"
                          style={{ background: l.couleur.fond, color: l.couleur.texte }}
                        >
                          {l.initiales}
                        </span>
                        <button
                          type="button"
                          onClick={() => onEmploye(l.id)}
                          title={`Voir le planning de ${l.nom} au mois`}
                          className="min-w-0 rounded-md text-left hover:text-marque-fonce hover:underline"
                        >
                          <span className="block truncate font-bold">{l.nom}</span>
                          <span className={`block text-xs font-bold sm:hidden ${depasse(l) ? 'text-marque-fonce' : 'text-gris'}`}>
                            {texteHeures(l.total)}
                          </span>
                        </button>
                      </span>
                    </th>
                    {l.cases.map((c, colonne) => (
                      <td key={c.cle} className="border-b border-l border-[#EEF0F3] p-1">
                        <Cellule c={c} nom={l.nom} ligne={ligne} colonne={colonne} actions={actions} />
                      </td>
                    ))}
                    <td className="border-b border-l border-[#EEF0F3] px-1 text-center">
                      <span
                        title={depasse(l) ? `Plus de ${l.contrat ?? SEUIL_PAR_DEFAUT} h cette semaine` : undefined}
                        className={`inline-block rounded-full px-2 py-1 text-xs font-extrabold whitespace-nowrap ${
                          depasse(l) ? 'bg-marque-doux text-marque-fonce' : 'bg-fond text-encre'
                        }`}
                      >
                        {texteHeures(l.total)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </Fragment>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" className="sticky left-0 z-[5] bg-[#F8F9FB] px-3 py-2 text-left text-xs font-bold text-gris sm:px-4">
              Présents · heures
            </th>
            {pied.map((p, i) => (
              <td key={i} className="border-l border-[#EEF0F3] bg-[#F8F9FB] px-1 py-1.5 text-center text-xs">
                <span className="block font-extrabold text-encre">{p.presents} pers.</span>
                <span className="block text-gris">{texteHeures(p.heures)}</span>
              </td>
            ))}
            <td className="border-l border-[#EEF0F3] bg-[#F8F9FB] px-1 text-center text-xs font-extrabold">
              {texteHeures(totalSemaine)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
