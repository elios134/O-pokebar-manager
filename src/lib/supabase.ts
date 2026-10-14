import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const cle = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !cle) {
  throw new Error('Il manque VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY dans le fichier .env')
}

export const supabase = createClient(url, cle)
