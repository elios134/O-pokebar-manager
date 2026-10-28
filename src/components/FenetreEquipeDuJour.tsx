import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { couleurDe, initiales } from '../lib/couleurs'
import { dateDuJour, heureLocale, jourLocal, jourSuivant } from '../lib/dates'
import { useEnLigne } from '../lib/horsLigne'
import { supabase } from '../lib/supabase'
import Fenetre from './Fenetre'

interface Present {
  employe_id: string
  prenom: string
  nom: string
  debut: string
  fin: string
}

const fmtJour = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

/** Jour précédent au format "2026-10-27". */
function jourPrecedent(jour: string) {
  const d = dateDuJour(jour)
  d.setDate(d.getDate() - 1)
  return jourLocal(d)
}

/** Qui de mon équipe travaille ce jour-là, avec les heures (jamais les autres équipes). */
export default function FenetreEquipeDuJour({ onFermer }: { onFermer: () => void }) {
  const { profil } = useAuth()
  const enLigne = useEnLigne()
  const [aujourdhui] = useState(() => jourLocal(new Date()))
  const [jour, setJour] = useState(aujourdhui)
  const [equipe, setEquipe] = useState<string | null>(null)
  const [resultat, setResultat] = useState<{ jour: string; presents: Present[] | null } | null>(null)

  useEffect(() => {
    if (!profil?.equipe_id) return
    void supabase
      .from('equipes')
      .select('nom')
      .eq('id', profil.equipe_id)
      .maybeSingle()
      .then(({ data }) => setEquipe(data?.nom ?? null))
  }, [profil?.equipe_id])

  useEffect(() => {
    if (!profil?.equipe_id || !enLigne) return
    let annule = false
    void supabase.rpc('equipe_du_jour', { p_jour: jour }).then(({ data, error }) => {
      if (!annule) setResultat({ jour, presents: error ? null : (data as Present[]) })
    })
    return () => {
      annule = true
    }
  }, [jour, profil?.equipe_id, enLigne])

  const presents = resultat?.jour === jour ? resultat.presents : undefined
  const titreJour =
    jour === aujourdhui ? "Aujourd'hui" : jour === jourSuivant(aujourdhui) ? 'Demain' : fmtJour.format(dateDuJour(jour))
  // Une couleur par personne, toujours la même dans la liste.
  const ordre = [...new Set((presents ?? []).map((p) => p.employe_id))]

  return (
    <Fenetre titre={equipe ? `Équipe ${equipe}` : 'Mon équipe'} onFermer={onFermer}>
      {!profil?.equipe_id ? (
        <p className="rounded-lg bg-fond px-3 py-3 text-sm text-gris">
          Vous n'êtes dans aucune équipe pour l'instant. Demandez à votre responsable de vous en attribuer une.
        </p>
      ) : (
        <>
          <div className="mb-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setJour(jourPrecedent(jour))}
              aria-label="Jour précédent"
              className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-[#C9CCD4] bg-white text-lg"
            >
              ‹
            </button>
            <div className="flex-1 text-center">
              <div className="font-extrabold first-letter:uppercase">{titreJour}</div>
              {jour !== aujourdhui && (
                <button
                  type="button"
                  onClick={() => setJour(aujourdhui)}
                  className="text-xs font-bold text-marque-fonce"
                >
                  Revenir à aujourd'hui
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setJour(jourSuivant(jour))}
              aria-label="Jour suivant"
              className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-[#C9CCD4] bg-white text-lg"
            >
              ›
            </button>
          </div>

          {!enLigne ? (
            <p className="rounded-lg bg-[#FFF1C2] px-3 py-3 text-sm text-[#6B4E00]">
              Pas de connexion internet : impossible de voir l'équipe pour le moment.
            </p>
          ) : presents === undefined ? (
            <p className="text-gris">Chargement…</p>
          ) : presents === null ? (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
              Impossible de charger l'équipe. Réessayez.
            </p>
          ) : presents.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[#C9CCD4] p-6 text-center text-gris">
              Personne de l'équipe ne travaille ce jour-là.
            </p>
          ) : (
            <ul className="flex flex-col gap-2" aria-label={`Équipe du jour : ${titreJour}`}>
              {presents.map((p, i) => {
                const c = couleurDe(ordre.indexOf(p.employe_id))
                const moi = p.employe_id === profil.id
                return (
                  <li
                    key={`${p.employe_id}-${i}`}
                    className={`flex items-center gap-3 rounded-xl border p-3 ${moi ? 'border-marque bg-marque-doux' : 'border-ligne'}`}
                  >
                    <span
                      className="flex size-10 shrink-0 items-center justify-center rounded-full text-[13px] font-bold"
                      style={{ background: c.fond, color: c.texte }}
                    >
                      {initiales(p.prenom, p.nom)}
                    </span>
                    <span className="mr-auto min-w-0 truncate font-bold">
                      {p.prenom} {p.nom}
                      {moi && <span className="font-medium text-gris"> (vous)</span>}
                    </span>
                    <span className="text-right">
                      <span className="block text-lg font-extrabold">{heureLocale(new Date(p.debut))}</span>
                      <span className="block text-xs text-gris">jusqu'à {heureLocale(new Date(p.fin))}</span>
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </Fenetre>
  )
}
