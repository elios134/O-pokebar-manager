import { construirePlage, dateDuJour, dureeHeures, formatHeures, heureDansService, heureLocale, jourLocal } from './dates'
import type { Horaire } from './types'

/** Un créneau saisi en heures ("HH:MM") ; pause facultative ("" = pas de pause).
 *  Note absente (horaire type) = on garde la note déjà en place dans la case. */
export interface Creneau {
  debut: string
  fin: string
  pauseDebut: string
  pauseFin: string
  note?: string
}

/** Horaire type de la grille rapide (ex. « O · Ouverture 10:00 – 15:00 »). */
export interface ModeleHoraire {
  id: string
  nom: string
  code: string
  couleur: number
  creneaux: Creneau[]
  ordre: number
}

export const CHAMPS_MODELE = 'id, nom, code, couleur, creneaux, ordre'

/** Couleurs des horaires types : fond clair, texte foncé et liseré. */
export const COULEURS_MODELES = [
  { fond: '#FCE9C8', texte: '#6B4100', lisere: '#F2D49A' },
  { fond: '#DCEBFB', texte: '#1D4E89', lisere: '#B9D5F5' },
  { fond: '#E6E0F8', texte: '#47367F', lisere: '#CDC2F0' },
  { fond: '#DDF5E6', texte: '#145C32', lisere: '#B5E6C6' },
  { fond: '#FDECEA', texte: '#9A3129', lisere: '#F6C9C4' },
  { fond: '#D9F1FB', texte: '#0B5068', lisere: '#A9DCF0' },
  { fond: '#FDE2EC', texte: '#8C1D4A', lisere: '#F5BCD1' },
  { fond: '#E4F4D0', texte: '#3B5A12', lisere: '#C6E3A1' },
]

/** Lit les créneaux d'un horaire type venant de la base (champs absents = pas de pause). */
export function normaliserCreneaux(brut: unknown): Creneau[] {
  if (!Array.isArray(brut)) return []
  return brut.map((c: Partial<Creneau>) => ({
    debut: c.debut ?? '',
    fin: c.fin ?? '',
    pauseDebut: c.pauseDebut ?? '',
    pauseFin: c.pauseFin ?? '',
  }))
}

/** Calcule un créneau pour un jour ; renvoie une erreur lisible si les heures ne vont pas. */
function calculer(jour: string, l: Creneau) {
  if (!l.debut || !l.fin) return { erreur: 'Heures manquantes.' }
  const plage = construirePlage(jour, l.debut, l.fin)
  let pause: { debut: Date; fin: Date } | null = null
  if (l.pauseDebut || l.pauseFin) {
    if (!l.pauseDebut || !l.pauseFin) return { erreur: 'Indiquez le début et la fin de la pause, ou retirez-la.' }
    pause = {
      debut: heureDansService(jour, l.pauseDebut, plage.debut),
      fin: heureDansService(jour, l.pauseFin, plage.debut),
    }
    if (pause.fin <= pause.debut || pause.debut < plage.debut || pause.fin > plage.fin) {
      return { erreur: "La pause doit être dans l'horaire." }
    }
  }
  const minutesPause = pause ? (pause.fin.getTime() - pause.debut.getTime()) / 60_000 : 0
  return { plage, pause, travail: dureeHeures(plage.debut, plage.fin, minutesPause) }
}

/** Vérifie une liste de créneaux (une coupure ne doit pas se chevaucher). */
export function erreurCreneaux(jour: string, creneaux: Creneau[]): string | null {
  const calculs = creneaux.map((c) => calculer(jour, c))
  const erreur = calculs.find((c) => c.erreur)
  if (erreur) return erreur.erreur!
  const plages = calculs.map((c) => c.plage!).sort((a, b) => a.debut.getTime() - b.debut.getTime())
  for (let i = 1; i < plages.length; i++) {
    if (plages[i].debut < plages[i - 1].fin) return 'Les deux créneaux se chevauchent.'
  }
  return null
}

/** Heures travaillées (pauses déduites) ; 0 si les heures ne vont pas. */
export const dureeCreneaux = (jour: string, creneaux: Creneau[]) =>
  creneaux.reduce((t, c) => t + (calculer(jour, c).travail ?? 0), 0)

/** Horaire de la base → créneau en heures locales. */
export function depuisHoraire(h: Horaire): Creneau {
  return {
    debut: heureLocale(new Date(h.debut)),
    fin: heureLocale(new Date(h.fin)),
    pauseDebut: h.pause_debut ? heureLocale(new Date(h.pause_debut)) : '',
    pauseFin: h.pause_fin ? heureLocale(new Date(h.pause_fin)) : '',
    note: h.note ?? '',
  }
}

/** Créneau → horaire à enregistrer (dates complètes). */
export function versHoraire(jour: string, c: Creneau) {
  const r = calculer(jour, c)
  if (r.erreur) throw new Error(r.erreur)
  return {
    debut: r.plage!.debut.toISOString(),
    fin: r.plage!.fin.toISOString(),
    pause_debut: r.pause ? r.pause.debut.toISOString() : null,
    pause_fin: r.pause ? r.pause.fin.toISOString() : null,
    note: c.note ?? '',
  }
}

/** Mêmes heures (sans regarder les notes) : sert à reconnaître un horaire type. */
export const memesHeures = (a: Creneau[], b: Creneau[]) =>
  a.length === b.length &&
  a.every((x, i) => x.debut === b[i].debut && x.fin === b[i].fin && x.pauseDebut === b[i].pauseDebut && x.pauseFin === b[i].pauseFin)

/** Mêmes heures et mêmes notes. */
export const memesCreneaux = (a: Creneau[], b: Creneau[]) =>
  memesHeures(a, b) && a.every((x, i) => (x.note ?? '') === (b[i].note ?? ''))

/** Applique de nouveaux créneaux à une case : une note absente reprend celle déjà en place. */
export const garderNotes = (nouveaux: Creneau[], actuels: Creneau[]) =>
  nouveaux.map((c, i) => ({ ...c, note: c.note ?? actuels[i]?.note ?? '' }))

/** "10h", "11h30" */
export function heureCourte(h: string) {
  const [hh, mm] = h.split(':')
  return `${Number(hh)}h${mm === '00' ? '' : mm}`
}

/** "10h – 15h" ou "11h–15h / 18h–22h" */
export function texteCreneaux(creneaux: Creneau[]) {
  if (creneaux.length === 1) return `${heureCourte(creneaux[0].debut)} – ${heureCourte(creneaux[0].fin)}`
  return creneaux.map((c) => `${heureCourte(c.debut)}–${heureCourte(c.fin)}`).join(' / ')
}

/** "10:00 – 18:00 · pause 14:00 – 14:30" pour une infobulle ou une description. */
export function texteDetaille(creneaux: Creneau[]) {
  return creneaux
    .map((c) => `${c.debut} – ${c.fin}${c.pauseDebut ? ` · pause ${c.pauseDebut} – ${c.pauseFin}` : ''}${c.note ? ` · « ${c.note} »` : ''}`)
    .join(' et ')
}

/** Les `n` jours à partir de `premier` : "2026-10-19", "2026-10-20"… */
export function listeJours(premier: string, n: number) {
  return Array.from({ length: n }, (_, i) => {
    const d = dateDuJour(premier)
    d.setDate(d.getDate() + i)
    return jourLocal(d)
  })
}

/** "7 h 30", et "0 h" plutôt que "0 min" pour un total vide. */
export const texteHeures = (h: number) => (h > 0 ? formatHeures(h) : '0 h')

/** Semaine type d'un employé : 7 jours (lundi → dimanche), chacun une liste de créneaux. */
export type SemaineType = Creneau[][]

export function normaliserSemaineType(brut: unknown): SemaineType | null {
  if (!Array.isArray(brut) || brut.length !== 7) return null
  return brut.map(normaliserCreneaux)
}
