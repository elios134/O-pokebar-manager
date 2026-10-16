import { NavLink } from 'react-router-dom'

const onglet = ({ isActive }: { isActive: boolean }) =>
  `flex h-10 flex-1 items-center justify-center rounded-[9px] px-4 text-sm sm:flex-none ${
    isActive ? 'bg-white font-bold text-encre shadow-[0_1px_3px_rgba(22,24,29,0.12)]' : 'font-semibold text-[#4A5060]'
  }`

/** Passer du calendrier à la grille rapide (et inversement). */
export default function BasculeVue() {
  return (
    <nav aria-label="Affichage du planning" className="flex w-full rounded-xl bg-[#E8E9EE] p-1 sm:w-auto">
      <NavLink to="/admin/planning" className={onglet}>
        Calendrier
      </NavLink>
      <NavLink to="/admin/grille" className={onglet}>
        Grille rapide
      </NavLink>
    </nav>
  )
}
