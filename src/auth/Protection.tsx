import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { accesCuisine } from '../lib/types'
import { pageAccueil } from './pageAccueil'

function Chargement() {
  return (
    <div className="flex min-h-screen items-center justify-center text-slate-500">Chargement…</div>
  )
}

/** Laisse passer seulement un utilisateur connecté (et admin, ou cuisine, si c'est demandé). */
export function Protege({ children, admin = false, cuisine = false }: { children: ReactNode; admin?: boolean; cuisine?: boolean }) {
  const { chargement, profil } = useAuth()
  if (chargement) return <Chargement />
  if (!profil) return <Navigate to="/connexion" replace />
  if (admin && profil.role !== 'admin') return <Navigate to={pageAccueil(profil.role)} replace />
  if (cuisine && !accesCuisine(profil.role)) return <Navigate to={pageAccueil(profil.role)} replace />
  return <>{children}</>
}

/** Redirige vers la bonne page selon le rôle. */
export function RedirectionAccueil() {
  const { chargement, profil } = useAuth()
  if (chargement) return <Chargement />
  return <Navigate to={profil ? pageAccueil(profil.role) : '/connexion'} replace />
}
