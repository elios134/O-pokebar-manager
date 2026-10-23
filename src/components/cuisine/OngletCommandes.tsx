import { Fragment, useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  CHAMPS_COMMANDE,
  CHAMPS_FOURNISSEUR,
  type Commande,
  type Fournisseur,
  type Nom,
  type StatutCommande,
} from '../../lib/cuisine'
import { supabase } from '../../lib/supabase'
import { signalerCuisineModifiee } from '../../lib/useAlertesCuisine'
import { champ } from '../Fenetre'

const fmtDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })
const SECTIONS: { statut: StatutCommande; titre: string }[] = [
  { statut: 'a_commander', titre: 'À commander' },
  { statut: 'commande', titre: 'Commandé, en attente de livraison' },
  { statut: 'recu', titre: 'Reçu (7 derniers jours)' },
]

/** Produits à commander : la cuisine ajoute, l'admin coche « commandé » puis « reçu ». */
export default function OngletCommandes({ admin, moi, profils }: { admin: boolean; moi: string; profils: Nom[] }) {
  const [commandes, setCommandes] = useState<Commande[] | null>(null)
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])
  const [fournisseur, setFournisseur] = useState('')
  const [produit, setProduit] = useState('')
  const [quantite, setQuantite] = useState('')
  const [note, setNote] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'erreur'; texte: string } | null>(null)
  const [depuis] = useState(() => new Date(Date.now() - 7 * 86_400_000).toISOString())

  const charger = useCallback(
    () =>
      Promise.all([
        supabase.from('commandes').select(CHAMPS_COMMANDE).or(`statut.neq.recu,recu_le.gte.${depuis}`).order('cree_le'),
        supabase.from('fournisseurs').select(CHAMPS_FOURNISSEUR).order('nom'),
      ]).then(([c, f]) => {
        if (c.error) setMessage({ type: 'erreur', texte: 'Impossible de charger la liste.' })
        else setCommandes(c.data as Commande[])
        setFournisseurs((f.data ?? []) as Fournisseur[])
      }),
    [depuis],
  )

  useEffect(() => {
    void charger()
  }, [charger])

  async function ajouter(e: FormEvent) {
    e.preventDefault()
    if (!produit.trim()) return
    setEnvoi(true)
    const { error } = await supabase.from('commandes').insert({
      produit: produit.trim(),
      quantite: quantite.trim() || null,
      note: note.trim() || null,
      fournisseur_id: fournisseur || null,
    })
    setEnvoi(false)
    if (error) return setMessage({ type: 'erreur', texte: 'Ajout impossible. Réessayez.' })
    setMessage({
      type: 'ok',
      texte: `${produit.trim()} ajouté à la liste.${admin ? '' : ' Votre responsable est prévenu.'}`,
    })
    setProduit('')
    setQuantite('')
    setNote('')
    signalerCuisineModifiee()
    void charger()
  }

  async function changer(c: Commande, statut: StatutCommande) {
    const { error } = await supabase.from('commandes').update({ statut }).eq('id', c.id)
    if (error) setMessage({ type: 'erreur', texte: 'Action impossible.' })
    signalerCuisineModifiee()
    void charger()
  }

  async function retirer(c: Commande) {
    const { error } = await supabase.from('commandes').delete().eq('id', c.id)
    if (error) setMessage({ type: 'erreur', texte: 'Suppression impossible.' })
    signalerCuisineModifiee()
    void charger()
  }

  const nomDe = (id: string | null) => {
    const p = profils.find((x) => x.id === id)
    return p ? p.prenom : ''
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={ajouter}
        className={`grid gap-2 rounded-2xl border border-ligne bg-white p-4 sm:items-end ${fournisseurs.length ? 'sm:grid-cols-[2fr_1fr_2fr_2fr_auto]' : 'sm:grid-cols-[2fr_1fr_2fr_auto]'}`}
      >
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Produit
          <input
            required
            maxLength={120}
            placeholder="Ex. : saumon"
            value={produit}
            onChange={(e) => setProduit(e.target.value)}
            className={champ}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Quantité
          <input
            maxLength={40}
            placeholder="Ex. : 3 kg"
            value={quantite}
            onChange={(e) => setQuantite(e.target.value)}
            className={champ}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Note (facultatif)
          <input
            maxLength={200}
            placeholder="Ex. : marque habituelle"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={champ}
          />
        </label>
        {fournisseurs.length > 0 && (
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Fournisseur
            <select value={fournisseur} onChange={(e) => setFournisseur(e.target.value)} className={champ}>
              <option value="">Pas précisé</option>
              {fournisseurs.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nom}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          type="submit"
          disabled={envoi || !produit.trim()}
          className="h-12 rounded-xl bg-marque px-5 font-bold text-white hover:bg-marque-fonce disabled:opacity-50 sm:h-11"
        >
          Ajouter
        </button>
      </form>

      {message && (
        <p
          role={message.type === 'erreur' ? 'alert' : 'status'}
          className={`rounded-lg px-3 py-2 text-sm ${message.type === 'erreur' ? 'bg-red-50 text-red-800' : 'bg-[#DDF5E6] text-[#145C32]'}`}
        >
          {message.texte}
        </p>
      )}

      {commandes === null ? (
        <p className="text-gris">Chargement…</p>
      ) : (
        SECTIONS.map(({ statut, titre }) => {
          // « À commander » est rangé par fournisseur (ceux sans fournisseur à la fin).
          const nomF = (c: Commande) => fournisseurs.find((f) => f.id === c.fournisseur_id)?.nom ?? ''
          const liste = commandes
            .filter((c) => c.statut === statut)
            .sort((a, b) => (statut === 'a_commander' ? (nomF(a) || '~').localeCompare(nomF(b) || '~') : 0))
          if (statut !== 'a_commander' && !liste.length) return null
          return (
            <section key={statut} aria-label={titre}>
              <h2 className="mb-2 font-extrabold">
                {titre} <span className="font-semibold text-gris">({liste.length})</span>
              </h2>
              {liste.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-[#C9CCD4] bg-white p-5 text-center text-sm text-gris">
                  Rien à commander.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {liste.map((c, i) => (
                    <Fragment key={c.id}>
                      {statut === 'a_commander' &&
                        fournisseurs.length > 0 &&
                        (i === 0 || nomF(liste[i - 1]) !== nomF(c)) && (
                          <li className="mt-1 text-xs font-extrabold tracking-wide text-gris uppercase">
                            {nomF(c) || 'Sans fournisseur'}
                          </li>
                        )}
                      <li
                        className={`flex flex-wrap items-center gap-2 rounded-xl border border-ligne bg-white p-3 ${statut === 'recu' ? 'opacity-70' : ''}`}
                      >
                        <div className="mr-auto min-w-0">
                          <div className="font-bold">
                            {c.produit}
                            {c.quantite && <span className="font-semibold text-gris"> · {c.quantite}</span>}
                          </div>
                          <div className="text-xs text-gris">
                            {[
                              nomDe(c.demande_par) && `Demandé par ${nomDe(c.demande_par)}`,
                              fmtDate.format(new Date(c.cree_le)),
                              c.note,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </div>
                        </div>
                        {admin && statut === 'a_commander' && (
                          <button
                            type="button"
                            onClick={() => void changer(c, 'commande')}
                            className="h-10 rounded-lg bg-[#1F7A45] px-3 text-sm font-bold text-white hover:bg-[#145C32]"
                          >
                            Commandé
                          </button>
                        )}
                        {admin && statut === 'commande' && (
                          <button
                            type="button"
                            onClick={() => void changer(c, 'recu')}
                            className="h-10 rounded-lg bg-[#1F7A45] px-3 text-sm font-bold text-white hover:bg-[#145C32]"
                          >
                            Reçu
                          </button>
                        )}
                        {(admin || (statut === 'a_commander' && c.demande_par === moi)) && statut !== 'recu' && (
                          <button
                            type="button"
                            onClick={() => void retirer(c)}
                            aria-label={`Retirer ${c.produit}`}
                            className="h-10 rounded-lg px-2 text-sm font-semibold text-[#9B1C1C] hover:bg-red-50"
                          >
                            Retirer
                          </button>
                        )}
                      </li>
                    </Fragment>
                  ))}
                </ul>
              )}
            </section>
          )
        })
      )}
    </div>
  )
}
