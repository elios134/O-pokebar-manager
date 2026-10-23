import { useEffect, useState } from 'react'
import { supabase } from './supabase'

type Demandes = 'conges' | 'acomptes'

/** Nombre de demandes (congés ou acomptes) en attente, pour l'admin. Côté congés : avec les arrêts maladie à recevoir. */
export function useDemandesEnAttente(table: Demandes, actif: boolean) {
  const [nombre, setNombre] = useState(0)
  useEffect(() => {
    if (!actif) return
    let annule = false
    const charger = () =>
      Promise.all([
        supabase.from(table).select('id', { count: 'exact', head: true }).eq('statut', 'en_attente'),
        table === 'conges'
          ? supabase.from('arrets_maladie').select('id', { count: 'exact', head: true }).is('recu_le', null)
          : Promise.resolve({ count: 0 }),
      ]).then(([a, b]) => !annule && setNombre((a.count ?? 0) + (b.count ?? 0)))
    void charger()
    window.addEventListener(`${table}-modifies`, charger)
    return () => {
      annule = true
      window.removeEventListener(`${table}-modifies`, charger)
    }
  }, [table, actif])
  return nombre
}

/** À appeler après une action sur des demandes pour mettre les compteurs à jour. */
export const signalerDemandesModifiees = (table: Demandes) => window.dispatchEvent(new Event(`${table}-modifies`))
