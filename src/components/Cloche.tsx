import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Fenetre from './Fenetre'
import { IconeCloche } from './Icones'

interface Notification {
  id: string
  titre: string
  texte: string | null
  lien: string | null
  lue: boolean
  cree_le: string
}

const relatif = new Intl.RelativeTimeFormat('fr-FR', { numeric: 'auto' })
function ilYA(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return "à l'instant"
  if (s < 3600) return relatif.format(-Math.round(s / 60), 'minute')
  if (s < 86400) return relatif.format(-Math.round(s / 3600), 'hour')
  return relatif.format(-Math.round(s / 86400), 'day')
}

// Gardée entre deux pages : le compteur ne clignote pas à chaque changement de page.
let memoire: { moi: string; liste: Notification[] } | null = null

/** Cloche dans l'en-tête : nombre de notifications non lues et liste. */
export default function Cloche({ moi }: { moi: string }) {
  const [liste, setListeEtat] = useState<Notification[]>(() => (memoire?.moi === moi ? memoire.liste : []))
  const setListe = useCallback(
    (valeur: Notification[] | ((l: Notification[]) => Notification[])) =>
      setListeEtat((avant) => {
        const l = typeof valeur === 'function' ? valeur(avant) : valeur
        memoire = { moi, liste: l }
        return l
      }),
    [moi],
  )
  const [ouvert, setOuvert] = useState(false)
  const naviguer = useNavigate()

  const charger = useCallback(
    () =>
      supabase
        .from('notifications')
        .select('id, titre, texte, lien, lue, cree_le')
        .eq('destinataire_id', moi)
        .order('cree_le', { ascending: false })
        .limit(30)
        .then(({ data }) => setListe((data ?? []) as Notification[])),
    [moi, setListe],
  )

  useEffect(() => {
    void charger()
    const minuteur = window.setInterval(() => void charger(), 60_000)
    const recharger = () => void charger()
    window.addEventListener('focus', recharger)
    window.addEventListener('conges-modifies', recharger)
    window.addEventListener('acomptes-modifies', recharger)
    return () => {
      window.clearInterval(minuteur)
      window.removeEventListener('focus', recharger)
      window.removeEventListener('conges-modifies', recharger)
      window.removeEventListener('acomptes-modifies', recharger)
    }
  }, [charger])

  const nonLues = liste.filter((n) => !n.lue).length

  async function ouvrir(n: Notification) {
    if (!n.lue) {
      await supabase.from('notifications').update({ lue: true }).eq('id', n.id)
      setListe((l) => l.map((x) => (x.id === n.id ? { ...x, lue: true } : x)))
    }
    setOuvert(false)
    if (n.lien) naviguer(n.lien)
  }

  async function toutEffacer() {
    if (!window.confirm('Effacer toutes vos notifications ?')) return
    const { error } = await supabase.from('notifications').delete().eq('destinataire_id', moi)
    if (!error) setListe([])
  }

  async function toutLire() {
    await supabase.from('notifications').update({ lue: true }).eq('destinataire_id', moi).eq('lue', false)
    setListe((l) => l.map((x) => ({ ...x, lue: true })))
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        aria-label={nonLues ? `Notifications : ${nonLues} non lue${nonLues > 1 ? 's' : ''}` : 'Notifications'}
        className="relative flex size-10 items-center justify-center rounded-lg hover:bg-fond"
      >
        <IconeCloche width={22} height={22} />
        {nonLues > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] rounded-full bg-[#D6457E] px-1 text-center text-[11px] leading-[18px] font-bold text-white">
            {nonLues > 9 ? '9+' : nonLues}
          </span>
        )}
      </button>
      {ouvert && (
        <Fenetre titre="Notifications" onFermer={() => setOuvert(false)}>
          {liste.length === 0 ? (
            <p className="py-6 text-center text-gris">Aucune notification pour le moment.</p>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap gap-x-5 gap-y-2">
                {nonLues > 0 && (
                  <button
                    type="button"
                    onClick={() => void toutLire()}
                    className="text-sm font-semibold text-marque-fonce hover:underline"
                  >
                    Tout marquer comme lu
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void toutEffacer()}
                  className="ml-auto text-sm font-semibold text-[#9B1C1C] hover:underline"
                >
                  Tout effacer
                </button>
              </div>
              <ul className="-mx-2 flex flex-col">
                {liste.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => void ouvrir(n)}
                      className={`flex w-full gap-3 rounded-xl px-2 py-3 text-left hover:bg-fond ${n.lue ? '' : 'bg-marque-doux/60'}`}
                    >
                      <span
                        aria-hidden="true"
                        className={`mt-1.5 size-2 shrink-0 rounded-full ${n.lue ? 'bg-transparent' : 'bg-[#D6457E]'}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className={`block ${n.lue ? 'font-semibold' : 'font-bold'}`}>{n.titre}</span>
                        {n.texte && <span className="block text-sm text-gris">{n.texte}</span>}
                        <span className="block text-xs text-gris">{ilYA(n.cree_le)}</span>
                      </span>
                      {!n.lue && <span className="sr-only">(non lue)</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Fenetre>
      )}
    </>
  )
}
