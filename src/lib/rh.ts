/** Arrêts maladie, compteur de congés et documents des employés. */

export interface ArretMaladie {
  id: string
  employe_id: string
  debut: string // "2026-10-23"
  fin: string
  message: string | null
  photo: string | null // chemin dans le stockage « arrets »
  recu_le: string | null
  saisi_par: string | null
  cree_le: string
}
export const CHAMPS_ARRET = 'id, employe_id, debut, fin, message, photo, recu_le, saisi_par, cree_le'

export interface Solde {
  employe_id: string
  depuis: string
  acquis: number
  pris: number
  corrections: number
  restant: number
}

export interface Correction {
  id: string
  employe_id: string
  jours: number
  motif: string
  le: string
  cree_le: string
}
export const CHAMPS_CORRECTION = 'id, employe_id, jours, motif, le, cree_le'

export type TypeDocument = 'paie' | 'contrat' | 'autre'
export const TYPES_DOCUMENT: { id: TypeDocument; texte: string; pluriel: string }[] = [
  { id: 'paie', texte: 'Fiche de paie', pluriel: 'Fiches de paie' },
  { id: 'contrat', texte: 'Contrat', pluriel: 'Contrats' },
  { id: 'autre', texte: 'Autre', pluriel: 'Autres' },
]

export interface DocumentEmploye {
  id: string
  employe_id: string
  type: TypeDocument
  titre: string
  mois: string | null
  chemin: string
  taille: number | null
  cree_le: string
  vu_le: string | null
}
export const CHAMPS_DOCUMENT = 'id, employe_id, type, titre, mois, chemin, taille, cree_le, vu_le'

const fmtJours = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 })
/** 12.5 → "12,5 j" ; avec signe : "+2,5 j" / "−1,25 j" */
export function texteJours(n: number, signe = false) {
  const v = fmtJours.format(Math.abs(Number(n)))
  const s = Number(n) < 0 ? '−' : signe && Number(n) > 0 ? '+' : ''
  return `${s}${v} j`
}

/** "1,5" ou "-1.25" → nombre (2 décimales au plus) ; null si la saisie n'est pas un nombre de jours. */
export function lireJours(saisie: string) {
  const s = saisie.trim().replace(/\s/g, '').replace('−', '-')
  return /^[+-]?\d{1,3}([.,]\d{1,2})?$/.test(s) ? Number(s.replace(',', '.')) : null
}

const fmtMois = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' })
/** "2026-09-01" → "septembre 2026" */
export const texteMois = (mois: string) => fmtMois.format(new Date(`${mois}T12:00`))

/** Un arrêt maladie affiché dans le planning de l'employé comme un congé accepté (bloque les jours). */
export const arretEnConge = (a: Pick<ArretMaladie, 'id' | 'employe_id' | 'debut' | 'fin' | 'cree_le'>) => ({
  id: `arret-${a.id}`,
  employe_id: a.employe_id,
  debut: a.debut,
  fin: a.fin,
  motif: null,
  statut: 'accepte' as const,
  reponse: null,
  cree_le: a.cree_le,
  traite_le: null,
})
export const estArret = (c: { id: string }) => c.id.startsWith('arret-')
