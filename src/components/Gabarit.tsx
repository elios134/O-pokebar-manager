import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { initiales } from '../lib/couleurs'
import BoutonInstaller from './BoutonInstaller'
import { IconeCalendrier, IconeEquipe, IconeSortie } from './Icones'

const lienHaut = ({ isActive }: { isActive: boolean }) =>
  `flex h-10 items-center rounded-lg px-4 text-sm ${
    isActive ? 'bg-marque-doux font-bold text-marque-fonce' : 'font-semibold text-[#4A5060] hover:bg-fond'
  }`

const lienBas = ({ isActive }: { isActive: boolean }) =>
  `flex flex-col items-center justify-center gap-1 text-xs ${
    isActive ? 'font-bold text-marque' : 'font-semibold text-[#4A5060]'
  }`

export default function Gabarit({
  titre,
  actions,
  children,
}: {
  titre: string
  actions?: ReactNode
  children: ReactNode
}) {
  const { profil, deconnexion } = useAuth()
  const admin = profil?.role === 'admin'

  return (
    <div className={`min-h-dvh ${admin ? 'pb-20 sm:pb-0' : ''}`}>
      <header className="sticky top-0 z-20 border-b border-ligne bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-8">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-nuit text-white">
              <IconeCalendrier />
            </div>
            <span className="text-[17px] font-bold">O'pokebar</span>
            {admin && (
              <span className="rounded-md bg-marque-doux px-2 py-0.5 text-[11px] font-bold text-marque-fonce">
                ADMIN
              </span>
            )}
          </div>

          {admin && (
            <nav className="ml-6 hidden gap-1 sm:flex">
              <NavLink to="/admin/planning" className={lienHaut}>
                Planning
              </NavLink>
              <NavLink to="/admin/employes" className={lienHaut}>
                Employés
              </NavLink>
            </nav>
          )}

          <div className="ml-auto flex items-center gap-2.5">
            <BoutonInstaller />
            <div className="flex size-9 items-center justify-center rounded-full bg-nuit text-[13px] font-bold text-white">
              {initiales(profil?.prenom ?? '', profil?.nom ?? '')}
            </div>
            <span className="hidden text-sm font-semibold md:inline">
              {profil?.prenom} {profil?.nom}
            </span>
            <button
              type="button"
              onClick={() => void deconnexion()}
              className={`${admin ? 'hidden sm:flex' : 'flex'} h-11 items-center gap-2 rounded-lg border border-[#C9CCD4] px-3 text-sm font-semibold hover:bg-fond sm:h-10`}
              aria-label="Déconnexion"
            >
              <IconeSortie />
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-8 sm:py-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h1 className="mr-auto text-[22px] font-extrabold sm:text-2xl">{titre}</h1>
          {actions}
        </div>
        {children}
      </main>

      {admin && (
        <nav className="fixed inset-x-0 bottom-0 z-20 grid h-[72px] grid-cols-3 border-t border-ligne bg-white pb-2 sm:hidden">
          <NavLink to="/admin/planning" className={lienBas}>
            <IconeCalendrier width={22} height={22} />
            Planning
          </NavLink>
          <NavLink to="/admin/employes" className={lienBas}>
            <IconeEquipe width={22} height={22} />
            Employés
          </NavLink>
          <button type="button" onClick={() => void deconnexion()} className={lienBas({ isActive: false })}>
            <IconeSortie width={22} height={22} />
            Déconnexion
          </button>
        </nav>
      )}
    </div>
  )
}
