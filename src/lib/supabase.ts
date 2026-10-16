import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const cle = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !cle) {
  throw new Error('Il manque VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY dans le fichier .env')
}

// Sans réseau, les lectures de données échouent tout de suite (au lieu de réessayer pendant plusieurs
// secondes) : l'application affiche alors sans attendre ce qui est gardé sur l'appareil.
const fetchRapide: typeof fetch = (entree, options) => {
  const adresse = typeof entree === 'string' ? entree : entree instanceof URL ? entree.href : entree.url
  if (!navigator.onLine && adresse.includes('/rest/v1/')) {
    return Promise.reject(new DOMException('Pas de connexion internet', 'AbortError'))
  }
  return fetch(entree, options)
}

export const supabase = createClient(url, cle, { global: { fetch: fetchRapide } })

/** Clé sous laquelle Supabase garde la session dans le navigateur (son nom par défaut). */
export const CLE_SESSION = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`
