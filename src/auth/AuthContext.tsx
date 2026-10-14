import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profil } from '../lib/types'

interface AuthValeur {
  chargement: boolean
  session: Session | null
  profil: Profil | null
  connexion: (email: string, motDePasse: string) => Promise<string | null>
  deconnexion: () => Promise<void>
}

const AuthContext = createContext<AuthValeur | null>(null)

async function chargerProfil(id: string): Promise<Profil | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nom, prenom, role, actif, email')
    .eq('id', id)
    .maybeSingle()
  if (error) return null
  return data
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [chargement, setChargement] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [profil, setProfil] = useState<Profil | null>(null)

  useEffect(() => {
    let annule = false

    async function appliquer(s: Session | null) {
      const p = s ? await chargerProfil(s.user.id) : null
      if (annule) return
      // Compte désactivé ou profil introuvable : on ferme la session.
      if (s && (!p || !p.actif)) {
        await supabase.auth.signOut()
        if (annule) return
        setSession(null)
        setProfil(null)
      } else {
        setSession(s)
        setProfil(p)
      }
      setChargement(false)
    }

    const { data } = supabase.auth.onAuthStateChange((evenement, s) => {
      if (evenement === 'TOKEN_REFRESHED') {
        setSession(s)
        return
      }
      // Ne pas appeler Supabase directement dans ce callback (blocage possible).
      setTimeout(() => void appliquer(s), 0)
    })

    return () => {
      annule = true
      data.subscription.unsubscribe()
    }
  }, [])

  async function connexion(email: string, motDePasse: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: motDePasse })
    if (error) {
      return error.message === 'Invalid login credentials'
        ? 'Email ou mot de passe incorrect.'
        : 'Connexion impossible. Réessayez.'
    }
    const p = await chargerProfil(data.user.id)
    if (!p || !p.actif) {
      await supabase.auth.signOut()
      return 'Ce compte est désactivé. Contactez un administrateur.'
    }
    setSession(data.session)
    setProfil(p)
    return null
  }

  async function deconnexion() {
    await supabase.auth.signOut()
    setSession(null)
    setProfil(null)
  }

  return (
    <AuthContext.Provider value={{ chargement, session, profil, connexion, deconnexion }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const valeur = useContext(AuthContext)
  if (!valeur) throw new Error('useAuth doit être utilisé dans AuthProvider')
  return valeur
}
