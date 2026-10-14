import { useEffect, useState } from 'react'
import { supabase } from './supabase'

/** Nombre de demandes de congé en attente (pour l'admin). */
export function useCongesEnAttente(actif: boolean) {
  const [nombre, setNombre] = useState(0)
  useEffect(() => {
    if (!actif) return
    let annule = false
    const charger = () =>
      supabase
        .from('conges')
        .select('id', { count: 'exact', head: true })
        .eq('statut', 'en_attente')
        .then(({ count }) => !annule && setNombre(count ?? 0))
    void charger()
    window.addEventListener('conges-modifies', charger)
    return () => {
      annule = true
      window.removeEventListener('conges-modifies', charger)
    }
  }, [actif])
  return nombre
}

/** À appeler après une action sur les congés pour mettre le compteur à jour. */
export const signalerCongesModifies = () => window.dispatchEvent(new Event('conges-modifies'))
