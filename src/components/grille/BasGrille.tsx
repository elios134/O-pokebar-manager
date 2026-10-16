import { COULEURS_MODELES, texteCreneaux, type ModeleHoraire } from '../../lib/creneaux'
import { GOMME } from './Palette'

/** Bas de l'écran : choix de l'horaire pour les cases touchées (téléphone), ou changements à enregistrer. */
export default function BasGrille({
  selection,
  modeles,
  nbModifs,
  envoi,
  onChoisir,
  onHeures,
  onAnnulerSelection,
  onAnnuler,
  onEnregistrer,
}: {
  selection: number
  modeles: ModeleHoraire[]
  nbModifs: number
  envoi: boolean
  onChoisir: (id: string) => void
  onHeures: () => void
  onAnnulerSelection: () => void
  onAnnuler: () => void
  onEnregistrer: () => void
}) {
  const s = selection > 1 ? 's' : ''
  const m = nbModifs > 1 ? 's' : ''
  return (
    <>
      {selection > 0 && (
        <div className="fixed inset-x-0 bottom-[72px] z-30 rounded-t-2xl border-t border-ligne bg-white px-4 pt-3 pb-4 shadow-[0_-8px_24px_rgba(22,24,29,0.1)] sm:hidden">
          <div className="mb-2 flex items-center">
            <span className="mr-auto font-extrabold">
              {selection} case{s} choisie{s}
            </span>
            <button type="button" onClick={onAnnulerSelection} className="h-10 px-2 text-sm font-bold text-marque-fonce">
              Annuler
            </button>
          </div>
          <div className="mb-2 grid grid-cols-3 gap-2">
            {modeles.map((x) => {
              const c = COULEURS_MODELES[x.couleur] ?? COULEURS_MODELES[0]
              return (
                <button
                  key={x.id}
                  type="button"
                  onClick={() => onChoisir(x.id)}
                  className="flex h-14 flex-col items-center justify-center rounded-xl border leading-tight"
                  style={{ background: c.fond, color: c.texte, borderColor: c.lisere }}
                >
                  <span className="text-sm font-extrabold">{x.nom}</span>
                  <span className="text-[11px] font-semibold">{texteCreneaux(x.creneaux)}</span>
                </button>
              )
            })}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={onHeures} className="h-12 rounded-xl border border-[#C9CCD4] font-bold">
              Heures et note…
            </button>
            <button type="button" onClick={() => onChoisir(GOMME)} className="h-12 rounded-xl border border-[#C9CCD4] font-bold">
              Vider
            </button>
          </div>
        </div>
      )}

      {nbModifs > 0 && selection === 0 && (
        <div className="fixed inset-x-0 bottom-[72px] z-30 border-t border-ligne bg-white px-4 py-3 shadow-[0_-8px_24px_rgba(22,24,29,0.1)] sm:bottom-0">
          <div className="mx-auto flex max-w-7xl items-center gap-2 sm:px-4">
            <span className="mr-auto text-sm font-bold">
              {nbModifs} case{m} modifiée{m}
              <span className="hidden font-medium text-gris sm:inline"> · pas encore enregistrée{m}</span>
            </span>
            <button type="button" onClick={onAnnuler} className="h-11 rounded-xl border border-[#C9CCD4] bg-white px-3 text-sm font-bold hover:bg-fond">
              Annuler
            </button>
            <button
              type="button"
              disabled={envoi}
              onClick={onEnregistrer}
              className="h-11 rounded-xl bg-marque px-5 font-bold text-white hover:bg-marque-fonce disabled:opacity-60"
            >
              {envoi ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
