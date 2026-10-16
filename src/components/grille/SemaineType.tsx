import { COULEURS_MODELES, heureCourte, memesHeures, texteHeures, dureeCreneaux, type ModeleHoraire, type SemaineType as Semaine } from '../../lib/creneaux'
import { jourLocal } from '../../lib/dates'

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const JOURS_LONGS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']
const VIDE: Semaine = [[], [], [], [], [], [], []]
// Jour pris pour calculer les durées (n'importe quel jour convient).
const JOUR_CALCUL = jourLocal(new Date())

/** Semaine habituelle d'un employé : se remplit au pinceau, puis s'applique à la semaine ou au mois. */
export default function SemaineType({
  prenom,
  valeur,
  modeles,
  pinceau,
  mois,
  onChange,
  onAppliquer,
}: {
  prenom: string
  valeur: Semaine | null
  modeles: ModeleHoraire[]
  pinceau: (() => ModeleHoraire['creneaux'] | undefined) | null
  mois: boolean
  onChange: (s: Semaine) => void
  onAppliquer: (seulementVides: boolean) => void
}) {
  const semaine = valeur ?? VIDE
  const total = semaine.reduce((t, j) => t + dureeCreneaux(JOUR_CALCUL, j), 0)
  const vide = semaine.every((j) => !j.length)

  function toucher(i: number) {
    const creneaux = pinceau?.()
    if (!creneaux) return
    onChange(semaine.map((j, k) => (k === i ? creneaux.map(({ debut, fin, pauseDebut, pauseFin }) => ({ debut, fin, pauseDebut, pauseFin })) : j)))
  }

  return (
    <section aria-label={`Semaine type de ${prenom}`} className="flex flex-col gap-3 rounded-2xl border border-ligne bg-white p-4">
      <div>
        <h2 className="text-[17px] font-extrabold">Semaine type de {prenom}</h2>
        <p className="mt-1 text-[13px] text-gris">
          {pinceau
            ? 'Touchez un jour pour y mettre le pinceau choisi.'
            : 'Choisissez un pinceau (ou la gomme) puis touchez les jours. Elle est enregistrée tout de suite.'}
        </p>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {semaine.map((j, i) => {
          const modele = j.length ? modeles.find((m) => memesHeures(m.creneaux, j)) : undefined
          const c = modele ? (COULEURS_MODELES[modele.couleur] ?? COULEURS_MODELES[0]) : null
          return (
            <button
              key={i}
              type="button"
              onClick={() => toucher(i)}
              aria-label={`Semaine type, ${JOURS_LONGS[i]} : ${modele ? modele.nom : j.length ? 'horaire libre' : 'repos'}`}
              className="flex h-14 flex-col items-center justify-center gap-0.5 rounded-lg border"
              style={
                c
                  ? { background: c.fond, color: c.texte, borderColor: c.lisere }
                  : { background: j.length ? '#F4F5F7' : '#FFFFFF', color: j.length ? '#16181D' : '#9AA0AC', borderColor: '#E3E5EA' }
              }
            >
              <span className="text-[10px] font-bold text-gris uppercase">{JOURS[i]}</span>
              <span className={`font-extrabold ${modele || !j.length ? 'text-[15px]' : 'text-[10px]'}`}>
                {modele ? modele.code : j.length ? heureCourte(j[0].debut) : '–'}
              </span>
            </button>
          )
        })}
      </div>
      <p className="text-[13px] text-gris">
        Total : <b className="text-encre">{texteHeures(total)}</b> par semaine
      </p>
      <button
        type="button"
        disabled={vide}
        onClick={() => onAppliquer(false)}
        className="h-12 rounded-xl bg-marque px-4 font-bold text-white hover:bg-marque-fonce disabled:opacity-50"
      >
        {mois ? 'Appliquer à tout le mois' : 'Appliquer à cette semaine'}
      </button>
      <button
        type="button"
        disabled={vide}
        onClick={() => onAppliquer(true)}
        className="h-11 rounded-xl border border-[#C9CCD4] bg-white px-4 font-bold hover:bg-fond disabled:opacity-50"
      >
        Seulement les jours vides
      </button>
      <p className="text-xs text-gris">Les congés acceptés ne sont jamais remplis. Rien n'est envoyé avant « Enregistrer ».</p>
    </section>
  )
}
