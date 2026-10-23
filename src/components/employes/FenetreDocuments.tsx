import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { envoyerFichier, liensSignes } from '../../lib/fichiers'
import { CHAMPS_DOCUMENT, TYPES_DOCUMENT, texteMois, type DocumentEmploye, type TypeDocument } from '../../lib/rh'
import { supabase } from '../../lib/supabase'
import type { Profil } from '../../lib/types'
import ChoixFichier from '../ChoixFichier'
import Fenetre, { boutonPrincipal, champ, etiquette } from '../Fenetre'

const fmtDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })

/** Mois précédent au format "2026-09" (une fiche de paie concerne souvent le mois passé). */
function moisPrecedent() {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Admin : documents d'un employé (déposer, ouvrir, supprimer). */
export default function FenetreDocuments({ profil: p, onFermer }: { profil: Profil; onFermer: () => void }) {
  const [documents, setDocuments] = useState<DocumentEmploye[] | null>(null)
  const [liens, setLiens] = useState<Record<string, string>>({})
  const [fichier, setFichier] = useState<File | null>(null)
  const [type, setType] = useState<TypeDocument>('paie')
  const [mois, setMois] = useState(moisPrecedent)
  const [titre, setTitre] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)

  const charger = useCallback(
    () =>
      supabase
        .from('documents')
        .select(CHAMPS_DOCUMENT)
        .eq('employe_id', p.id)
        .order('cree_le', { ascending: false })
        .then(async ({ data }) => {
          const liste = (data ?? []) as DocumentEmploye[]
          setDocuments(liste)
          setLiens(
            await liensSignes(
              'documents',
              liste.map((d) => d.chemin),
            ),
          )
        }),
    [p.id],
  )

  useEffect(() => {
    void charger()
  }, [charger])

  const titreFinal =
    type === 'paie'
      ? mois
        ? `Fiche de paie · ${texteMois(`${mois}-01`)}`
        : ''
      : titre.trim() || (type === 'contrat' ? 'Contrat de travail' : '')

  async function envoyer(e: FormEvent) {
    e.preventDefault()
    if (!fichier || !titreFinal) return
    setEnvoi(true)
    setErreur(null)
    setOk(null)
    const r = await envoyerFichier('documents', p.id, fichier)
    if ('erreur' in r) {
      setEnvoi(false)
      return setErreur(r.erreur)
    }
    const { error } = await supabase.from('documents').insert({
      employe_id: p.id,
      type,
      titre: titreFinal,
      mois: type === 'paie' ? `${mois}-01` : null,
      chemin: r.chemin,
      taille: r.taille,
    })
    setEnvoi(false)
    if (error) {
      await supabase.storage.from('documents').remove([r.chemin])
      return setErreur('Enregistrement impossible. Réessayez.')
    }
    setFichier(null)
    setTitre('')
    setOk(`« ${titreFinal} » envoyé à ${p.prenom}.`)
    void charger()
  }

  async function supprimer(d: DocumentEmploye) {
    if (!window.confirm(`Supprimer « ${d.titre} » ?`)) return
    const { error } = await supabase.from('documents').delete().eq('id', d.id)
    if (error) return setErreur('Suppression impossible.')
    await supabase.storage.from('documents').remove([d.chemin])
    setOk('Document supprimé.')
    void charger()
  }

  return (
    <Fenetre titre={`Documents de ${p.prenom} ${p.nom}`} onFermer={onFermer}>
      <form onSubmit={envoyer} className="flex flex-col gap-3 rounded-xl border border-ligne bg-[#F8F9FB] p-3">
        <ChoixFichier
          fichier={fichier}
          onChoisir={setFichier}
          texte="Choisir un fichier"
          aide="PDF ou photo, 10 Mo maximum"
        />
        <div className="grid grid-cols-2 gap-3">
          <label className={etiquette}>
            Type
            <select value={type} onChange={(e) => setType(e.target.value as TypeDocument)} className={champ}>
              {TYPES_DOCUMENT.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.texte}
                </option>
              ))}
            </select>
          </label>
          {type === 'paie' ? (
            <label className={etiquette}>
              Mois
              <input type="month" required value={mois} onChange={(e) => setMois(e.target.value)} className={champ} />
            </label>
          ) : (
            <label className={etiquette}>
              Titre
              <input
                maxLength={120}
                placeholder={type === 'contrat' ? 'Contrat de travail' : 'Ex. : attestation'}
                value={titre}
                onChange={(e) => setTitre(e.target.value)}
                className={champ}
              />
            </label>
          )}
        </div>
        {erreur && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            {erreur}
          </p>
        )}
        {ok && (
          <p role="status" className="rounded-lg bg-[#DDF5E6] px-3 py-2 text-sm text-[#145C32]">
            {ok}
          </p>
        )}
        <button type="submit" disabled={envoi || !fichier || !titreFinal} className={boutonPrincipal}>
          {envoi ? 'Envoi…' : `Envoyer à ${p.prenom}`}
        </button>
      </form>

      <ul className="mt-3 flex flex-col text-sm">
        {documents === null && <li className="py-2 text-gris">Chargement…</li>}
        {documents?.length === 0 && <li className="py-2 text-gris">Aucun document pour l'instant.</li>}
        {documents?.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center gap-2 border-b border-ligne py-2 last:border-b-0">
            <span className="mr-auto min-w-0">
              <b>{d.titre}</b>
              <span className={`block text-xs ${d.vu_le ? 'font-semibold text-[#145C32]' : 'text-gris'}`}>
                {d.vu_le
                  ? `Vu le ${fmtDate.format(new Date(d.vu_le))}`
                  : `Envoyé le ${fmtDate.format(new Date(d.cree_le))} · pas encore ouvert`}
              </span>
            </span>
            {liens[d.chemin] && (
              <a href={liens[d.chemin]} target="_blank" rel="noreferrer" className="h-9 px-1 leading-9 font-bold">
                Ouvrir
              </a>
            )}
            <button
              type="button"
              onClick={() => void supprimer(d)}
              aria-label={`Supprimer ${d.titre}`}
              className="h-9 rounded-lg px-2 font-semibold text-[#9B1C1C] hover:bg-red-50"
            >
              Supprimer
            </button>
          </li>
        ))}
      </ul>
    </Fenetre>
  )
}
