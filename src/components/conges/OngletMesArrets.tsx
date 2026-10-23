import { useCallback, useEffect, useState } from 'react'
import { formatPeriode, nbJours } from '../../lib/dates'
import { envoyerFichier, liensSignes } from '../../lib/fichiers'
import { CHAMPS_ARRET, type ArretMaladie } from '../../lib/rh'
import { supabase } from '../../lib/supabase'
import { IconePlus } from '../Icones'
import Message, { type TypeMessage } from '../Message'
import FenetreArret from './FenetreArret'

/** Arrêts maladie de l'employé connecté : déclarer, ajouter l'arrêt de travail plus tard, retirer. */
export default function OngletMesArrets({ employeId }: { employeId: string }) {
  const [arrets, setArrets] = useState<ArretMaladie[] | null>(null)
  const [liens, setLiens] = useState<Record<string, string>>({})
  const [declarer, setDeclarer] = useState(false)
  const [message, setMessage] = useState<TypeMessage | null>(null)

  const charger = useCallback(
    () =>
      supabase
        .from('arrets_maladie')
        .select(CHAMPS_ARRET)
        .eq('employe_id', employeId)
        .order('debut', { ascending: false })
        .then(async ({ data, error }) => {
          if (error) return setMessage({ type: 'erreur', texte: 'Impossible de charger vos arrêts.' })
          const liste = data as ArretMaladie[]
          setArrets(liste)
          setLiens(
            await liensSignes(
              'arrets',
              liste.map((a) => a.photo),
            ),
          )
        }),
    [employeId],
  )

  useEffect(() => {
    void charger()
  }, [charger])

  async function ajouterPhoto(a: ArretMaladie, f: File | null) {
    if (!f) return
    const r = await envoyerFichier('arrets', employeId, f)
    if ('erreur' in r) return setMessage({ type: 'erreur', texte: r.erreur })
    const { error } = await supabase.from('arrets_maladie').update({ photo: r.chemin }).eq('id', a.id)
    if (!error && a.photo) await supabase.storage.from('arrets').remove([a.photo])
    setMessage(
      error
        ? { type: 'erreur', texte: 'Envoi impossible. Réessayez.' }
        : { type: 'ok', texte: 'Arrêt de travail envoyé à votre responsable.' },
    )
    void charger()
  }

  async function retirer(a: ArretMaladie) {
    if (!window.confirm('Retirer cet arrêt maladie ?')) return
    const { error } = await supabase.from('arrets_maladie').delete().eq('id', a.id)
    if (!error && a.photo) await supabase.storage.from('arrets').remove([a.photo])
    setMessage(error ? { type: 'erreur', texte: 'Suppression impossible.' } : { type: 'ok', texte: 'Arrêt retiré.' })
    void charger()
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setDeclarer(true)}
        className="mb-4 flex h-11 items-center gap-2 rounded-xl bg-marque px-4 text-sm font-bold text-white hover:bg-marque-fonce sm:text-[15px]"
      >
        <IconePlus />
        Déclarer un arrêt maladie
      </button>
      <Message message={message} />

      {arrets === null ? (
        <p className="text-gris">Chargement…</p>
      ) : arrets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#C9CCD4] bg-white p-8 text-center text-gris">
          Aucun arrêt maladie déclaré.
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {arrets.map((a) => {
            const jours = nbJours(a.debut, a.fin)
            return (
              <li key={a.id} className="flex flex-col gap-2 rounded-2xl border border-ligne bg-white p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-auto font-bold first-letter:uppercase">{formatPeriode(a.debut, a.fin)}</span>
                  {a.recu_le ? (
                    <span className="rounded-full bg-[#DDF5E6] px-2.5 py-1 text-xs font-bold text-[#145C32]">
                      Arrêt reçu
                    </span>
                  ) : a.photo ? (
                    <span className="rounded-full bg-[#E6EEFB] px-2.5 py-1 text-xs font-bold text-[#1D4E9E]">
                      Envoyé
                    </span>
                  ) : (
                    <span className="rounded-full bg-[#FFF1C2] px-2.5 py-1 text-xs font-bold text-[#6B4E00]">
                      Arrêt de travail à envoyer
                    </span>
                  )}
                </div>
                <div className="text-sm text-gris">
                  {jours} jour{jours > 1 ? 's' : ''}
                  {a.message && ` · ${a.message}`}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {a.photo && liens[a.photo] && (
                    <a href={liens[a.photo]} target="_blank" rel="noreferrer" className="text-sm font-bold">
                      Voir l'arrêt de travail
                    </a>
                  )}
                  {!a.recu_le && (
                    <label className="flex h-10 cursor-pointer items-center rounded-lg border border-[#C9CCD4] px-3 text-sm font-semibold hover:bg-fond">
                      {a.photo ? "Remplacer l'arrêt de travail" : "Ajouter l'arrêt de travail"}
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        className="sr-only"
                        onChange={(e) => void ajouterPhoto(a, e.target.files?.[0] ?? null)}
                      />
                    </label>
                  )}
                  {!a.recu_le && (
                    <button
                      type="button"
                      onClick={() => void retirer(a)}
                      className="ml-auto h-10 rounded-lg px-2 text-sm font-semibold text-[#9B1C1C] hover:bg-red-50"
                    >
                      Retirer
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {declarer && (
        <FenetreArret
          employeId={employeId}
          onFermer={() => setDeclarer(false)}
          onEnregistre={(texte) => {
            setDeclarer(false)
            setMessage({ type: 'ok', texte })
            void charger()
          }}
        />
      )}
    </div>
  )
}
