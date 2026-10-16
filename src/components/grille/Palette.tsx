import { COULEURS_MODELES, texteCreneaux, type ModeleHoraire } from '../../lib/creneaux'

export const GOMME = 'gomme'

/** Barre des horaires types : choisir un « pinceau », ou remplir les cases choisies. */
export default function Palette({
  modeles,
  pinceau,
  selection,
  onChoisir,
  onGerer,
}: {
  modeles: ModeleHoraire[]
  pinceau: string | null
  selection: number
  onChoisir: (id: string) => void
  onGerer: () => void
}) {
  return (
    <section aria-label="Horaires types" className="rounded-2xl border border-ligne bg-white p-3">
      <p className="mb-2 px-1 text-sm text-gris">
        {selection
          ? `Choisissez l'horaire des ${selection > 1 ? `${selection} cases choisies` : 'la case choisie'} :`
          : pinceau
            ? 'Pinceau actif : touchez les cases à remplir (ou glissez sur plusieurs cases avec la souris).'
            : 'Choisissez un pinceau puis touchez les cases, ou touchez d’abord les cases puis un horaire.'}
      </p>
      <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:flex-wrap">
        {modeles.map((m) => {
          const c = COULEURS_MODELES[m.couleur] ?? COULEURS_MODELES[0]
          const actif = pinceau === m.id
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onChoisir(m.id)}
              aria-pressed={actif}
              className={`flex min-h-[52px] shrink-0 items-center gap-2.5 rounded-xl border-2 bg-white py-1.5 pr-3.5 pl-1.5 text-left ${
                actif ? 'border-encre' : 'border-ligne hover:border-[#C9CCD4]'
              }`}
            >
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-lg border text-[15px] font-extrabold"
                style={{ background: c.fond, color: c.texte, borderColor: c.lisere }}
              >
                {m.code}
              </span>
              <span className="flex flex-col leading-tight">
                <span className="text-sm font-bold">{m.nom}</span>
                <span className="text-xs whitespace-nowrap text-gris">{texteCreneaux(m.creneaux)}</span>
              </span>
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => onChoisir(GOMME)}
          aria-pressed={pinceau === GOMME}
          className={`flex min-h-[52px] shrink-0 items-center gap-2.5 rounded-xl border-2 bg-white py-1.5 pr-3.5 pl-1.5 text-left ${
            pinceau === GOMME ? 'border-encre' : 'border-ligne hover:border-[#C9CCD4]'
          }`}
        >
          <span className="flex size-9 items-center justify-center rounded-lg border border-[#C9CCD4] text-gris">
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-bold">{selection ? 'Vider' : 'Gomme'}</span>
            <span className="text-xs whitespace-nowrap text-gris">Pas de service</span>
          </span>
        </button>
        <button
          type="button"
          onClick={onGerer}
          className="min-h-[52px] shrink-0 rounded-xl border border-dashed border-[#9AA0AC] px-3.5 text-sm font-bold text-marque-fonce hover:bg-marque-doux"
        >
          Gérer les horaires types
        </button>
      </div>
    </section>
  )
}
