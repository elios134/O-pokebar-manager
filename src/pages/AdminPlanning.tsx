import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type FullCalendar from '@fullcalendar/react'
import type {
  DateSelectArg,
  EventChangeArg,
  EventClickArg,
  EventInput,
  EventSourceFuncArg,
} from '@fullcalendar/core'
import { useNavigate } from 'react-router-dom'
import Calendrier from '../components/Calendrier'
import FenetreHoraire, { type ValeursHoraire } from '../components/FenetreHoraire'
import FenetrePlanification from '../components/FenetrePlanification'
import FiltresPlanning from '../components/planning/FiltresPlanning'
import Gabarit from '../components/Gabarit'
import { IconePlus } from '../components/Icones'
import { supabase } from '../lib/supabase'
import { CHAMPS_CONGE, CHAMPS_PROFIL, CHAMPS_HORAIRE, type Conge, type Equipe, type Horaire, type Profil } from '../lib/types'
import { couleurDe, type Couleur } from '../lib/couleurs'
import { heureLocale, jourLocal, lienImpression } from '../lib/dates'
import { evenementsPlanning } from '../lib/evenements'

export default function AdminPlanning() {
  const calendrier = useRef<FullCalendar>(null)
  const [profils, setProfils] = useState<Profil[]>([])
  const [fenetre, setFenetre] = useState<ValeursHoraire | null>(null)
  const [planification, setPlanification] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [equipes, setEquipes] = useState<Equipe[]>([])
  const [equipe, setEquipe] = useState('')
  const [employe, setEmploye] = useState('')
  const naviguer = useNavigate()

  useEffect(() => {
    void Promise.all([
      supabase.from('profiles').select(CHAMPS_PROFIL).order('prenom'),
      supabase.from('equipes').select('id, nom').order('nom'),
    ]).then(([p, e]) => {
      if (p.error) setErreur('Impossible de charger les employés.')
      else setProfils(p.data as Profil[])
      setEquipes((e.data ?? []) as Equipe[])
    })
  }, [])

  const couleurs = useMemo(() => {
    const m = new Map<string, Couleur>()
    profils.forEach((p, i) => m.set(p.id, couleurDe(i)))
    return m
  }, [profils])

  // Les fonctions du calendrier lisent toujours les dernières valeurs via cette référence.
  const etat = useRef({ profils, couleurs, equipe, employe })
  useLayoutEffect(() => {
    etat.current = { profils, couleurs, equipe, employe }
  }, [profils, couleurs, equipe, employe])

  const chargerEvenements = useCallback(async (info: EventSourceFuncArg): Promise<EventInput[]> => {
    const [horaires, conges] = await Promise.all([
      supabase.from('shifts').select(CHAMPS_HORAIRE).lt('debut', info.endStr).gt('fin', info.startStr).order('debut'),
      supabase
        .from('conges')
        .select(CHAMPS_CONGE)
        .neq('statut', 'refuse')
        .lte('debut', jourLocal(info.end))
        .gte('fin', jourLocal(info.start)),
    ])
    if (horaires.error) {
      setErreur('Impossible de charger le planning. Réessayez.')
      return []
    }
    setErreur(null)
    const { profils, couleurs, equipe, employe } = etat.current
    return evenementsPlanning(horaires.data as Horaire[], (conges.data ?? []) as Conge[], profils, couleurs, {
      equipe,
      employe,
    })
  }, [])

  const rafraichir = useCallback(() => calendrier.current?.getApi().refetchEvents(), [])

  // Recharge quand le filtre ou la liste des employés change.
  useEffect(() => {
    rafraichir()
  }, [profils, equipe, employe, rafraichir])

  function nouveau(debut?: Date, fin?: Date) {
    const d = debut ?? new Date()
    setFenetre({
      employe_id: '',
      jour: jourLocal(d),
      debut: debut ? heureLocale(debut) : '09:00',
      fin: fin ? heureLocale(fin) : '17:00',
      pauseDebut: '',
      pauseFin: '',
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
    if (info.event.extendedProps.conge) return naviguer('/admin/conges')
    const h = info.event.extendedProps.horaire as Horaire
    const d = new Date(h.debut)
    setFenetre({
      id: h.id,
      employe_id: h.employe_id,
      jour: jourLocal(d),
      debut: heureLocale(d),
      fin: heureLocale(new Date(h.fin)),
      pauseDebut: h.pause_debut ? heureLocale(new Date(h.pause_debut)) : '',
      pauseFin: h.pause_fin ? heureLocale(new Date(h.pause_fin)) : '',
      note: h.note ?? '',
    })
  }

  // Glisser-déposer ou étirer un horaire : la pause suit le déplacement.
  async function surDeplacement(info: EventChangeArg) {
    const h = info.event.extendedProps.horaire as Horaire
    const decalage = info.event.start!.getTime() - info.oldEvent.start!.getTime()
    const decaler = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + decalage).toISOString() : null)
    const { error } = await supabase
      .from('shifts')
      .update({
        debut: info.event.start!.toISOString(),
        fin: info.event.end!.toISOString(),
        pause_debut: decaler(h.pause_debut),
        pause_fin: decaler(h.pause_fin),
      })
      .eq('id', info.event.id)
    if (error) {
      info.revert()
      setErreur(
        h.pause_debut
          ? "Modification impossible : la pause doit rester dans l'horaire. Ouvrez l'horaire pour la déplacer."
          : "Déplacement impossible. L'horaire est revenu à sa place.",
      )
    } else {
      rafraichir()
    }
  }

  const actifs = profils.filter((p) => p.actif)

  return (
    <Gabarit
      titre="Planning de l'équipe"
      actions={
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <button
            type="button"
            onClick={() =>
              naviguer(
                lienImpression(calendrier.current?.getApi().getDate() ?? new Date(), {
                  periode: calendrier.current?.getApi().view.type === 'dayGridMonth' ? 'mois' : 'semaine',
                  equipe: equipe || undefined,
                  employe: employe || undefined,
                }),
              )
            }
            className="flex h-11 items-center justify-center rounded-xl border border-[#C9CCD4] bg-white px-4 font-semibold hover:bg-fond"
          >
            Exporter en PDF
          </button>
          <button
            type="button"
            onClick={() => setPlanification(true)}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-marque bg-white px-4 font-bold text-marque-fonce hover:bg-marque-doux sm:flex-none"
          >
            <span className="sm:hidden">Plusieurs jours</span>
            <span className="hidden sm:inline">Planifier plusieurs jours</span>
          </button>
          <button
            type="button"
            onClick={() => nouveau()}
            className="hidden h-11 items-center gap-2 rounded-xl bg-marque px-4 font-bold text-white hover:bg-marque-fonce sm:flex"
          >
            <IconePlus />
            Ajouter un horaire
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <FiltresPlanning
          profils={profils}
          equipes={equipes}
          couleurs={couleurs}
          equipe={equipe}
          employe={employe}
          chargement={profils.length === 0 && !erreur}
          onEquipe={(id) => {
            setEquipe(id)
            setEmploye('')
          }}
          onEmploye={setEmploye}
        />

        <div className="min-w-0 flex-1">
          {erreur && (
            <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
              {erreur}
            </p>
          )}
          {info && (
            <p role="status" className="mb-3 rounded-lg bg-[#DDF5E6] px-3 py-2 text-sm text-[#145C32]">
              {info}
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
        className="fixed right-5 bottom-24 z-10 flex size-[60px] items-center justify-center rounded-2xl bg-marque text-white shadow-[0_8px_24px_rgba(194,69,59,0.35)] sm:hidden"
      >
        <IconePlus width={26} height={26} />
      </button>

      {planification && (
        <FenetrePlanification
          employes={actifs}
          onFermer={() => setPlanification(false)}
          onEnregistre={(n) => {
            setPlanification(false)
            setInfo(`${n} horaire${n > 1 ? 's' : ''} créé${n > 1 ? 's' : ''}.`)
            rafraichir()
          }}
        />
      )}

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
