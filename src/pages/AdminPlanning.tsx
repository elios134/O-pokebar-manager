import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type FullCalendar from '@fullcalendar/react'
import type {
  DateSelectArg,
  EventChangeArg,
  EventClickArg,
  EventInput,
  EventSourceFuncArg,
} from '@fullcalendar/core'
import Calendrier from '../components/Calendrier'
import FenetreHoraire, { type ValeursHoraire } from '../components/FenetreHoraire'
import Gabarit from '../components/Gabarit'
import { IconePlus } from '../components/Icones'
import { supabase } from '../lib/supabase'
import type { Horaire, Profil } from '../lib/types'
import { couleurDe, type Couleur } from '../lib/couleurs'
import { heureLocale, jourLocal } from '../lib/dates'

export default function AdminPlanning() {
  const calendrier = useRef<FullCalendar>(null)
  const [profils, setProfils] = useState<Profil[]>([])
  const [caches, setCaches] = useState<Set<string>>(new Set())
  const [fenetre, setFenetre] = useState<ValeursHoraire | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    void supabase
      .from('profiles')
      .select('id, nom, prenom, role, actif, email')
      .order('prenom')
      .then(({ data, error }) => {
        if (error) setErreur('Impossible de charger les employés.')
        else setProfils(data as Profil[])
      })
  }, [])

  const couleurs = useMemo(() => {
    const m = new Map<string, Couleur>()
    profils.forEach((p, i) => m.set(p.id, couleurDe(i)))
    return m
  }, [profils])

  // Les fonctions du calendrier lisent toujours les dernières valeurs via cette référence.
  const etat = useRef({ profils, couleurs, caches })
  useLayoutEffect(() => {
    etat.current = { profils, couleurs, caches }
  }, [profils, couleurs, caches])

  const chargerEvenements = useCallback(async (info: EventSourceFuncArg): Promise<EventInput[]> => {
    const { data, error } = await supabase
      .from('shifts')
      .select('id, employe_id, debut, fin, note')
      .lt('debut', info.endStr)
      .gt('fin', info.startStr)
      .order('debut')
    if (error) {
      setErreur('Impossible de charger le planning. Réessayez.')
      return []
    }
    setErreur(null)
    const { profils, couleurs, caches } = etat.current
    return (data as Horaire[])
      .filter((h) => !caches.has(h.employe_id))
      .map((h) => {
        const p = profils.find((x) => x.id === h.employe_id)
        const c = couleurs.get(h.employe_id) ?? couleurDe(0)
        const nom = p ? `${p.prenom} ${p.nom.charAt(0)}.` : 'Employé'
        return {
          id: h.id,
          title: h.note ? `${nom} · ${h.note}` : nom,
          start: h.debut,
          end: h.fin,
          backgroundColor: c.fond,
          borderColor: c.trait,
          textColor: c.texte,
          extendedProps: { horaire: h },
        }
      })
  }, [])

  const rafraichir = useCallback(() => calendrier.current?.getApi().refetchEvents(), [])

  // Recharge quand le filtre ou la liste des employés change.
  useEffect(() => {
    rafraichir()
  }, [caches, profils, rafraichir])

  function basculer(id: string) {
    setCaches((avant) => {
      const s = new Set(avant)
      if (s.has(id)) s.delete(id)
      else s.add(id)
      return s
    })
  }

  function nouveau(debut?: Date, fin?: Date) {
    const d = debut ?? new Date()
    setFenetre({
      employe_id: '',
      jour: jourLocal(d),
      debut: debut ? heureLocale(debut) : '09:00',
      fin: fin ? heureLocale(fin) : '17:00',
      note: '',
    })
  }

  function surSelection(info: DateSelectArg) {
    info.view.calendar.unselect()
    // Clic sur un jour entier (vue mois) : horaires par défaut.
    if (info.allDay) nouveau(info.start)
    else nouveau(info.start, info.end)
  }

  function surClic(info: EventClickArg) {
    const h = info.event.extendedProps.horaire as Horaire
    const d = new Date(h.debut)
    setFenetre({
      id: h.id,
      employe_id: h.employe_id,
      jour: jourLocal(d),
      debut: heureLocale(d),
      fin: heureLocale(new Date(h.fin)),
      note: h.note ?? '',
    })
  }

  // Glisser-déposer ou étirer un horaire
  async function surDeplacement(info: EventChangeArg) {
    const { error } = await supabase
      .from('shifts')
      .update({ debut: info.event.start!.toISOString(), fin: info.event.end!.toISOString() })
      .eq('id', info.event.id)
    if (error) {
      info.revert()
      setErreur("Déplacement impossible. L'horaire est revenu à sa place.")
    } else {
      rafraichir()
    }
  }

  const actifs = profils.filter((p) => p.actif)

  return (
    <Gabarit
      titre="Planning de l'équipe"
      actions={
        <button
          type="button"
          onClick={() => nouveau()}
          className="hidden h-11 items-center gap-2 rounded-xl bg-marque px-4 font-bold text-white hover:bg-marque-fonce sm:flex"
        >
          <IconePlus />
          Ajouter un horaire
        </button>
      }
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <aside className="lg:w-56 lg:shrink-0">
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:gap-1 lg:rounded-2xl lg:border lg:border-ligne lg:bg-white lg:p-3">
            <div className="hidden px-1.5 pb-2 text-[13px] font-bold text-gris lg:block">Filtrer par employé</div>
            {profils.map((p) => {
              const c = couleurs.get(p.id)!
              const visible = !caches.has(p.id)
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => basculer(p.id)}
                  aria-pressed={visible}
                  className={`flex h-11 shrink-0 items-center gap-2.5 rounded-full border px-3.5 text-sm font-semibold whitespace-nowrap lg:rounded-lg lg:border-0 lg:px-2 lg:hover:bg-fond ${
                    visible ? 'border-[#C9CCD4] bg-white' : 'border-ligne bg-fond text-gris lg:bg-transparent'
                  }`}
                >
                  <span
                    className="flex size-[18px] items-center justify-center rounded-[5px]"
                    style={visible ? { background: c.trait } : { border: '2px solid #9AA0AC' }}
                  >
                    {visible && (
                      <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12l5 5L20 7" />
                      </svg>
                    )}
                  </span>
                  {p.prenom} {p.nom}
                  {!p.actif && <span className="text-xs font-medium text-gris">(désactivé)</span>}
                </button>
              )
            })}
            {profils.length === 0 && !erreur && <p className="px-2 text-sm text-gris">Chargement…</p>}
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {erreur && (
            <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
              {erreur}
            </p>
          )}
          <Calendrier
            ref={calendrier}
            events={chargerEvenements}
            selectable
            selectMirror
            longPressDelay={400}
            select={surSelection}
            eventClick={surClic}
            editable
            eventDrop={surDeplacement}
            eventResize={surDeplacement}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => nouveau()}
        aria-label="Ajouter un horaire"
        className="fixed right-5 bottom-24 z-10 flex size-[60px] items-center justify-center rounded-2xl bg-marque text-white shadow-[0_8px_24px_rgba(67,56,202,0.35)] sm:hidden"
      >
        <IconePlus width={26} height={26} />
      </button>

      {fenetre && (
        <FenetreHoraire
          valeurs={fenetre}
          employes={actifs}
          onFermer={() => setFenetre(null)}
          onEnregistre={() => {
            setFenetre(null)
            rafraichir()
          }}
        />
      )}
    </Gabarit>
  )
}
