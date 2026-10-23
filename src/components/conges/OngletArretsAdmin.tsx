import { useCallback, useEffect, useState } from 'react'
import { formatPeriode, nbJours } from '../../lib/dates'
import { estPdf, liensSignes } from '../../lib/fichiers'
import { compterHoraires, retirerHoraires } from '../../lib/horairesPeriode'
import { CHAMPS_ARRET, type ArretMaladie } from '../../lib/rh'
import { supabase } from '../../lib/supabase'
import type { Profil } from '../../lib/types'
import { signalerDemandesModifiees } from '../../lib/useDemandesEnAttente'
import { IconePlus } from '../Icones'
import Message, { type TypeMessage } from '../Message'
import FenetreArret from './FenetreArret'

const fmtHeure = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})
const fmtJour = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })

/** Admin : tous les arrêts maladie, « arrêt reçu », retrait des horaires prévus pendant l'arrêt. */
export default function OngletArretsAdmin({ profils }: { profils: Profil[] }) {
  const [arrets, setArrets] = useState<ArretMaladie[] | null>(null)
  const [liens, setLiens] = useState<Record<string, string>>({})
  const [horaires, setHoraires] = useState<Record<string, number>>({})
  const [saisie, setSaisie] = useState(false)
  const [message, setMessage] = useState<TypeMessage | null>(null)

  const charger = useCallback(
    () =>
      supabase
        .from('arrets_maladie')
        .select(CHAMPS_ARRET)
        .order('debut', { ascending: false })
        .then(async ({ data, error }) => {
          if (error) return setMessage({ type: 'erreur', texte: 'Impossible de charger les arrêts.' })
          const liste = data as ArretMaladie[]
          setArrets(liste)
          const [l, ...n] = await Promise.all([
            liensSignes(
              'arrets',
              liste.map((a) => a.photo),
            ),
            ...liste.map((a) => compterHoraires(a.employe_id, a.debut, a.fin)),
          ])
          setLiens(l as Record<string, string>)
          setHoraires(Object.fromEntries(liste.map((a, i) => [a.id, n[i] as number])))
        }),
    [],
  )

  useEffect(() => {
    void charger()
  }, [charger])

  const nomDe = (id: string) => {
    const p = profils.find((x) => x.id === id)
    return p ? `${p.prenom} ${p.nom}` : 'Employé'
  }

  async function marquerRecu(a: ArretMaladie, recu: boolean) {
    const { error } = await supabase
      .from('arrets_maladie')
      .update({ recu_le: recu ? new Date().toISOString() : null })
      .eq('id', a.id)
    setMessage(
      error
        ? { type: 'erreur', texte: 'Action impossible.' }
        : { type: 'ok', texte: recu ? `Arrêt de ${nomDe(a.employe_id)} marqué reçu.` : 'Remis à « à recevoir ».' },
    )
    signalerDemandesModifiees('conges')
    void charger()
  }

  async function retirer(a: ArretMaladie) {
    const n = horaires[a.id] ?? 0
    if (!window.confirm(`Retirer ${n} horaire${n > 1 ? 's' : ''} de ${nomDe(a.employe_id)} pendant l'arrêt ?`)) return
    const ok = await retirerHoraires(a.employe_id, a.debut, a.fin)
    setMessage(
      ok
        ? { type: 'ok', texte: `${n} horaire${n > 1 ? 's' : ''} retiré${n > 1 ? 's' : ''} du planning.` }
        : { type: 'erreur', texte: 'Suppression impossible.' },
    )
    void charger()
  }

  async function supprimer(a: ArretMaladie) {
    if (!window.confirm(`Supprimer l'arrêt de ${nomDe(a.employe_id)} ?`)) return
    const { error } = await supabase.from('arrets_maladie').delete().eq('id', a.id)
    if (!error && a.photo) await supabase.storage.from('arrets').remove([a.photo])
    setMessage(error ? { type: 'erreur', texte: 'Suppression impossible.' } : { type: 'ok', texte: 'Arrêt supprimé.' })
    signalerDemandesModifiees('conges')
    void charger()
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setSaisie(true)}
        className="mb-4 flex h-11 items-center gap-2 rounded-xl bg-marque px-4 text-sm font-bold text-white hover:bg-marque-fonce sm:text-[15px]"
      >
        <IconePlus />
        Saisir un arrêt
      </button>
      <Message message={message} />

      {arrets === null ? (
        <p className="text-gris">Chargement…</p>
      ) : arrets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#C9CCD4] bg-white p-8 text-center text-gris">
          Aucun arrêt maladie.
        </div>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {arrets.map((a) => {
            const jours = nbJours(a.debut, a.fin)
            const lien = a.photo ? liens[a.photo] : undefined
            const n = horaires[a.id] ?? 0
            return (
              <li
                key={a.id}
                className={`flex gap-3 rounded-2xl border bg-white p-4 ${a.recu_le ? 'border-ligne' : 'border-[#F1B4B4]'}`}
              >
                {lien && !estPdf(a.photo!) ? (
                  <a
                    href={lien}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Voir l'arrêt de travail de ${nomDe(a.employe_id)}`}
                    className="size-20 shrink-0 overflow-hidden rounded-lg bg-fond"
                  >
                    <img src={lien} alt="" className="size-full object-cover" />
                  </a>
                ) : lien ? (
                  <a
                    href={lien}
                    target="_blank"
                    rel="noreferrer"
                    className="flex size-20 shrink-0 items-center justify-center rounded-lg bg-marque-doux text-sm font-extrabold text-marque-fonce"
                  >
                    PDF
                  </a>
                ) : (
                  <span className="flex size-20 shrink-0 items-center justify-center rounded-lg bg-fond px-1 text-center text-[11px] text-gris">
                    Pas encore d'arrêt de travail
                  </span>
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="mr-auto font-extrabold">{nomDe(a.employe_id)}</span>
                    {a.recu_le ? (
                      <span className="rounded-full bg-[#DDF5E6] px-2.5 py-1 text-xs font-bold text-[#145C32]">
                        Reçu le {fmtJour.format(new Date(a.recu_le))}
                      </span>
                    ) : (
                      <span className="rounded-full bg-[#FFF1C2] px-2.5 py-1 text-xs font-bold text-[#6B4E00]">
                        À recevoir
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-semibold first-letter:uppercase">
                    {formatPeriode(a.debut, a.fin)} · {jours} jour{jours > 1 ? 's' : ''}
                  </div>
                  <div className="text-xs text-gris">
                    {a.saisi_par === a.employe_id ? 'Déclaré' : 'Saisi par un responsable'} le{' '}
                    {fmtHeure.format(new Date(a.cree_le))}
                    {a.message && ` · « ${a.message} »`}
                  </div>
                  {n > 0 && (
                    <button
                      type="button"
                      onClick={() => void retirer(a)}
                      className="w-fit text-left text-sm font-bold text-[#9B1C1C]"
                    >
                      {n} horaire{n > 1 ? 's' : ''} prévu{n > 1 ? 's' : ''} pendant l'arrêt · Retirer du planning
                    </button>
                  )}
                  <div className="mt-1 flex flex-wrap gap-2">
                    {a.recu_le ? (
                      <button
                        type="button"
                        onClick={() => void marquerRecu(a, false)}
                        className="h-10 rounded-lg px-2 text-sm font-semibold text-marque-fonce hover:bg-marque-doux"
                      >
                        Remettre « à recevoir »
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void marquerRecu(a, true)}
                        className="h-10 rounded-lg bg-[#1F7A45] px-3 text-sm font-bold text-white hover:bg-[#145C32]"
                      >
                        Arrêt reçu
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void supprimer(a)}
                      className="ml-auto h-10 rounded-lg px-2 text-sm font-semibold text-[#9B1C1C] hover:bg-red-50"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {saisie && (
        <FenetreArret
          employes={profils.filter((p) => p.actif)}
          onFermer={() => setSaisie(false)}
          onEnregistre={(texte) => {
            setSaisie(false)
            setMessage({ type: 'ok', texte })
            void charger()
          }}
        />
      )}
    </div>
  )
}
