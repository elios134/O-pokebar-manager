import { reduirePhoto } from './cuisine'
import { supabase } from './supabase'

export type Stockage = 'dlc' | 'arrets' | 'documents'

/** Taille maximale d'un document ou d'un arrêt de travail (10 Mo). */
export const TAILLE_MAX = 10 * 1024 * 1024

/**
 * Envoie un fichier dans un stockage privé, dans le dossier donné. Une photo est réduite avant l'envoi ;
 * un PDF part tel quel. Renvoie le chemin du fichier, ou une erreur claire.
 */
export async function envoyerFichier(
  stockage: Stockage,
  dossier: string,
  fichier: File,
): Promise<{ chemin: string; taille: number } | { erreur: string }> {
  const pdf = fichier.type === 'application/pdf'
  if (!pdf && !fichier.type.startsWith('image/')) return { erreur: 'Choisissez un PDF ou une photo.' }
  try {
    const contenu = pdf ? fichier : await reduirePhoto(fichier)
    if (contenu.size > TAILLE_MAX) return { erreur: 'Fichier trop lourd (10 Mo maximum).' }
    const chemin = `${dossier}/${crypto.randomUUID()}.${pdf ? 'pdf' : 'jpg'}`
    const { error } = await supabase.storage
      .from(stockage)
      .upload(chemin, contenu, { contentType: pdf ? 'application/pdf' : 'image/jpeg' })
    if (error) throw error
    return { chemin, taille: contenu.size }
  } catch {
    return { erreur: "Le fichier n'a pas pu être envoyé. Réessayez." }
  }
}

/** Liens temporaires (1 h) vers des fichiers privés, rangés par chemin. */
export async function liensSignes(stockage: Stockage, chemins: (string | null)[]): Promise<Record<string, string>> {
  const liste = chemins.filter((x): x is string => !!x)
  if (!liste.length) return {}
  const { data } = await supabase.storage.from(stockage).createSignedUrls(liste, 3600)
  return Object.fromEntries((data ?? []).filter((l) => l.signedUrl && l.path).map((l) => [l.path!, l.signedUrl!]))
}

export const estPdf = (chemin: string) => chemin.endsWith('.pdf')
