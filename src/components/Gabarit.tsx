import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

const lienClasse = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-2 text-sm font-medium ${
    isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
  }`

export default function Gabarit({ titre, children }: { titre: string; children: ReactNode }) {
  const { profil, deconnexion } = useAuth()

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-3">
          <span className="mr-auto font-semibold text-slate-900">Planning</span>
          {profil?.role === 'admin' && (
            <nav className="order-last flex w-full gap-1 sm:order-none sm:w-auto">
              <NavLink to="/admin/planning" className={lienClasse}>
                Planning
              </NavLink>
              <NavLink to="/admin/employes" className={lienClasse}>
                Employés
              </NavLink>
            </nav>
          )}
          <span className="hidden text-sm text-slate-500 sm:inline">
            {profil?.prenom} {profil?.nom}
          </span>
          <button
            onClick={() => void deconnexion()}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Déconnexion
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="mb-4 text-xl font-semibold text-slate-900">{titre}</h1>
        {children}
      </main>
    </div>
  )
}
