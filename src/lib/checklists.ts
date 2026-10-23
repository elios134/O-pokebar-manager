/** Checklists d'ouverture / fermeture et tâches cochées chaque jour. */

export interface Checklist {
  id: string
  nom: string
  cuisine_seulement: boolean
  jours: number[] // 1 = lundi … 7 = dimanche
  ordre: number
}
export const CHAMPS_CHECKLIST = 'id, nom, cuisine_seulement, jours, ordre'

export interface Tache {
  id: string
  checklist_id: string
  texte: string
  ordre: number
  active: boolean
  cree_le: string
}
export const CHAMPS_TACHE = 'id, checklist_id, texte, ordre, active, cree_le'

export interface Coche {
  id: string
  tache_id: string
  jour: string
  coche_par: string | null
  coche_le: string
}
export const CHAMPS_COCHE = 'id, tache_id, jour, coche_par, coche_le'

export const NOMS_JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

/** Jour de la semaine d'une date "2026-10-23" : 1 = lundi … 7 = dimanche. */
export const jourSemaine = (jour: string) => ((new Date(`${jour}T12:00`).getDay() + 6) % 7) + 1

/** La liste est-elle à faire ce jour-là ? */
export const aFaireLe = (c: Pick<Checklist, 'jours'>, jour: string) => c.jours.includes(jourSemaine(jour))

/** Noms de l'équipe (prénom + initiale du nom), pour afficher qui a coché. */
export type Noms = Record<string, string>
export const nomCourt = (p: { prenom: string; nom: string }) => `${p.prenom} ${p.nom.slice(0, 1)}.`
