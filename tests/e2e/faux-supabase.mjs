// Fausse base Supabase en mémoire, branchée sur les requêtes du navigateur.
import crypto from 'node:crypto'
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')

export function creerBase() {
  const lundi = new Date(); lundi.setHours(0,0,0,0); lundi.setDate(lundi.getDate() - ((lundi.getDay()+6)%7))
  const at = (jour, h) => { const d = new Date(lundi); d.setDate(d.getDate()+jour); d.setHours(h,0,0,0); return d.toISOString() }
  const jl = (jour) => { const d = new Date(lundi); d.setDate(d.getDate()+jour); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
  const db = {
    comptes: { 'admin@x.fr': 'A', 'lea@x.fr': 'L', 'karim@x.fr': 'K', 'off@x.fr': 'O', 'chef@x.fr': 'C' },
    profiles: [
      { id: 'A', prenom: 'Ana', nom: 'Dupont', role: 'admin', actif: true, email: 'admin@x.fr' },
      { id: 'L', prenom: 'Léa', nom: 'Martin', role: 'employe', actif: true, email: 'lea@x.fr' },
      { id: 'K', prenom: 'Karim', nom: 'Benali', role: 'employe', actif: true, email: 'karim@x.fr' },
      { id: 'O', prenom: 'Zoé', nom: 'Off', role: 'employe', actif: false, email: 'off@x.fr' },
      { id: 'C', prenom: 'Chloé', nom: 'Chef', role: 'cuisine', actif: true, email: 'chef@x.fr' },
    ],
    dlc_produits: [], frigos: [], releves_temperature: [], commandes: [], photos: {},
    arrets_maladie: [], conges_corrections: [], documents: [], checklists: [], checklist_taches: [], checklist_coches: [],
    fournisseurs: [], livraisons: [],
    shifts: [
      { id: 's1', employe_id: 'L', debut: at(0, 9), fin: at(0, 17), note: 'Ouverture', pause_minutes: 60, pause_debut: at(0, 12), pause_fin: at(0, 13), cree_le: at(0,0) },
      { id: 's2', pause_minutes: 0, pause_debut: null, pause_fin: null, employe_id: 'L', debut: at(3, 18), fin: at(4, 2), note: 'Fermeture', cree_le: at(0,0) },
      { id: 's3', pause_minutes: 0, pause_debut: null, pause_fin: null, employe_id: 'K', debut: at(1, 13), fin: at(1, 21), note: null, cree_le: at(0,0) },
      { id: 's4', pause_minutes: 0, pause_debut: null, pause_fin: null, employe_id: 'K', debut: at(9, 13), fin: at(9, 21), note: null, cree_le: at(0,0) },
    ],
    equipes: [{ id: 'EQ1', nom: 'Salle', cree_le: at(0, 0) }],
    conges: [
      { id: 'c1', employe_id: 'K', debut: jl(14), fin: jl(16), motif: 'Vacances', statut: 'en_attente', reponse: null, cree_le: at(0, 0), traite_le: null },
    ],
    appelsFonction: [],
    acomptes: [],
    modeles_horaires: [
      { id: 'm1', nom: 'Ouverture', code: 'O', couleur: 0, ordre: 1, creneaux: [{ debut: '10:00', fin: '15:00' }] },
      { id: 'm2', nom: 'Midi', code: 'M', couleur: 1, ordre: 2, creneaux: [{ debut: '11:30', fin: '15:30' }] },
      { id: 'm3', nom: 'Soir', code: 'S', couleur: 2, ordre: 3, creneaux: [{ debut: '18:00', fin: '23:00' }] },
      { id: 'm4', nom: 'Journée', code: 'J', couleur: 3, ordre: 4, creneaux: [{ debut: '10:00', fin: '18:00', pauseDebut: '14:00', pauseFin: '14:30' }] },
      { id: 'm5', nom: 'Coupure', code: 'C', couleur: 4, ordre: 5, creneaux: [{ debut: '11:00', fin: '15:00' }, { debut: '18:00', fin: '22:00' }] },
    ],
  }
  for (const p of db.profiles) p.equipe_id = p.id === 'L' ? 'EQ1' : null
  return db
}

function session(db, email) {
  const id = db.comptes[email]; const exp = Math.floor(Date.now()/1000) + 3600
  const jwt = `${b64({alg:'HS256',typ:'JWT'})}.${b64({sub:id,exp,role:'authenticated',email})}.sig`
  return { access_token: jwt, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'r',
    user: { id, email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' } }
}
function quiAppelle(req) {
  const t = (req.headers()['authorization'] || '').split(' ')[1] || ''
  try { return JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString()).sub } catch { return null }
}

function filtrer(lignes, params) {
  for (const [cle, val] of params) {
    if (['select', 'order', 'limit', 'offset', 'columns'].includes(cle)) continue
    if (cle === 'or') {
      const conds = val.replace(/^\(|\)$/g, '').split(',').map((c) => { const [col, op, ...r] = c.split('.'); return [col, op, r.join('.')] })
      lignes = lignes.filter((l) => conds.some(([col, op, v]) => tester(l[col], op, v)))
      continue
    }
    const [op, ...reste] = val.split('.'); const v = reste.join('.')
    lignes = lignes.filter((l) => tester(l[cle], op, v))
  }
  const ordre = params.get('order')
  if (ordre) { const c = ordre.split('.')[0]; lignes = [...lignes].sort((p, q) => String(p[c]).localeCompare(String(q[c]))) }
  if (params.get('limit')) lignes = lignes.slice(0, +params.get('limit'))
  return lignes
}
function tester(x, op, v) {
  if (op === 'eq') return String(x) === v
  if (op === 'neq') return String(x) !== v
  if (op === 'is') return v === 'null' ? x == null : String(x) === v
  const a = new Date(x).getTime(), b = new Date(v).getTime()
  if (op === 'lt') return a < b
  if (op === 'gt') return a > b
  if (op === 'gte') return a >= b
  if (op === 'lte') return a <= b
  throw new Error('op inconnue ' + op)
}

const TABLES_CUISINE = ['dlc_produits', 'frigos', 'releves_temperature', 'commandes', 'fournisseurs', 'livraisons']
const TABLES_CHECKLISTS = ['checklists', 'checklist_taches', 'checklist_coches']
const TABLES_RH = ['arrets_maladie', 'conges_corrections', 'documents']
const jourLocalMock = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Jours ouvrables (lundi au samedi) entre deux dates incluses.
function joursOuvrables(debut, fin) {
  let n = 0
  for (let d = new Date(`${debut}T12:00`); jourLocalMock(d) <= fin; d.setDate(d.getDate() + 1)) if (d.getDay() !== 0) n++
  return n
}

// Comme public.soldes_conges() : réservé à l'admin.
function soldes(db, uid) {
  const moi = db.profiles.find((p) => p.id === uid)
  const admin = moi?.role === 'admin' && moi.actif
  const auj = new Date()
  return db.profiles.filter(() => admin).map((p) => {
    const depuis = p.conges_depuis ?? jourLocalMock(auj)
    const [a, mo] = depuis.split('-').map(Number)
    const acquis = 2.5 * Math.max(0, auj.getFullYear() * 12 + auj.getMonth() + 1 - (a * 12 + mo))
    const pris = db.conges.filter((c) => c.employe_id === p.id && c.statut === 'accepte' && c.fin >= depuis)
      .reduce((t, c) => t + joursOuvrables(c.debut > depuis ? c.debut : depuis, c.fin), 0)
    const corrections = db.conges_corrections.filter((c) => c.employe_id === p.id).reduce((t, c) => t + Number(c.jours), 0)
    return { employe_id: p.id, depuis, acquis, pris, corrections, restant: acquis - pris + corrections }
  })
}

// La liste est-elle visible (réservée à la cuisine ou non) ?
function voitListe(db, moi, checklistId) {
  const l = db.checklists.find((x) => x.id === checklistId)
  return !!l && moi?.actif && (!l.cuisine_seulement || ['cuisine', 'admin'].includes(moi.role))
}
const IMAGE = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

// RLS simplifiée, comme en base
function visibles(db, table, uid) {
  const moi = db.profiles.find((p) => p.id === uid)
  const admin = moi?.role === 'admin' && moi.actif
  if (table === 'profiles') return admin ? db.profiles : db.profiles.filter((p) => p.id === uid)
  if (table === 'equipes') return db.equipes
  if (table === 'modeles_horaires') return admin ? db.modeles_horaires : []
  if (table === 'notifications') return (db.notifications ??= []).filter((n) => n.destinataire_id === uid)
  if (TABLES_CUISINE.includes(table)) return moi?.actif && ['cuisine', 'admin'].includes(moi.role) ? db[table] : []
  if (table === 'checklists') return db.checklists.filter((l) => voitListe(db, moi, l.id))
  if (table === 'checklist_taches') return db.checklist_taches.filter((t) => voitListe(db, moi, t.checklist_id))
  if (table === 'checklist_coches') return db.checklist_coches.filter((c) => voitListe(db, moi, db.checklist_taches.find((t) => t.id === c.tache_id)?.checklist_id))
  return admin ? db[table] : db[table].filter((s) => s.employe_id === uid && moi?.actif)
}

function calculerPause(l) {
  if (!!l.pause_debut !== !!l.pause_fin) return 'pause incomplète'
  if (l.pause_debut) {
    const pd = new Date(l.pause_debut), pf = new Date(l.pause_fin)
    if (pf <= pd || pd < new Date(l.debut) || pf > new Date(l.fin)) return 'pause_dans_le_service'
    l.pause_minutes = Math.round((pf - pd) / 60000)
  } else l.pause_minutes = 0
  return null
}

export async function brancher(page, db) {
  page.on('pageerror', (e) => console.log('ERREUR PAGE', e.message))
  await page.route('http://faux-supabase.test/**', async (route) => {
    const req = route.request(); const url = new URL(req.url()); const m = req.method()
    if (db.horsLigne) return route.abort('internetdisconnected')
    if (url.pathname === '/auth/v1/token') {
      if (url.searchParams.get('grant_type') === 'refresh_token' && db.dernierEmail) return route.fulfill({ json: session(db, db.dernierEmail) })
      const { email, password } = req.postDataJSON()
      if (db.comptes[email] && password === (db.motsDePasse?.[email] ?? 'secret')) { db.dernierEmail = email; return route.fulfill({ json: session(db, email) }) }
      return route.fulfill({ status: 400, json: { code: 'invalid_credentials', msg: 'Invalid login credentials', message: 'Invalid login credentials' } })
    }
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204, body: '' })
    if (url.pathname === '/auth/v1/recover') { db.recuperations = [...(db.recuperations ?? []), { ...req.postDataJSON(), redirect: url.searchParams.get('redirect_to') }]; return route.fulfill({ json: {} }) }
    if (url.pathname === '/auth/v1/user' && req.method() === 'PUT') {
      const uid0 = quiAppelle(req); const email = Object.keys(db.comptes).find((e) => db.comptes[e] === uid0)
      db.motsDePasse = { ...(db.motsDePasse ?? {}), [email]: req.postDataJSON().password }
      return route.fulfill({ json: { id: uid0, email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' } })
    }
    const uid = quiAppelle(req)

    if (url.pathname === '/functions/v1/gerer-employe') {
      if (m === 'OPTIONS') return route.fulfill({ status: 200, body: 'ok' })
      const corps = req.postDataJSON(); db.appelsFonction.push(corps)
      const moi = db.profiles.find((p) => p.id === uid)
      if (moi?.role !== 'admin') return route.fulfill({ status: 403, json: { erreur: 'Réservé aux administrateurs.' } })
      if (corps.action === 'creer') {
        if (db.comptes[corps.email]) return route.fulfill({ status: 400, json: { erreur: 'Un compte existe déjà avec cet email.' } })
        const id = crypto.randomUUID(); db.comptes[corps.email] = id
        db.profiles.push({ id, prenom: corps.prenom, nom: corps.nom, role: corps.role, actif: true, email: corps.email, equipe_id: corps.equipe_id ?? null })
        return route.fulfill({ json: { id } })
      }
      if (corps.action === 'email') {
        if (db.comptes[corps.email]) return route.fulfill({ status: 400, json: { erreur: 'Un compte existe déjà avec cet email.' } })
        const ancien = Object.keys(db.comptes).find((e) => db.comptes[e] === corps.id)
        delete db.comptes[ancien]; db.comptes[corps.email] = corps.id
        db.profiles.find((p) => p.id === corps.id).email = corps.email
        return route.fulfill({ json: { ok: true } })
      }
      if (corps.action === 'supprimer') {
        if (corps.id === uid) return route.fulfill({ status: 400, json: { erreur: 'Vous ne pouvez pas supprimer votre propre compte.' } })
        const email = Object.keys(db.comptes).find((e) => db.comptes[e] === corps.id); delete db.comptes[email]
        db.profiles = db.profiles.filter((p) => p.id !== corps.id)
        db.shifts = db.shifts.filter((x) => x.employe_id !== corps.id); db.conges = db.conges.filter((x) => x.employe_id !== corps.id)
        return route.fulfill({ json: { ok: true } })
      }
      if (corps.action === 'motdepasse') {
        const email = Object.keys(db.comptes).find((e) => db.comptes[e] === corps.id)
        db.motsDePasse = { ...(db.motsDePasse ?? {}), [email]: corps.motDePasse }
        return route.fulfill({ json: { ok: true } })
      }
      if (corps.action === 'creer' && corps.equipe_id) {
        if (db.comptes[corps.email]) return route.fulfill({ status: 400, json: { erreur: 'Un compte existe déjà avec cet email.' } })
        const id = crypto.randomUUID(); db.comptes[corps.email] = id
        db.profiles.push({ id, prenom: corps.prenom, nom: corps.nom, role: corps.role, actif: true, email: corps.email, equipe_id: corps.equipe_id })
        return route.fulfill({ json: { id } })
      }
      if (corps.action === 'statut') {
        if (corps.id === uid) return route.fulfill({ status: 400, json: { erreur: 'Vous ne pouvez pas désactiver votre propre compte.' } })
        db.profiles.find((p) => p.id === corps.id).actif = corps.actif
        return route.fulfill({ json: { ok: true } })
      }
    }

    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      const nom = url.pathname.replace('/rest/v1/rpc/', '')
      const a = req.postDataJSON() ?? {}
      const moi = db.profiles.find((p) => p.id === uid)
      const admin = moi?.role === 'admin' && moi.actif
      const err = (message) => route.fulfill({ status: 400, json: { code: 'P0001', message } })
      if (nom === 'enregistrer_abonnement_push') {
        if (!moi?.actif) return route.fulfill({ status: 403, json: { code: '42501', message: 'Non connecté.' } })
        db.abonnements = [...(db.abonnements ?? []).filter((x) => x.endpoint !== a.p_endpoint), { profil_id: uid, endpoint: a.p_endpoint, p256dh: a.p_p256dh, auth: a.p_auth }]
        return route.fulfill({ status: 204, body: '' })
      }
      if (nom === 'retirer_abonnement_push') {
        db.abonnements = (db.abonnements ?? []).filter((x) => !(x.endpoint === a.p_endpoint && x.profil_id === uid))
        return route.fulfill({ status: 204, body: '' })
      }
      if (nom === 'equipe_du_jour') {
        if (!moi?.actif || !moi.equipe_id) return route.fulfill({ json: [] })
        const membres = db.profiles.filter((p) => p.actif && p.equipe_id === moi.equipe_id)
        const lignes = db.shifts
          .filter((x) => membres.some((p) => p.id === x.employe_id) && jourLocalMock(new Date(x.debut)) === a.p_jour)
          .sort((x, y) => x.debut.localeCompare(y.debut))
          .map((x) => { const p = membres.find((q) => q.id === x.employe_id); return { employe_id: p.id, prenom: p.prenom, nom: p.nom, debut: x.debut, fin: x.fin } })
        return route.fulfill({ json: lignes })
      }
      if (nom === 'soldes_conges') return route.fulfill({ json: soldes(db, uid) })
      if (nom === 'noms_equipe') return route.fulfill({ json: moi?.actif ? db.profiles.map(({ id, prenom, nom: n }) => ({ id, prenom, nom: n })) : [] })
      if (nom === 'document_vu') {
        const d = db.documents.find((x) => x.id === a.p_id && x.employe_id === uid)
        if (d && !d.vu_le) d.vu_le = new Date().toISOString()
        return route.fulfill({ status: 204, body: '' })
      }
      if (nom === 'remplir_grille') {
        if (!admin) return route.fulfill({ status: 403, json: { code: '42501', message: 'Réservé aux administrateurs.' } })
        // Tout ou rien : on travaille sur une copie.
        const copie = db.shifts.map((s) => ({ ...s })); let n = 0
        for (const c of a.p_cases) {
          const de = new Date(c.de), fin = new Date(c.a)
          const anciens = copie.filter((s) => s.employe_id === c.employe_id && new Date(s.debut) >= de && new Date(s.debut) < fin)
            .sort((x, y) => new Date(x.debut) - new Date(y.debut))
          c.horaires.forEach((h0, i) => {
            const h = { ...h0, note: h0.note?.trim() || null }
            if (i < anciens.length) Object.assign(anciens[i], h)
            else copie.push({ id: crypto.randomUUID(), employe_id: c.employe_id, note: null, cree_le: new Date().toISOString(), ...h })
            n++
          })
          const enTrop = new Set(anciens.slice(c.horaires.length).map((s) => s.id))
          for (let i = copie.length - 1; i >= 0; i--) if (enTrop.has(copie[i].id)) copie.splice(i, 1)
        }
        for (const s of copie) {
          if (new Date(s.fin) <= new Date(s.debut)) return err('fin_apres_debut')
          const e2 = calculerPause(s); if (e2) return err(e2)
        }
        db.shifts = copie; db.appelsGrille = [...(db.appelsGrille ?? []), a.p_cases]
        return route.fulfill({ json: n })
      }
      console.log('RPC NON SIMULÉE', nom); return route.fulfill({ status: 404, json: {} })
    }
    if (url.pathname.startsWith('/storage/v1/')) {
      const moi = db.profiles.find((p) => p.id === uid)
      const admin = moi?.role === 'admin' && moi.actif
      const cuisine = moi?.actif && ['cuisine', 'admin'].includes(moi.role)
      if (url.pathname.startsWith('/storage/v1/object/public-lu/')) {
        const pdf = url.pathname.endsWith('.pdf')
        return route.fulfill({ status: 200, contentType: pdf ? 'application/pdf' : 'image/png', body: pdf ? '%PDF-1.4' : IMAGE })
      }
      // Droits par stockage, comme les règles de la base.
      const peut = (bucket, chemin, ecrire) => {
        if (bucket === 'dlc') return cuisine
        const sien = chemin.split('/')[0] === uid && moi?.actif
        if (bucket === 'arrets') return admin || sien
        if (bucket === 'documents') return admin || (!ecrire && sien)
        return false
      }
      const refus = () => route.fulfill({ status: 403, json: { statusCode: '403', error: 'Unauthorized', message: 'new row violates row-level security policy' } })
      const signe = url.pathname.match(/^\/storage\/v1\/object\/sign\/([^/]+)$/)
      if (signe) {
        const { paths } = req.postDataJSON()
        return route.fulfill({ json: paths.map((p) => {
          const ok = peut(signe[1], p, false) && `${signe[1]}/${p}` in db.photos
          return { path: p, error: ok ? null : 'Not found', signedURL: ok ? `/object/public-lu/${signe[1]}/${p}?token=t` : null }
        }) })
      }
      const objet = url.pathname.match(/^\/storage\/v1\/object\/([^/]+)\/(.+)$/)
      if (m === 'POST' && objet) {
        if (!peut(objet[1], objet[2], true)) return refus()
        db.photos[`${objet[1]}/${objet[2]}`] = req.postDataBuffer()?.length ?? 0
        return route.fulfill({ json: { Key: `${objet[1]}/${objet[2]}`, Id: crypto.randomUUID() } })
      }
      const seau = url.pathname.match(/^\/storage\/v1\/object\/([^/]+)$/)
      if (m === 'DELETE' && seau) {
        const { prefixes } = req.postDataJSON()
        const ok = prefixes.filter((p) => peut(seau[1], p, true))
        for (const p of ok) delete db.photos[`${seau[1]}/${p}`]
        return route.fulfill({ json: ok.map((name) => ({ name })) })
      }
      console.log('STOCKAGE NON SIMULÉ', m, url.pathname); return route.fulfill({ status: 404, json: {} })
    }
    const table = url.pathname.replace('/rest/v1/', '')
    if ((TABLES_CHECKLISTS.includes(table) || table === 'arrets_maladie') && m !== 'GET' && m !== 'HEAD') {
      const moi = db.profiles.find((p) => p.id === uid)
      const admin = moi?.role === 'admin' && moi.actif
      const refus = () => route.fulfill({ status: 403, json: { code: '42501', message: 'new row violates row-level security policy' } })
      const lignes = filtrer(visibles(db, table, uid), url.searchParams)
      const maintenant = new Date().toISOString()
      const aujourdhui = jourLocalMock(new Date())
      const representation = (req.headers()['prefer'] || '').includes('return=representation')
      const repondre = (l) => representation
        ? route.fulfill({ status: 201, json: (req.headers()['accept'] || '').includes('vnd.pgrst.object') ? l : [l] })
        : route.fulfill({ status: 201, body: '' })
      if (table === 'checklist_coches') {
        if (m === 'POST') {
          const l = req.postDataJSON()
          const t = db.checklist_taches.find((x) => x.id === l.tache_id)
          if (!t || !voitListe(db, moi, t.checklist_id)) return refus()
          if (db.checklist_coches.some((c) => c.tache_id === l.tache_id && c.jour === aujourdhui)) return route.fulfill({ status: 409, json: { code: '23505', message: 'duplicate key value violates unique constraint' } })
          const c = { id: crypto.randomUUID(), tache_id: l.tache_id, jour: aujourdhui, coche_par: uid, coche_le: maintenant }
          db.checklist_coches.push(c); return repondre(c)
        }
        if (m === 'DELETE') {
          const ids = new Set(lignes.filter((c) => admin || (c.coche_par === uid && c.jour === aujourdhui)).map((c) => c.id))
          db.checklist_coches = db.checklist_coches.filter((c) => !ids.has(c.id)); return route.fulfill({ status: 204, body: '' })
        }
        return refus()
      }
      if (table === 'arrets_maladie') {
        if (m === 'POST') {
          const l = { id: crypto.randomUUID(), message: null, photo: null, recu_le: null, ...req.postDataJSON(), saisi_par: uid, cree_le: maintenant }
          if (!admin && (l.employe_id !== uid || !moi?.actif)) return refus()
          if (!admin) l.recu_le = null
          db.arrets_maladie.push(l); return repondre(l)
        }
        if (m === 'PATCH') {
          const maj = req.postDataJSON()
          for (const l of lignes) Object.assign(l, admin ? maj : 'photo' in maj ? { photo: maj.photo } : {})
          return route.fulfill({ status: 204, body: '' })
        }
        if (m === 'DELETE') {
          const ids = new Set(lignes.filter((l) => admin || (l.employe_id === uid && !l.recu_le)).map((l) => l.id))
          db.arrets_maladie = db.arrets_maladie.filter((l) => !ids.has(l.id)); return route.fulfill({ status: 204, body: '' })
        }
      }
      if (!admin) return refus()
      if (m === 'POST') {
        const l = { id: crypto.randomUUID(), cree_le: maintenant, ...(table === 'checklists' ? { cuisine_seulement: false, jours: [1, 2, 3, 4, 5, 6, 7], ordre: 0 } : {}), ...(table === 'checklist_taches' ? { active: true, ordre: 0 } : {}), ...req.postDataJSON() }
        if (table === 'checklists' && db.checklists.some((x) => x.nom === l.nom)) return route.fulfill({ status: 409, json: { code: '23505', message: 'duplicate key value violates unique constraint' } })
        db[table].push(l); return repondre(l)
      }
      if (m === 'PATCH') { const maj = req.postDataJSON(); lignes.forEach((l) => Object.assign(l, maj)); return route.fulfill({ status: 204, body: '' }) }
      if (m === 'DELETE') {
        const ids = new Set(lignes.map((l) => l.id)); db[table] = db[table].filter((l) => !ids.has(l.id))
        if (table === 'checklists') db.checklist_taches = db.checklist_taches.filter((t) => !ids.has(t.checklist_id))
        return route.fulfill({ status: 204, body: '' })
      }
    }
    if (TABLES_CUISINE.includes(table) && m !== 'GET' && m !== 'HEAD') {
      const moi = db.profiles.find((p) => p.id === uid)
      const admin = moi?.role === 'admin' && moi.actif
      const cuisine = moi?.actif && ['cuisine', 'admin'].includes(moi.role)
      const refus = () => route.fulfill({ status: 403, json: { code: '42501', message: 'new row violates row-level security policy' } })
      const lignes = filtrer(visibles(db, table, uid), url.searchParams)
      const maintenant = new Date().toISOString()
      if (!cuisine || (table === 'frigos' && !admin) || (table === 'commandes' && m === 'PATCH' && !admin)
        || (['fournisseurs', 'livraisons'].includes(table) && m === 'DELETE' && !admin)) return refus()
      if (table === 'fournisseurs' && m === 'POST' && db.fournisseurs.some((f) => f.nom === req.postDataJSON().nom)) return route.fulfill({ status: 409, json: { code: '23505', message: 'duplicate key value violates unique constraint' } })
      if (m === 'POST') {
        const l = { id: crypto.randomUUID(), cree_le: maintenant, ...req.postDataJSON() }
        if (table === 'dlc_produits') Object.assign(l, { ajoute_par: uid, retire_le: null })
        if (table === 'commandes') { if (l.statut && l.statut !== 'a_commander') return refus(); Object.assign(l, { statut: 'a_commander', demande_par: uid, commande_le: null, recu_le: null, fournisseur_id: l.fournisseur_id ?? null }) }
        if (table === 'livraisons') {
          Object.assign(l, { recu_le: l.recu_le ?? maintenant, recu_par: uid, photo: l.photo ?? null, temperature: l.temperature ?? null, lot: l.lot ?? null, produits: l.produits ?? null })
          if (l.fournisseur_id) l.fournisseur = db.fournisseurs.find((f) => f.id === l.fournisseur_id)?.nom ?? l.fournisseur
          if (!l.conforme) (db.notifications ??= []).push(...db.profiles.filter((p) => p.role === 'admin').map((p) => ({ id: crypto.randomUUID(), destinataire_id: p.id, titre: 'Livraison non conforme', texte: l.fournisseur, lien: '/cuisine?onglet=livraisons', lue: false, cree_le: maintenant })))
        }
        if (table === 'releves_temperature') {
          if (db.releves_temperature.some((r) => r.frigo_id === l.frigo_id && r.jour === l.jour)) return route.fulfill({ status: 409, json: { code: '23505', message: 'duplicate key value violates unique constraint' } })
          Object.assign(l, { commentaire: null, releve_par: uid, releve_le: maintenant })
        }
        if (table === 'frigos' && !(l.temp_min < l.temp_max)) return route.fulfill({ status: 400, json: { code: '23514', message: 'check' } })
        db[table].push(l); return route.fulfill({ status: 201, body: '' })
      }
      if (m === 'PATCH') {
        const maj = req.postDataJSON()
        for (const l of lignes) {
          Object.assign(l, maj)
          if (table === 'releves_temperature') Object.assign(l, { releve_par: uid, releve_le: maintenant })
          if (table === 'commandes' && maj.statut === 'commande') l.commande_le ??= maintenant
          if (table === 'commandes' && maj.statut === 'recu') { l.commande_le ??= maintenant; l.recu_le = maintenant }
        }
        return route.fulfill({ status: 204, body: '' })
      }
      if (m === 'DELETE') {
        const ok = table === 'commandes' && !admin ? lignes.filter((l) => l.demande_par === uid && l.statut === 'a_commander') : lignes
        const ids = new Set(ok.map((l) => l.id)); db[table] = db[table].filter((l) => !ids.has(l.id))
        if (table === 'fournisseurs') {
          for (const x of db.livraisons) if (ids.has(x.fournisseur_id)) x.fournisseur_id = null
          for (const x of db.commandes) if (ids.has(x.fournisseur_id)) x.fournisseur_id = null
        }
        return route.fulfill({ status: 204, body: '' })
      }
    }
    if (!['profiles', 'shifts', 'equipes', 'conges', 'notifications', 'modeles_horaires', 'acomptes', ...TABLES_CUISINE, ...TABLES_CHECKLISTS, ...TABLES_RH].includes(table)) { console.log('NON SIMULÉ', m, url.pathname); return route.fulfill({ status: 404, json: {} }) }
    const lignes = filtrer(visibles(db, table, uid), url.searchParams)
    if (m === 'HEAD') return route.fulfill({ status: 200, headers: { 'content-range': `*/${lignes.length}`, 'access-control-expose-headers': 'content-range' }, body: '' })
    if (m === 'GET') {
      if ((req.headers()['accept'] || '').includes('vnd.pgrst.object')) {
        if (lignes.length === 0) return route.fulfill({ status: 406, json: { code: 'PGRST116', details: 'The result contains 0 rows', message: 'JSON object requested, multiple (or no) rows returned' } })
        return route.fulfill({ json: lignes[0] })
      }
      return route.fulfill({ json: lignes })
    }
    const moi = db.profiles.find((p) => p.id === uid)
    const admin = moi?.role === 'admin' && moi.actif
    const refus = () => route.fulfill({ status: 403, json: { code: '42501', message: 'new row violates row-level security policy' } })
    if (table === 'notifications') {
      if (m === 'DELETE') {
        const ids = new Set(lignes.map((l) => l.id)); db.notifications = db.notifications.filter((n) => !ids.has(n.id))
        return route.fulfill({ status: 204, body: '' })
      }
      if (m !== 'PATCH') return refus()
      const maj = req.postDataJSON(); if (Object.keys(maj).some((k) => k !== 'lue')) return refus()
      lignes.forEach((l) => Object.assign(l, maj)); return route.fulfill({ status: 204, body: '' })
    }
    // Congés : l'employé peut demander pour lui (en attente) et annuler sa demande en attente.
    if ((table === 'conges' || table === 'acomptes') && !admin) {
      if (m === 'POST') {
        const l = req.postDataJSON()
        if (l.employe_id !== uid || (l.statut && l.statut !== 'en_attente')) return refus()
        if (table === 'acomptes' && db.acomptes.some((x) => x.employe_id === uid && x.statut === 'en_attente')) {
          return route.fulfill({ status: 409, json: { code: '23505', message: 'duplicate key value violates unique constraint' } })
        }
        db[table].push({ id: crypto.randomUUID(), statut: 'en_attente', reponse: null, motif: null, cree_le: new Date().toISOString(), traite_le: null, ...l })
        return route.fulfill({ status: 201, body: '' })
      }
      if (m === 'DELETE') {
        const ids = new Set(lignes.filter((l) => l.statut === 'en_attente').map((l) => l.id)); db[table] = db[table].filter((l) => !ids.has(l.id))
        return route.fulfill({ status: 204, body: '' })
      }
      return route.fulfill({ status: 204, body: '' }) // update : 0 ligne
    }
    if (!admin) return refus()
    if (table === 'modeles_horaires' && m === 'POST' && db.modeles_horaires.some((x) => x.code === req.postDataJSON().code)) {
      return route.fulfill({ status: 409, json: { code: '23505', message: 'duplicate key value violates unique constraint' } })
    }
    if (table === 'equipes' && m === 'POST' && db.equipes.some((e) => e.nom === req.postDataJSON().nom)) {
      return route.fulfill({ status: 409, json: { code: '23505', message: 'duplicate key value violates unique constraint' } })
    }
    if (table === 'equipes' && m === 'DELETE') for (const p of db.profiles) if (lignes.some((l) => l.id === p.equipe_id)) p.equipe_id = null
    if ((table === 'conges' || table === 'acomptes') && m === 'PATCH') { const maj = req.postDataJSON(); if ('statut' in maj) maj.traite_le = maj.statut === 'en_attente' ? null : new Date().toISOString() }
    if (m === 'POST') {
      const nouv = [].concat(req.postDataJSON()).map((l) => ({ id: crypto.randomUUID(), cree_le: new Date().toISOString(), note: null, pause_minutes: 0, ...l }))
      if (table === 'shifts') for (const l of nouv) { const e = calculerPause(l); if (e) return route.fulfill({ status: 400, json: { code: '23514', message: e } }) }
      db[table].push(...nouv); return route.fulfill({ status: 201, body: '' })
    }
    if (m === 'PATCH') {
      const maj = req.postDataJSON()
      if (table === 'profiles' && lignes.some((l) => l.id === uid) && ('role' in maj || 'actif' in maj)) return route.fulfill({ status: 400, json: { code: 'P0001', message: 'Vous ne pouvez pas modifier votre propre rôle ou statut.' } })
      if (table === 'shifts') for (const l of lignes) { const e = calculerPause({ ...l, ...maj }); if (e) return route.fulfill({ status: 400, json: { code: '23514', message: e } }) }
      lignes.forEach((l) => { Object.assign(l, maj); if (table === 'shifts') calculerPause(l) }); return route.fulfill({ status: 204, body: '' })
    }
    if (m === 'DELETE') {
      const ids = new Set(lignes.map((l) => l.id)); db[table] = db[table].filter((l) => !ids.has(l.id))
      return route.fulfill({ status: 204, body: '' })
    }
  })
}
