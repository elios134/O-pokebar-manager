import { jourLocal } from './dates'

/** Espace Cuisine : DLC, températures des frigos, produits à commander. */

export interface ProduitDlc {
  id: string
  nom: string
  ouvert_le: string | null
  dlc: string // "2026-10-24"
  photo: string | null // chemin dans le stockage « dlc »
  ajoute_par: string | null
  cree_le: string
}
export const CHAMPS_DLC = 'id, nom, ouvert_le, dlc, photo, ajoute_par, cree_le'

export interface Frigo {
  id: string
  nom: string
  temp_min: number
  temp_max: number
  ordre: number
}
export const CHAMPS_FRIGO = 'id, nom, temp_min, temp_max, ordre'

export interface Releve {
  id: string
  frigo_id: string
  jour: string
  temperature: number
  commentaire: string | null
  releve_par: string | null
  releve_le: string
}
export const CHAMPS_RELEVE = 'id, frigo_id, jour, temperature, commentaire, releve_par, releve_le'

export type StatutCommande = 'a_commander' | 'commande' | 'recu'
export interface Commande {
  id: string
  produit: string
  quantite: string | null
  note: string | null
  statut: StatutCommande
  demande_par: string | null
  cree_le: string
  commande_le: string | null
  recu_le: string | null
}
export const CHAMPS_COMMANDE = 'id, produit, quantite, note, statut, demande_par, cree_le, commande_le, recu_le'

/** Les nombres de la base arrivent parfois en texte : on les remet en nombres. */
export const enNombre = <T extends object>(ligne: T, champs: (keyof T)[]) => {
  const copie = { ...ligne }
  for (const c of champs) copie[c] = Number(copie[c]) as T[keyof T]
  return copie
}

/** "-18,5" ou "3.5" → nombre ; null si la saisie n'est pas une température (une décimale au plus). */
export function lireTemperature(saisie: string) {
  const s = saisie.trim().replace(/\s/g, '')
  return /^-?\d{1,2}([.,]\d)?$/.test(s) ? Number(s.replace(',', '.')) : null
}

/** "3,5 °C" */
export const texteTemperature = (t: number) => `${t.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} °C`

export const horsLimites = (t: number, f: Pick<Frigo, 'temp_min' | 'temp_max'>) => t < f.temp_min || t > f.temp_max

/** Nombre de jours avant la DLC (négatif si dépassée). */
export function joursAvantDlc(dlc: string, aujourdhui = jourLocal(new Date())) {
  return Math.round((new Date(`${dlc}T12:00`).getTime() - new Date(`${aujourdhui}T12:00`).getTime()) / 86_400_000)
}

/** Photo prise au téléphone : réduite (1600 px maxi, JPEG) avant l'envoi, pour aller vite et prendre peu de place. */
export async function reduirePhoto(fichier: File, cote = 1600): Promise<Blob> {
  const image = await createImageBitmap(fichier)
  const echelle = Math.min(1, cote / Math.max(image.width, image.height))
  const toile = document.createElement('canvas')
  toile.width = Math.round(image.width * echelle)
  toile.height = Math.round(image.height * echelle)
  toile.getContext('2d')!.drawImage(image, 0, 0, toile.width, toile.height)
  image.close()
  return new Promise((ok, ko) => toile.toBlob((b) => (b ? ok(b) : ko(new Error('Photo illisible'))), 'image/jpeg', 0.75))
}
