import { dateDuJour, jourSuivant } from './dates'
import { supabase } from './supabase'

/** Horaires d'un employé qui touchent une période (jours inclus), pour un congé ou un arrêt. */
const plage = (debut: string, fin: string) => ({
  de: dateDuJour(debut).toISOString(),
  a: dateDuJour(jourSuivant(fin)).toISOString(),
})

export async function compterHoraires(employe: string, debut: string, fin: string) {
  const { de, a } = plage(debut, fin)
  const { count } = await supabase
    .from('shifts')
    .select('id', { count: 'exact', head: true })
    .eq('employe_id', employe)
    .lt('debut', a)
    .gt('fin', de)
  return count ?? 0
}

/** Retire ces horaires du planning. Renvoie false si la suppression a échoué. */
export async function retirerHoraires(employe: string, debut: string, fin: string) {
  const { de, a } = plage(debut, fin)
  const { error } = await supabase.from('shifts').delete().eq('employe_id', employe).lt('debut', a).gt('fin', de)
  return !error
}
