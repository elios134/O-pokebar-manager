import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { IconeFermer } from './Icones'

/** Fenêtre au centre sur grand écran, qui monte du bas sur téléphone. */
export default function Fenetre({
  titre,
  onFermer,
  children,
  large = false,
}: {
  titre: string
  onFermer: () => void
  children: ReactNode
  large?: boolean
}) {
  useEffect(() => {
    const echap = (e: KeyboardEvent) => e.key === 'Escape' && onFermer()
    window.addEventListener('keydown', echap)
    return () => window.removeEventListener('keydown', echap)
  }, [onFermer])

  // Rendu directement dans <body> : la fenêtre passe toujours au-dessus de l'en-tête et du menu.
  return createPortal(
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-[rgba(22,24,29,0.45)] sm:items-center"
      onMouseDown={(e) => e.target === e.currentTarget && onFermer()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titre}
        className={`max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white px-5 pt-3 pb-7 shadow-2xl sm:rounded-2xl sm:p-7 ${
          large ? 'sm:max-w-3xl' : 'sm:max-w-md'
        }`}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-[#C9CCD4] sm:hidden" />
        <div className="mb-4 flex items-center">
          <h2 className="mr-auto text-xl font-extrabold">{titre}</h2>
          <button
            type="button"
            onClick={onFermer}
            aria-label="Fermer"
            className="flex size-11 items-center justify-center rounded-xl bg-fond hover:bg-ligne sm:size-10"
          >
            <IconeFermer />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}

export const champ =
  'h-12 w-full min-w-0 rounded-xl border border-[#C9CCD4] bg-white px-3 text-base text-encre outline-none focus:border-marque focus:ring-2 focus:ring-marque-doux sm:h-11 sm:text-[15px]'
export const etiquette = 'flex flex-col gap-1.5 text-sm font-semibold'
export const boutonPrincipal =
  'h-12 rounded-xl bg-marque px-5 text-base font-bold text-white hover:bg-marque-fonce disabled:opacity-60 sm:h-11 sm:text-[15px]'
export const boutonSecondaire =
  'h-12 rounded-xl border border-[#C9CCD4] bg-white px-4 text-base font-semibold hover:bg-fond sm:h-11 sm:text-[15px]'
