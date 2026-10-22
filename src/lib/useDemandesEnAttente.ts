import { useEffect, useState } from 'react'
import { supabase } from './supabase'

type Demandes = 'conges' | 'acomptes'

/** Nombre de demandes (congés ou acomptes) en attente, pour l'admin. */
export function useDemandesEnAttente(table: Demandes, actif: boolean) {
  const [nombre, setNombre] = useState(0)
  useEffect(() => {
    if (!actif) return
    let annule = false
    const charger = () =>
      supabase
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq('statut', 'en_attente')
        .then(({ count }) => !annule && setNombre(count ?? 0))
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
