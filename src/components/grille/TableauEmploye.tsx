import { Fragment } from 'react'
import { texteHeures } from '../../lib/creneaux'
import Cellule, { type ActionsCase, type CaseGrille } from './Cellule'

export interface SemaineEmploye {
  lundi: string
  nom: string // "Sem. 45"
  dates: string // "2 nov. – 8 nov."
  cases: { c: CaseGrille; numero: number; horsPeriode: boolean }[]
  total: number
}

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const JOURS_LONGS = ['lundis', 'mardis', 'mercredis', 'jeudis', 'vendredis', 'samedis', 'dimanches']

/** Couleur du total d'une semaine comparé au contrat : vert si proche, orange s'il manque, rouge si trop. */
function couleurTotal(total: number, contrat: number | null) {
  if (!total || !contrat) return 'bg-fond text-encre'
  const ecart = total - contrat
  if (Math.abs(ecart) <= 2) return 'bg-[#DDF5E6] text-[#145C32]'
  return ecart > 0 ? 'bg-marque-doux text-marque-fonce' : 'bg-[#FCE9C8] text-[#6B4100]'
}

/** Planning d'un employé : une ligne par semaine, une colonne par jour (comme un calendrier dans un tableur). */
export default function TableauEmploye({
  semaines,
  nom,
  contrat,
  mois,
  totalPeriode,
  joursTravailles,
  actions,
  onSemaine,
  onColonne,
}: {
  semaines: SemaineEmploye[]
  nom: string
  contrat: number | null
  mois: boolean
  totalPeriode: number
  joursTravailles: number
  actions: ActionsCase
  onSemaine: (s: SemaineEmploye) => void
  onColonne: (jour: number) => void
}) {
  const totalBadge = (s: SemaineEmploye) => (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-extrabold whitespace-nowrap ${couleurTotal(s.total, contrat)}`}>
      {texteHeures(s.total)}
      {contrat ? <span className="font-semibold opacity-80"> / {texteHeures(contrat)}</span> : null}
    </span>
  )

  return (
    <div className="overflow-hidden rounded-2xl border border-ligne bg-white">
      <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className="hidden w-[120px] border-b border-ligne bg-[#F8F9FB] px-3 py-2 text-left text-xs font-bold text-gris sm:table-cell">
              Semaine
            </th>
            {JOURS.map((j, i) => (
              <th key={j} scope="col" className={`border-b border-ligne p-0 sm:border-l ${i >= 5 ? 'bg-[#F1F2F5]' : 'bg-[#F8F9FB]'}`}>
                <button
                  type="button"
                  onClick={() => onColonne(i)}
                  title={mois ? `Remplir tous les ${JOURS_LONGS[i]} du mois` : 'Remplir ce jour'}
                  className="h-10 w-full text-xs font-extrabold tracking-wide text-gris uppercase hover:text-marque-fonce"
                >
                  {j}
                </button>
              </th>
            ))}
            <th className="hidden w-[110px] border-b border-l border-ligne bg-[#F8F9FB] px-2 text-center text-xs font-bold text-gris sm:table-cell">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {semaines.map((s, ligne) => (
            <Fragment key={s.lundi}>
              {/* Téléphone : titre de la semaine au-dessus de ses jours */}
              <tr className="sm:hidden">
                <th colSpan={7} scope="rowgroup" className="border-t border-ligne px-2 pt-2 pb-1 text-left">
                  <button type="button" onClick={() => onSemaine(s)} className="flex w-full items-center gap-2 text-left">
                    <span className="text-[13px] font-extrabold">{s.nom}</span>
                    <span className="mr-auto text-xs font-medium text-gris">{s.dates}</span>
                    {totalBadge(s)}
                  </button>
                </th>
              </tr>
              <tr>
                <th scope="row" className="hidden border-b border-ligne p-0 text-left sm:table-cell">
                  <button
                    type="button"
                    onClick={() => onSemaine(s)}
                    title="Remplir toute la semaine"
                    className="flex h-full w-full flex-col justify-center px-3 py-2 text-left hover:text-marque-fonce"
                  >
                    <span className="font-extrabold">{s.nom}</span>
                    <span className="text-xs font-medium text-gris">{s.dates}</span>
                  </button>
                </th>
                {s.cases.map(({ c, numero, horsPeriode }, colonne) => (
                  <td key={c.cle} className="border-[#EEF0F3] p-0.5 sm:border-b sm:border-l sm:p-1">
                    <Cellule
                      c={c}
                      nom={nom}
                      ligne={ligne}
                      colonne={colonne}
                      actions={actions}
                      numero={numero}
                      inactive={horsPeriode}
                      hauteur={mois ? 'h-[54px] sm:h-[60px]' : 'h-24'}
                    />
                  </td>
                ))}
                <td className="hidden border-b border-l border-[#EEF0F3] px-1 text-center sm:table-cell">{totalBadge(s)}</td>
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-ligne bg-[#F8F9FB] px-4 py-3 text-sm">
        <span className="font-extrabold">
          Total {mois ? 'du mois' : 'de la semaine'} : {texteHeures(totalPeriode)}
        </span>
        <span className="text-gris">
          {joursTravailles} jour{joursTravailles > 1 ? 's' : ''} travaillé{joursTravailles > 1 ? 's' : ''}
        </span>
        {!contrat && <span className="text-gris">Contrat non renseigné (page Employés → Modifier)</span>}
      </div>
    </div>
  )
}
