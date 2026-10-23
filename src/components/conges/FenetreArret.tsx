import { useEffect, useState, type FormEvent } from 'react'
import { jourLocal, nbJours } from '../../lib/dates'
import { envoyerFichier } from '../../lib/fichiers'
import { compterHoraires, retirerHoraires } from '../../lib/horairesPeriode'
import { supabase } from '../../lib/supabase'
import type { Profil } from '../../lib/types'
import Fenetre, { boutonPrincipal, boutonSecondaire, champ, etiquette } from '../Fenetre'
import ChoixFichier from '../ChoixFichier'

/**
 * Déclarer un arrêt maladie. L'employé le fait pour lui (`employeId`) ; l'admin choisit l'employé
 * (`employes`), peut cocher « arrêt reçu » et retirer les horaires prévus.
 */
export default function FenetreArret({
  employeId,
  employes,
  onFermer,
  onEnregistre,
}: {
  employeId?: string
  employes?: Profil[]
  onFermer: () => void
  onEnregistre: (texte: string) => void
}) {
  const admin = !!employes
  const [employe, setEmploye] = useState(employeId ?? '')
  const [debut, setDebut] = useState(() => jourLocal(new Date()))
  const [fin, setFin] = useState(debut)
  const [message, setMessage] = useState('')
  const [fichier, setFichier] = useState<File | null>(null)
  const [recu, setRecu] = useState(false)
  const [horaires, setHoraires] = useState(0)
  const [retirer, setRetirer] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const datesValides = Boolean(debut && fin && fin >= debut)

  useEffect(() => {
    if (!admin || !employe || !datesValides) return
    let annule = false
    void compterHoraires(employe, debut, fin).then((n) => !annule && setHoraires(n))
    return () => {
      annule = true
    }
  }, [admin, employe, debut, fin, datesValides])

  async function enregistrer(e: FormEvent) {
    e.preventDefault()
    if (!employe || !datesValides) return
    setEnvoi(true)
    setErreur(null)
    let photo: string | null = null
    if (fichier) {
      const r = await envoyerFichier('arrets', employe, fichier)
      if ('erreur' in r) {
        setEnvoi(false)
        return setErreur(r.erreur)
      }
      photo = r.chemin
    }
    const { error } = await supabase.from('arrets_maladie').insert({
      employe_id: employe,
      debut,
      fin,
      message: message.trim() || null,
      photo,
      recu_le: admin && recu ? new Date().toISOString() : null,
    })
    if (error) {
      setEnvoi(false)
      return setErreur('Enregistrement impossible. Vérifiez les dates et réessayez.')
    }
    let retires = 0
    if (admin && retirer && horaires > 0 && (await retirerHoraires(employe, debut, fin))) retires = horaires
    setEnvoi(false)
    const p = employes?.find((x) => x.id === employe)
    onEnregistre(
      admin
        ? `Arrêt de ${p?.prenom ?? "l'employé"} enregistré${retires ? ` ; ${retires} horaire${retires > 1 ? 's' : ''} retiré${retires > 1 ? 's' : ''} du planning` : ''}.`
        : 'Arrêt envoyé. Votre responsable est prévenu.',
    )
  }

  const jours = datesValides ? nbJours(debut, fin) : 0
  return (
    <Fenetre titre={admin ? 'Saisir un arrêt maladie' : 'Déclarer un arrêt maladie'} onFermer={onFermer}>
      <form onSubmit={enregistrer} className="flex flex-col gap-4">
        {admin && (
          <label className={etiquette}>
            Employé
            <select required value={employe} onChange={(e) => setEmploye(e.target.value)} className={champ}>
              <option value="">Choisir un employé…</option>
              {employes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.prenom} {p.nom}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="grid grid-cols-2 gap-3">
          <label className={etiquette}>
            Du
            <input
              type="date"
              required
              value={debut}
              onChange={(e) => {
                setDebut(e.target.value)
                if (fin < e.target.value) setFin(e.target.value)
              }}
              className={champ}
            />
          </label>
          <label className={etiquette}>
            Au (inclus)
            <input
              type="date"
              required
              min={debut}
              value={fin}
              onChange={(e) => setFin(e.target.value)}
              className={champ}
            />
          </label>
        </div>
        {datesValides ? (
          <p className="-mt-2 text-[13px] text-gris">
            {jours} jour{jours > 1 ? 's' : ''}
          </p>
        ) : (
          <p className="-mt-2 text-[13px] font-semibold text-red-800">
            La date de fin doit être après la date de début.
          </p>
        )}
        <ChoixFichier
          fichier={fichier}
          onChoisir={setFichier}
          texte="Prendre en photo l'arrêt de travail"
          aide={admin ? 'Photo ou PDF, facultatif' : 'Facultatif maintenant, ajoutable plus tard'}
        />
        <label className={etiquette}>
          Message (facultatif)
          <input
            type="text"
            maxLength={300}
            placeholder={admin ? 'Ex. : appel de Karim ce matin' : "Ex. : je préviens dès que j'ai le papier"}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className={champ}
          />
        </label>
        {admin && (
          <label className="flex items-center gap-3 text-sm font-semibold">
            <input
              type="checkbox"
              checked={recu}
              onChange={(e) => setRecu(e.target.checked)}
              className="size-5 accent-marque"
            />
            Arrêt de travail déjà reçu
          </label>
        )}
        {admin && employe && datesValides && horaires > 0 && (
          <label className="flex items-start gap-3 rounded-lg bg-[#FFF1C2] px-3 py-2.5 text-sm text-[#6B4E00]">
            <input
              type="checkbox"
              checked={retirer}
              onChange={(e) => setRetirer(e.target.checked)}
              className="mt-0.5 size-5 accent-marque"
            />
            <span>
              {horaires} horaire{horaires > 1 ? 's' : ''} prévu{horaires > 1 ? 's' : ''} pendant l'arrêt.{' '}
              <b>Les retirer du planning</b>
            </span>
          </label>
        )}
        {!admin && (
          <p className="text-[13px] text-gris">Votre responsable est prévenu tout de suite. Lui seul voit la photo.</p>
        )}
        {erreur && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            {erreur}
          </p>
        )}
        <div className="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onFermer} className={boutonSecondaire}>
            Annuler
          </button>
          <button type="submit" disabled={envoi || !employe || !datesValides} className={boutonPrincipal}>
            {envoi ? 'Envoi…' : admin ? "Enregistrer l'arrêt" : 'Envoyer'}
          </button>
        </div>
      </form>
    </Fenetre>
  )
}
