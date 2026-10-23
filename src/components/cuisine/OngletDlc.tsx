import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { CHAMPS_DLC, joursAvantDlc, reduirePhoto, type ProduitDlc } from '../../lib/cuisine'
import { dateDuJour, jourLocal } from '../../lib/dates'
import { supabase } from '../../lib/supabase'
import { signalerCuisineModifiee } from '../../lib/useAlertesCuisine'
import Fenetre, { boutonPrincipal, boutonSecondaire, champ, etiquette } from '../Fenetre'
import { IconePlus } from '../Icones'

const fmtDate = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
const date = (j: string) => fmtDate.format(dateDuJour(j))

function etiquetteDlc(jours: number) {
  if (jours < 0) return { texte: `Dépassée de ${-jours} j`, classe: 'bg-[#FDE2E2] text-[#9B1C1C]' }
  if (jours === 0) return { texte: "Aujourd'hui", classe: 'bg-[#FDE2E2] text-[#9B1C1C]' }
  if (jours === 1) return { texte: 'Demain', classe: 'bg-[#FFF1C2] text-[#6B4E00]' }
  return { texte: `Dans ${jours} j`, classe: 'bg-fond text-encre' }
}

/** DLC : liste des produits ouverts / entamés, triés par date limite, avec photo de l'étiquette. */
export default function OngletDlc() {
  const [produits, setProduits] = useState<ProduitDlc[] | null>(null)
  const [photos, setPhotos] = useState<Record<string, string>>({})
  const [ajout, setAjout] = useState(false)
  const [agrandie, setAgrandie] = useState<{ url: string; nom: string } | null>(null)
  const [message, setMessage] = useState<{ type: 'ok' | 'erreur'; texte: string } | null>(null)
  const [aujourdhui] = useState(() => jourLocal(new Date()))

  const charger = useCallback(
    () =>
      supabase
        .from('dlc_produits')
        .select(CHAMPS_DLC)
        .is('retire_le', null)
        .order('dlc')
        .then(async ({ data, error }) => {
          if (error) return setMessage({ type: 'erreur', texte: 'Impossible de charger les produits.' })
          const liste = data as ProduitDlc[]
          setProduits(liste)
          // Liens temporaires vers les photos (le stockage est privé).
          const chemins = liste.map((p) => p.photo).filter((x): x is string => !!x)
          if (!chemins.length) return
          const { data: liens } = await supabase.storage.from('dlc').createSignedUrls(chemins, 3600)
          setPhotos(Object.fromEntries((liens ?? []).filter((l) => l.signedUrl).map((l) => [l.path, l.signedUrl])))
        }),
    [],
  )

  useEffect(() => {
    void charger()
  }, [charger])

  async function retirer(p: ProduitDlc) {
    const { error } = await supabase.from('dlc_produits').update({ retire_le: new Date().toISOString() }).eq('id', p.id)
    setMessage(error ? { type: 'erreur', texte: 'Action impossible.' } : { type: 'ok', texte: `${p.nom} retiré de la liste.` })
    signalerCuisineModifiee()
    void charger()
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-sm text-gris">Produits ouverts ou entamés, du plus urgent au moins urgent.</p>
        <button
          type="button"
          onClick={() => setAjout(true)}
          className="flex h-11 items-center gap-2 rounded-xl bg-marque px-4 text-sm font-bold text-white hover:bg-marque-fonce"
        >
          <IconePlus />
          Ajouter un produit
        </button>
      </div>

      {message && (
        <p
          role={message.type === 'erreur' ? 'alert' : 'status'}
          className={`rounded-lg px-3 py-2 text-sm ${message.type === 'erreur' ? 'bg-red-50 text-red-800' : 'bg-[#DDF5E6] text-[#145C32]'}`}
        >
          {message.texte}
        </p>
      )}

      {produits === null ? (
        <p className="text-gris">Chargement…</p>
      ) : produits.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#C9CCD4] bg-white p-8 text-center text-gris">Aucun produit suivi pour le moment.</div>
      ) : (
        <ul className="grid gap-2 lg:grid-cols-2">
          {produits.map((p) => {
            const e = etiquetteDlc(joursAvantDlc(p.dlc, aujourdhui))
            const photo = p.photo ? photos[p.photo] : undefined
            return (
              <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-ligne bg-white p-3">
                {photo ? (
                  <button
                    type="button"
                    onClick={() => setAgrandie({ url: photo, nom: p.nom })}
                    aria-label={`Voir la photo de l'étiquette : ${p.nom}`}
                    className="size-14 shrink-0 overflow-hidden rounded-lg border border-ligne"
                  >
                    <img src={photo} alt="" className="size-full object-cover" />
                  </button>
                ) : (
                  <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-fond text-[11px] text-gris">Sans photo</span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">{p.nom}</div>
                  <div className="text-sm text-gris">
                    DLC {date(p.dlc)}
                    {p.ouvert_le && ` · ouvert ${date(p.ouvert_le)}`}
                  </div>
                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-bold ${e.classe}`}>{e.texte}</span>
                </div>
                <button
                  type="button"
                  onClick={() => void retirer(p)}
                  className="h-10 shrink-0 rounded-lg border border-[#C9CCD4] px-3 text-sm font-semibold hover:bg-fond"
                >
                  Utilisé / jeté
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {ajout && (
        <FenetreProduit
          onFermer={() => setAjout(false)}
          onAjoute={(nom) => {
            setAjout(false)
            setMessage({ type: 'ok', texte: `${nom} ajouté.` })
            signalerCuisineModifiee()
            void charger()
          }}
        />
      )}
      {agrandie && (
        <Fenetre titre={agrandie.nom} onFermer={() => setAgrandie(null)} large>
          <img src={agrandie.url} alt={`Étiquette : ${agrandie.nom}`} className="max-h-[70dvh] w-full rounded-xl object-contain" />
        </Fenetre>
      )}
    </div>
  )
}

function FenetreProduit({ onFermer, onAjoute }: { onFermer: () => void; onAjoute: (nom: string) => void }) {
  const [nom, setNom] = useState('')
  const [ouvert, setOuvert] = useState(() => jourLocal(new Date()))
  const [dlc, setDlc] = useState('')
  const [fichier, setFichier] = useState<File | null>(null)
  const [apercu, setApercu] = useState<string | null>(null)

  function choisirPhoto(f: File | null) {
    if (apercu) URL.revokeObjectURL(apercu)
    setFichier(f)
    setApercu(f ? URL.createObjectURL(f) : null)
  }
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)

  async function ajouter(e: FormEvent) {
    e.preventDefault()
    if (!nom.trim() || !dlc) return
    setEnvoi(true)
    setErreur(null)
    let photo: string | null = null
    if (fichier) {
      try {
        const image = await reduirePhoto(fichier)
        const chemin = `${jourLocal(new Date())}/${crypto.randomUUID()}.jpg`
        const { error } = await supabase.storage.from('dlc').upload(chemin, image, { contentType: 'image/jpeg' })
        if (error) throw error
        photo = chemin
      } catch {
        setEnvoi(false)
        return setErreur("La photo n'a pas pu être envoyée. Réessayez, ou enregistrez sans photo.")
      }
    }
    const { error } = await supabase.from('dlc_produits').insert({ nom: nom.trim(), ouvert_le: ouvert || null, dlc, photo })
    setEnvoi(false)
    if (error) return setErreur('Enregistrement impossible. Réessayez.')
    onAjoute(nom.trim())
  }

  return (
    <Fenetre titre="Ajouter un produit" onFermer={onFermer}>
      <form onSubmit={ajouter} className="flex flex-col gap-4">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#C9CCD4] bg-fond p-4 text-sm font-semibold text-marque-fonce">
          {apercu ? <img src={apercu} alt="Photo de l'étiquette" className="max-h-48 rounded-lg object-contain" /> : null}
          {apercu ? 'Changer la photo' : "Prendre en photo l'étiquette (facultatif)"}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => choisirPhoto(e.target.files?.[0] ?? null)}
          />
        </label>
        <label className={etiquette}>
          Produit
          <input required maxLength={80} placeholder="Ex. : crème fraîche" value={nom} onChange={(e) => setNom(e.target.value)} className={champ} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={etiquette}>
            Ouvert le
            <input type="date" value={ouvert} onChange={(e) => setOuvert(e.target.value)} className={champ} />
          </label>
          <label className={etiquette}>
            DLC
            <input type="date" required value={dlc} onChange={(e) => setDlc(e.target.value)} className={champ} />
          </label>
        </div>
        {erreur && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            {erreur}
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onFermer} className={boutonSecondaire}>
            Annuler
          </button>
          <button type="submit" disabled={envoi || !nom.trim() || !dlc} className={boutonPrincipal}>
            {envoi ? 'Enregistrement…' : 'Ajouter'}
          </button>
        </div>
      </form>
    </Fenetre>
  )
}
