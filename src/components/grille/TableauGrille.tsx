import { Fragment, useRef, useState, type KeyboardEvent } from 'react'
import type { Couleur } from '../../lib/couleurs'
import { COULEURS_MODELES, heureCourte, texteCreneaux, texteDetaille, type Creneau, type ModeleHoraire } from '../../lib/creneaux'
import { dateDuJour, formatHeures, jourLocal } from '../../lib/dates'

export interface CaseGrille {
  cle: string
  jour: string
  creneaux: Creneau[]
  modele?: ModeleHoraire
  conge: boolean
  modifiee: boolean
  choisie: boolean
}

export interface LigneGrille {
  id: string
  nom: string
  initiales: string
  couleur: Couleur
  total: number
  cases: CaseGrille[]
}

const fmtJourCourt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' })
const fmtJourLong = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
const SEUIL_HEURES = 35
const heures = (h: number) => (h > 0 ? formatHeures(h) : '0 h')

function contenu(c: CaseGrille) {
  if (c.conge) return { haut: 'Congé', bas: '' }
  if (c.modele) return { haut: c.modele.code, bas: texteCreneaux(c.creneaux) }
  if (!c.creneaux.length) return { haut: '+', bas: '' }
  const [a, b] = c.creneaux
  return { haut: `${heureCourte(a.debut)}–${heureCourte(a.fin)}`, bas: b ? `${heureCourte(b.debut)}–${heureCourte(b.fin)}` : '' }
}

function style(c: CaseGrille) {
  if (c.choisie) return { background: '#FFF4F2', color: '#9A3129', borderColor: '#C2453B', boxShadow: '0 0 0 2px #C2453B' }
  if (c.conge) {
    return { background: 'repeating-linear-gradient(135deg, #EEF0F3 0 6px, #F6F7F9 6px 12px)', color: '#4A5060', borderColor: '#E3E5EA' }
  }
  if (c.modele) {
    const m = COULEURS_MODELES[c.modele.couleur] ?? COULEURS_MODELES[0]
    return { background: m.fond, color: m.texte, borderColor: m.lisere }
  }
  if (c.creneaux.length) return { background: '#F4F5F7', color: '#16181D', borderColor: '#C9CCD4' }
  return { background: '#FFFFFF', color: '#9AA0AC', borderColor: '#EEF0F3' }
}

/** Le tableau : une ligne par employé, une colonne par jour, comme un tableur. */
export default function TableauGrille({
  jours,
  groupes,
  pied,
  totalSemaine,
  onClic,
  onAppui,
  onGlisser,
  onTouche,
}: {
  jours: string[]
  groupes: { nom: string; lignes: LigneGrille[] }[]
  pied: { presents: number; heures: number }[]
  totalSemaine: number
  onClic: (c: CaseGrille) => void
  onAppui: (c: CaseGrille) => void
  onGlisser: (c: CaseGrille) => void
  onTouche: (c: CaseGrille, touche: string) => boolean
}) {
  const tableau = useRef<HTMLTableElement>(null)
  const [aujourdhui] = useState(() => jourLocal(new Date()))
  let index = 0

  function clavier(e: KeyboardEvent<HTMLButtonElement>, c: CaseGrille, ligne: number, colonne: number) {
    const depl: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    }
    const d = depl[e.key]
    if (d) {
      e.preventDefault()
      tableau.current?.querySelector<HTMLButtonElement>(`[data-l="${ligne + d[0]}"][data-c="${colonne + d[1]}"]`)?.focus()
      return
    }
    if (!e.ctrlKey && !e.metaKey && !e.altKey && onTouche(c, e.key)) e.preventDefault()
  }

  return (
    <div className="max-h-[68dvh] overflow-auto rounded-2xl border border-ligne bg-white">
      <table ref={tableau} className="w-full min-w-[640px] table-fixed border-separate border-spacing-0 text-sm">
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
                        <span className="min-w-0">
                          <span className="block truncate font-bold">{l.nom}</span>
                          <span className={`block text-xs font-bold sm:hidden ${l.total > SEUIL_HEURES ? 'text-marque-fonce' : 'text-gris'}`}>
                            {heures(l.total)}
                          </span>
                        </span>
                      </span>
                    </th>
                    {l.cases.map((c, colonne) => {
                      const t = contenu(c)
                      return (
                        <td key={c.cle} className="border-b border-l border-[#EEF0F3] p-1">
                          <button
                            type="button"
                            data-l={ligne}
                            data-c={colonne}
                            disabled={c.conge}
                            aria-pressed={c.choisie}
                            aria-label={`${l.nom}, ${fmtJourLong.format(dateDuJour(c.jour))} : ${
                              c.conge ? 'en congé' : c.creneaux.length ? `${c.modele ? `${c.modele.nom}, ` : ''}${texteDetaille(c.creneaux)}` : 'vide'
                            }`}
                            title={c.creneaux.length ? texteDetaille(c.creneaux) : undefined}
                            onClick={() => onClic(c)}
                            onPointerDown={(e) => e.pointerType === 'mouse' && e.button === 0 && onAppui(c)}
                            onPointerEnter={(e) => e.pointerType === 'mouse' && e.buttons === 1 && onGlisser(c)}
                            onKeyDown={(e) => clavier(e, c, ligne, colonne)}
                            className="relative flex h-[54px] w-full flex-col items-center justify-center gap-px rounded-[9px] border px-0.5 leading-tight select-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-encre disabled:cursor-not-allowed"
                            style={style(c)}
                          >
                            <span className={`font-extrabold ${c.modele || c.conge || !c.creneaux.length ? 'text-[15px]' : 'text-[12px]'}`}>
                              {t.haut}
                            </span>
                            {t.bas && <span className="max-w-full truncate text-[10px] font-semibold sm:text-[11px]">{t.bas}</span>}
                            {c.modifiee && (
                              <span className="absolute top-1 right-1 size-2 rounded-full bg-marque" title="Pas encore enregistré" />
                            )}
                          </button>
                        </td>
                      )
                    })}
                    <td className="border-b border-l border-[#EEF0F3] px-1 text-center">
                      <span
                        title={l.total > SEUIL_HEURES ? `Plus de ${SEUIL_HEURES} h cette semaine` : undefined}
                        className={`inline-block rounded-full px-2 py-1 text-xs font-extrabold whitespace-nowrap ${
                          l.total > SEUIL_HEURES ? 'bg-marque-doux text-marque-fonce' : 'bg-fond text-encre'
                        }`}
                      >
                        {heures(l.total)}
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
                <span className="block text-gris">{heures(p.heures)}</span>
              </td>
            ))}
            <td className="border-l border-[#EEF0F3] bg-[#F8F9FB] px-1 text-center text-xs font-extrabold">
              {heures(totalSemaine)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
