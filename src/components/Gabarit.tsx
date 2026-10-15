import type { ReactNode, SVGProps } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { initiales } from '../lib/couleurs'
import { useCongesEnAttente } from '../lib/useCongesEnAttente'
import BoutonInstaller from './BoutonInstaller'
import Cloche from './Cloche'
import { IconeCalendrier, IconeCompte, IconeEquipe, IconeSortie, IconeSoleil } from './Icones'

interface Lien {
  vers: string
  texte: string
  icone: (p: SVGProps<SVGSVGElement>) => ReactNode
  badge?: number
}

const lienHaut = ({ isActive }: { isActive: boolean }) =>
  `flex h-10 items-center gap-2 rounded-lg px-4 text-sm ${
    isActive ? 'bg-marque-doux font-bold text-marque-fonce' : 'font-semibold text-[#4A5060] hover:bg-fond'
  }`

const lienBas = ({ isActive }: { isActive: boolean }) =>
  `relative flex flex-col items-center justify-center gap-1 text-xs ${
    isActive ? 'font-bold text-marque' : 'font-semibold text-[#4A5060]'
  }`

function Pastille({ n }: { n?: number }) {
  if (!n) return null
  return (
    <span className="rounded-full bg-[#D6457E] px-1.5 text-[11px] leading-[18px] font-bold text-white" aria-label={`${n} en attente`}>
      {n}
    </span>
  )
}

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
  const enAttente = useCongesEnAttente(admin)

  const liens: Lien[] = admin
    ? [
        { vers: '/admin/planning', texte: 'Planning', icone: IconeCalendrier },
        { vers: '/admin/employes', texte: 'Employés', icone: IconeEquipe },
        { vers: '/admin/conges', texte: 'Congés', icone: IconeSoleil, badge: enAttente },
      ]
    : [
        { vers: '/mon-planning', texte: 'Planning', icone: IconeCalendrier },
        { vers: '/mes-conges', texte: 'Congés', icone: IconeSoleil },
      ]

  return (
    <div className="min-h-dvh pb-20 sm:pb-0">
      <header className="sticky top-0 z-20 border-b border-ligne bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-8">
          <div className="flex items-center gap-2.5">
            <img src="/favicon.svg" alt="" className="size-8 rounded-lg" />
            <span className="text-[17px] font-bold">O'pokebar</span>
            {admin && (
              <span className="rounded-md bg-marque-doux px-2 py-0.5 text-[11px] font-bold text-marque-fonce">
                ADMIN
              </span>
            )}
          </div>

          <nav className="ml-6 hidden gap-1 sm:flex">
            {liens.map((l) => (
              <NavLink key={l.vers} to={l.vers} className={lienHaut}>
                {l.texte}
                <Pastille n={l.badge} />
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2.5">
            <BoutonInstaller />
            {profil && <Cloche moi={profil.id} />}
            <NavLink
              to="/mon-compte"
              aria-label="Mon compte"
              className="hidden items-center gap-2.5 rounded-full py-1 pr-2 pl-1 hover:bg-fond sm:flex"
            >
              <span className="flex size-9 items-center justify-center rounded-full bg-nuit text-[13px] font-bold text-white">
                {initiales(profil?.prenom ?? '', profil?.nom ?? '')}
              </span>
              <span className="hidden text-sm font-semibold md:inline">
                {profil?.prenom} {profil?.nom}
              </span>
            </NavLink>
            <button
              type="button"
              onClick={() => void deconnexion()}
              className="hidden h-10 items-center gap-2 rounded-lg border border-[#C9CCD4] px-3 text-sm font-semibold hover:bg-fond sm:flex"
            >
              <IconeSortie />
              Déconnexion
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

      <nav
        className="fixed inset-x-0 bottom-0 z-20 grid h-[72px] border-t border-ligne bg-white pb-2 sm:hidden"
        style={{ gridTemplateColumns: `repeat(${liens.length + 1}, minmax(0, 1fr))` }}
      >
        {liens.map((l) => (
          <NavLink key={l.vers} to={l.vers} className={lienBas}>
            <span className="relative">
              <l.icone width={22} height={22} />
              {!!l.badge && (
                <span className="absolute -top-1.5 -right-3">
                  <Pastille n={l.badge} />
                </span>
              )}
            </span>
            {l.texte}
          </NavLink>
        ))}
        <NavLink to="/mon-compte" className={lienBas}>
          <IconeCompte width={22} height={22} />
          Compte
        </NavLink>
      </nav>
    </div>
  )
}
