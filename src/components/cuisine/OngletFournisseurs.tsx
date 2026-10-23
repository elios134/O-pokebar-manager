import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { CHAMPS_FOURNISSEUR, type Fournisseur } from '../../lib/cuisine'
import { supabase } from '../../lib/supabase'
import Fenetre, { boutonPrincipal, boutonSecondaire, champ, etiquette } from '../Fenetre'
import { IconePlus } from '../Icones'
import Message, { type TypeMessage } from '../Message'

const CHAMPS = ['contact', 'telephone', 'email', 'livraison', 'produits', 'note'] as const

/** Fournisseurs : la cuisine et l'admin les voient et les modifient ; seul l'admin supprime. */
export default function OngletFournisseurs({ admin }: { admin: boolean }) {
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[] | null>(null)
  const [aCommander, setACommander] = useState<Record<string, number>>({})
  const [edition, setEdition] = useState<Fournisseur | 'nouveau' | null>(null)
  const [message, setMessage] = useState<TypeMessage | null>(null)

  const charger = useCallback(
    () =>
      Promise.all([
        supabase.from('fournisseurs').select(CHAMPS_FOURNISSEUR).order('nom'),
        supabase.from('commandes').select('fournisseur_id').eq('statut', 'a_commander'),
      ]).then(([f, c]) => {
        if (f.error) return setMessage({ type: 'erreur', texte: 'Impossible de charger les fournisseurs.' })
        setFournisseurs(f.data as Fournisseur[])
        const n: Record<string, number> = {}
        for (const x of (c.data ?? []) as { fournisseur_id: string | null }[])
          if (x.fournisseur_id) n[x.fournisseur_id] = (n[x.fournisseur_id] ?? 0) + 1
        setACommander(n)
      }),
    [],
  )

  useEffect(() => {
    void charger()
  }, [charger])

  async function supprimer(f: Fournisseur) {
    if (!window.confirm(`Supprimer le fournisseur « ${f.nom} » ? Les livraisons passées gardent son nom.`)) return
    const { error } = await supabase.from('fournisseurs').delete().eq('id', f.id)
    setMessage(
      error ? { type: 'erreur', texte: 'Suppression impossible.' } : { type: 'ok', texte: `${f.nom} supprimé.` },
    )
    void charger()
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setEdition('nouveau')}
        className="flex h-11 w-fit items-center gap-2 rounded-xl bg-marque px-4 text-sm font-bold text-white hover:bg-marque-fonce"
      >
        <IconePlus />
        Ajouter un fournisseur
      </button>
      <Message message={message} />

      {fournisseurs === null ? (
        <p className="text-gris">Chargement…</p>
      ) : fournisseurs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#C9CCD4] bg-white p-8 text-center text-gris">
          Aucun fournisseur pour l'instant.
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {fournisseurs.map((f) => (
            <li key={f.id} className="flex flex-col gap-2 rounded-2xl border border-ligne bg-white p-4">
              <div className="flex items-baseline gap-2">
                <h2 className="mr-auto text-lg font-extrabold">{f.nom}</h2>
                {!!aCommander[f.id] && (
                  <span className="text-xs font-bold text-marque-fonce">{aCommander[f.id]} à commander</span>
                )}
              </div>
              {(f.produits || f.livraison) && (
                <p className="text-sm text-gris">
                  {[f.produits, f.livraison && `Livraison : ${f.livraison}`].filter(Boolean).join(' · ')}
                </p>
              )}
              {f.contact && <p className="text-sm text-gris">Contact : {f.contact}</p>}
              {f.note && <p className="rounded-lg bg-fond px-3 py-1.5 text-sm">{f.note}</p>}
              <div className="flex flex-wrap gap-2">
                {f.telephone && (
                  <a
                    href={`tel:${f.telephone.replace(/\s/g, '')}`}
                    className="flex h-11 flex-1 items-center justify-center rounded-lg bg-[#DDF5E6] px-3 text-sm font-bold text-[#145C32]"
                  >
                    Appeler {f.telephone}
                  </a>
                )}
                {f.email && (
                  <a
                    href={`mailto:${f.email}`}
                    className="flex h-11 flex-1 items-center justify-center rounded-lg border border-[#C9CCD4] px-3 text-sm font-bold text-encre"
                  >
                    Email
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setEdition(f)}
                  className="h-11 rounded-lg px-3 text-sm font-bold text-marque-fonce hover:bg-marque-doux"
                >
                  Modifier
                </button>
                {admin && (
                  <button
                    type="button"
                    onClick={() => void supprimer(f)}
                    aria-label={`Supprimer ${f.nom}`}
                    className="h-11 rounded-lg px-2 text-sm font-semibold text-[#9B1C1C] hover:bg-red-50"
                  >
                    Supprimer
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {edition && (
        <FenetreFournisseur
          fournisseur={edition === 'nouveau' ? null : edition}
          onFermer={() => setEdition(null)}
          onEnregistre={(texte) => {
            setEdition(null)
            setMessage({ type: 'ok', texte })
            void charger()
          }}
        />
      )}
    </div>
  )
}

function FenetreFournisseur({
  fournisseur: f,
  onFermer,
  onEnregistre,
}: {
  fournisseur: Fournisseur | null
  onFermer: () => void
  onEnregistre: (texte: string) => void
}) {
  const [nom, setNom] = useState(f?.nom ?? '')
  const [valeurs, setValeurs] = useState<Record<(typeof CHAMPS)[number], string>>(
    () => Object.fromEntries(CHAMPS.map((c) => [c, f?.[c] ?? ''])) as Record<(typeof CHAMPS)[number], string>,
  )
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const changer = (c: (typeof CHAMPS)[number], v: string) => setValeurs((x) => ({ ...x, [c]: v }))

  async function enregistrer(e: FormEvent) {
    e.preventDefault()
    if (!nom.trim()) return
    setEnvoi(true)
    const ligne = { nom: nom.trim(), ...Object.fromEntries(CHAMPS.map((c) => [c, valeurs[c].trim() || null])) }
    const { error } = f
      ? await supabase.from('fournisseurs').update(ligne).eq('id', f.id)
      : await supabase.from('fournisseurs').insert(ligne)
    setEnvoi(false)
    if (error)
      return setErreur(
        error.code === '23505' ? 'Un fournisseur porte déjà ce nom.' : 'Enregistrement impossible. Réessayez.',
      )
    onEnregistre(f ? `${nom.trim()} modifié.` : `${nom.trim()} ajouté.`)
  }

  const champTexte = (
    c: (typeof CHAMPS)[number],
    libelle: string,
    options: { placeholder?: string; type?: string; max: number },
  ) => (
    <label className={etiquette}>
      {libelle}
      <input
        type={options.type ?? 'text'}
        maxLength={options.max}
        placeholder={options.placeholder}
        value={valeurs[c]}
        onChange={(e) => changer(c, e.target.value)}
        className={champ}
      />
    </label>
  )

  return (
    <Fenetre titre={f ? `Modifier ${f.nom}` : 'Ajouter un fournisseur'} onFermer={onFermer}>
      <form onSubmit={enregistrer} className="flex flex-col gap-3">
        <label className={etiquette}>
          Nom
          <input
            required
            maxLength={80}
            placeholder="Ex. : Metro"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            className={champ}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          {champTexte('telephone', 'Téléphone', { type: 'tel', max: 30, placeholder: '01 23 45 67 89' })}
          {champTexte('email', 'Email', { type: 'email', max: 120 })}
        </div>
        {champTexte('contact', 'Contact', { max: 80, placeholder: 'Ex. : Julien (commercial)' })}
        {champTexte('livraison', 'Jours de livraison', {
          max: 120,
          placeholder: 'Ex. : mardi et vendredi, commander avant 14 h',
        })}
        {champTexte('produits', 'Produits', { max: 300, placeholder: 'Ex. : épicerie, boissons, emballages' })}
        {champTexte('note', 'Note', { max: 300 })}
        {erreur && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            {erreur}
          </p>
        )}
        <div className="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onFermer} className={boutonSecondaire}>
            Annuler
          </button>
          <button type="submit" disabled={envoi || !nom.trim()} className={boutonPrincipal}>
            {envoi ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </Fenetre>
  )
}
