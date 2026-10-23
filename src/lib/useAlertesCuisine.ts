import { useEffect, useState } from 'react'
import { jourLocal, jourSuivant } from './dates'
import { supabase } from './supabase'

/**
 * Pastille du menu « Cuisine » : produits à utiliser aujourd'hui ou demain (ou dépassés),
 * frigos pas encore relevés aujourd'hui, et pour l'admin les produits à commander.
 */
export function useAlertesCuisine(actif: boolean, admin: boolean) {
  const [nombre, setNombre] = useState(0)
  useEffect(() => {
    if (!actif) return
    let annule = false
    const charger = () => {
      const aujourdhui = jourLocal(new Date())
      void Promise.all([
        supabase.from('dlc_produits').select('id', { count: 'exact', head: true }).is('retire_le', null).lte('dlc', jourSuivant(aujourdhui)),
        supabase.from('frigos').select('id', { count: 'exact', head: true }),
        supabase.from('releves_temperature').select('id', { count: 'exact', head: true }).eq('jour', aujourdhui),
        admin
          ? supabase.from('commandes').select('id', { count: 'exact', head: true }).eq('statut', 'a_commander')
          : Promise.resolve({ count: 0 }),
      ]).then(([dlc, frigos, releves, commandes]) => {
        if (annule) return
        setNombre((dlc.count ?? 0) + Math.max(0, (frigos.count ?? 0) - (releves.count ?? 0)) + (commandes.count ?? 0))
      })
    }
    charger()
    window.addEventListener('cuisine-modifiee', charger)
    return () => {
      annule = true
      window.removeEventListener('cuisine-modifiee', charger)
    }
  }, [actif, admin])
  return nombre
}

export const signalerCuisineModifiee = () => window.dispatchEvent(new Event('cuisine-modifiee'))
