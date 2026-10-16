import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { dernierCompte, garder, relire, toutEffacer } from '../lib/horsLigne'
import { supabase } from '../lib/supabase'
import { CHAMPS_PROFIL, type Profil } from '../lib/types'

interface AuthValeur {
  chargement: boolean
  session: Session | null
  profil: Profil | null
  connexion: (email: string, motDePasse: string) => Promise<string | null>
  deconnexion: () => Promise<void>
}

const AuthContext = createContext<AuthValeur | null>(null)

/** Profil du compte ; sans réseau, celui gardé sur l'appareil (`horsLigne` vaut alors true). */
async function chargerProfil(id: string): Promise<{ profil: Profil | null; horsLigne: boolean }> {
  const { data, error } = await supabase
    .from('profiles')
    .select(CHAMPS_PROFIL)
    .eq('id', id)
    .maybeSingle()
  if (error) return { profil: relire<Profil>(`profil:${id}`)?.valeur ?? null, horsLigne: true }
  if (data) garder(`profil:${id}`, data)
  return { profil: data, horsLigne: false }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Sans réseau au démarrage : on affiche tout de suite le dernier compte gardé sur l'appareil,
  // sans attendre que Supabase abandonne ses tentatives de connexion.
  const [profilGarde] = useState(() => {
    const id = navigator.onLine ? null : dernierCompte()
    return id ? (relire<Profil>(`profil:${id}`)?.valeur ?? null) : null
  })
  const [chargement, setChargement] = useState(!profilGarde)
  const [session, setSession] = useState<Session | null>(null)
  const [profil, setProfil] = useState<Profil | null>(profilGarde)

  useEffect(() => {
    let annule = false

    async function appliquer(s: Session | null) {
      // Sans réseau et session expirée : on montre quand même les données gardées du dernier compte.
      if (!s && !navigator.onLine) {
        const id = dernierCompte()
        setProfil(id ? (relire<Profil>(`profil:${id}`)?.valeur ?? null) : null)
        setChargement(false)
        return
      }
      const r = s ? await chargerProfil(s.user.id) : null
      if (annule) return
      const p = r?.profil ?? null
      // Compte désactivé ou profil introuvable : on ferme la session (pas sans réseau, où on ne peut pas savoir).
      if (s && !r?.horsLigne && (!p || !p.actif)) {
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

    // Retour du réseau : on revérifie la session (elle se renouvelle si besoin).
    const reseauRevenu = () => void supabase.auth.getSession().then(({ data: d }) => appliquer(d.session))
    window.addEventListener('online', reseauRevenu)

    return () => {
      annule = true
      data.subscription.unsubscribe()
      window.removeEventListener('online', reseauRevenu)
    }
  }, [])

  async function connexion(email: string, motDePasse: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: motDePasse })
    if (error) {
      return error.message === 'Invalid login credentials'
        ? 'Email ou mot de passe incorrect.'
        : 'Connexion impossible. Réessayez.'
    }
    const { profil: p } = await chargerProfil(data.user.id)
    if (!p || !p.actif) {
      await supabase.auth.signOut()
      return 'Ce compte est désactivé. Contactez un administrateur.'
    }
    setSession(data.session)
    setProfil(p)
    return null
  }

  async function deconnexion() {
    toutEffacer()
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
