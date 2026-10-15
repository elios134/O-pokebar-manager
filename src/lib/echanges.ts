import { supabase } from './supabase'

export type StatutEchange = 'attente_collegue' | 'refuse_collegue' | 'attente_admin' | 'accepte' | 'refuse' | 'annule'

export interface Echange {
  id: string
  statut: StatutEchange
  message: string | null
  cree_le: string
  demandeur_id: string
  demandeur: string
  destinataire_id: string
  destinataire: string
  debut_demandeur: string
  fin_demandeur: string
  debut_destinataire: string | null
  fin_destinataire: string | null
}

export const LIBELLES: Record<StatutEchange, { texte: string; classe: string }> = {
  attente_collegue: { texte: 'Attend le collègue', classe: 'bg-[#FFF1C2] text-[#6B4E00]' },
  refuse_collegue: { texte: 'Refusé par le collègue', classe: 'bg-[#FDE2E2] text-[#9B1C1C]' },
  attente_admin: { texte: 'Attend le responsable', classe: 'bg-[#E2E8FF] text-[#2B3A8C]' },
  accepte: { texte: 'Validé', classe: 'bg-[#DDF5E6] text-[#145C32]' },
  refuse: { texte: 'Refusé par le responsable', classe: 'bg-[#FDE2E2] text-[#9B1C1C]' },
  annule: { texte: 'Annulé', classe: 'bg-[#E8E9EE] text-[#4A5060]' },
}

export async function chargerEchanges(): Promise<Echange[] | null> {
  const { data, error } = await supabase.rpc('mes_echanges')
  return error ? null : (data as Echange[])
}

/** Appelle une fonction de la base et renvoie son message d'erreur en clair (ou null si tout va bien). */
export async function action(nom: string, params: Record<string, unknown>): Promise<string | null> {
  const { error } = await supabase.rpc(nom, params)
  if (!error) return null
  // Les messages levés par nos fonctions sont déjà en français.
  return /[éèàç]|\.$/.test(error.message) ? error.message : 'Action impossible. Réessayez.'
}

const fmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
const fmtH = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })

/** "mar. 3 nov. · 09:00 – 17:00" */
export function texteHoraire(debut: string, fin: string) {
  return `${fmt.format(new Date(debut))} · ${fmtH.format(new Date(debut))} – ${fmtH.format(new Date(fin))}`
}
