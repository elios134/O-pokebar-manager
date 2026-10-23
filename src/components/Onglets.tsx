/** Rangée d'onglets (le contenu de la page change selon l'onglet choisi). */
export default function Onglets<T extends string>({
  onglets,
  actif,
  onChoisir,
  large = false,
}: {
  onglets: readonly { id: T; texte: string }[]
  actif: T
  onChoisir: (id: T) => void
  /** Sur téléphone, les onglets se partagent toute la largeur. */
  large?: boolean
}) {
  return (
    <div
      role="tablist"
      className={`mb-4 flex gap-1 overflow-x-auto rounded-xl bg-[#E8E9EE] p-1 ${large ? 'w-full sm:w-fit' : 'w-fit max-w-full'}`}
    >
      {onglets.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={actif === o.id}
          onClick={() => onChoisir(o.id)}
          className={`h-10 shrink-0 rounded-lg px-3 text-sm whitespace-nowrap sm:px-4 ${large ? 'flex-1 sm:flex-none' : ''} ${
            actif === o.id ? 'bg-white font-bold shadow-sm' : 'font-semibold text-[#4A5060]'
          }`}
        >
          {o.texte}
        </button>
      ))}
    </div>
  )
}
