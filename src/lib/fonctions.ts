import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from './supabase'

/** Appelle la fonction serveur des admins et renvoie un message d'erreur clair (ou null). */
export async function gererEmploye(corps: Record<string, unknown>): Promise<string | null> {
  const { error } = await supabase.functions.invoke('gerer-employe', { body: corps })
  if (!error) return null
  if (error instanceof FunctionsHttpError) {
    try {
      const json = await error.context.json()
      if (json?.erreur) return String(json.erreur)
    } catch {
      /* réponse non lisible : message générique */
    }
  }
  return 'Action impossible. Vérifiez votre connexion et réessayez.'
}
