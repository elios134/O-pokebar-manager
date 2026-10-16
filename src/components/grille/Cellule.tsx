import type { KeyboardEvent } from 'react'
import { COULEURS_MODELES, heureCourte, texteCreneaux, texteDetaille, type Creneau, type ModeleHoraire } from '../../lib/creneaux'
import { dateDuJour } from '../../lib/dates'

/** Une case de la grille : un employé, un jour. */
export interface CaseGrille {
  cle: string
  jour: string
  creneaux: Creneau[]
  modele?: ModeleHoraire
  conge: boolean
  modifiee: boolean
  congeDemande: boolean
  choisie: boolean
}

/** Ce que la page fait quand on touche une case. */
export interface ActionsCase {
  onClic: (c: CaseGrille) => void
  onAppui: (c: CaseGrille) => void
  onGlisser: (c: CaseGrille) => void
  onTouche: (c: CaseGrille, touche: string) => boolean
}

const fmtJourLong = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

function texte(c: CaseGrille) {
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

const DEPLACEMENTS: Record<string, [number, number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
}

/** Bouton d'une case, avec les touches du clavier (flèches, lettre d'un horaire type, Suppr). */
export default function Cellule({
  c,
  nom,
  ligne,
  colonne,
  actions,
  numero,
  inactive = false,
  hauteur = 'h-[54px]',
}: {
  c: CaseGrille
  nom: string
  ligne: number
  colonne: number
  actions: ActionsCase
  numero?: number
  inactive?: boolean
  hauteur?: string
}) {
  const t = texte(c)

  function clavier(e: KeyboardEvent<HTMLButtonElement>) {
    const d = DEPLACEMENTS[e.key]
    if (d) {
      e.preventDefault()
      e.currentTarget
        .closest('table')
        ?.querySelector<HTMLButtonElement>(`[data-l="${ligne + d[0]}"][data-c="${colonne + d[1]}"]`)
        ?.focus()
      return
    }
    if (!e.ctrlKey && !e.metaKey && !e.altKey && actions.onTouche(c, e.key)) e.preventDefault()
  }

  const description = c.conge
    ? 'en congé'
    : c.creneaux.length
      ? `${c.modele ? `${c.modele.nom}, ` : ''}${texteDetaille(c.creneaux)}`
      : 'vide'

  return (
    <button
      type="button"
      data-l={ligne}
      data-c={colonne}
      disabled={c.conge || inactive}
      aria-pressed={c.choisie}
      aria-label={`${nom}, ${fmtJourLong.format(dateDuJour(c.jour))} : ${description}${
        c.congeDemande ? ' (demande de congé en attente)' : ''
      }`}
      title={c.creneaux.length ? texteDetaille(c.creneaux) : undefined}
      onClick={() => actions.onClic(c)}
      onPointerDown={(e) => e.pointerType === 'mouse' && e.button === 0 && actions.onAppui(c)}
      onPointerEnter={(e) => e.pointerType === 'mouse' && e.buttons === 1 && actions.onGlisser(c)}
      onKeyDown={clavier}
      className={`relative flex ${hauteur} w-full flex-col items-center justify-center gap-px rounded-[9px] border px-0.5 leading-tight select-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-encre disabled:cursor-not-allowed ${
        inactive ? 'opacity-35' : ''
      }`}
      style={style(c)}
    >
      {numero !== undefined && <span className="absolute top-0.5 left-1.5 text-[10px] font-bold text-gris">{numero}</span>}
      <span className={`font-extrabold ${c.modele || c.conge || !c.creneaux.length ? 'text-[15px]' : 'text-[12px]'}`}>{t.haut}</span>
      {t.bas && <span className="max-w-full truncate text-[10px] font-semibold sm:text-[11px]">{t.bas}</span>}
      {c.congeDemande && (
        <span className="absolute right-1 bottom-1 size-2 rounded-full bg-[#D9822B]" title="Demande de congé en attente" />
      )}
      {c.creneaux.some((x) => x.note) && (
        <svg aria-hidden="true" className="absolute bottom-1 left-1" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 6h16M4 12h16M4 18h10" />
        </svg>
      )}
      {c.modifiee && <span className="absolute top-1 right-1 size-2 rounded-full bg-marque" title="Pas encore enregistré" />}
    </button>
  )
}
