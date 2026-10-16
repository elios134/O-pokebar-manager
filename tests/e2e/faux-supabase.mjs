// Fausse base Supabase en mémoire, branchée sur les requêtes du navigateur.
import crypto from 'node:crypto'
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')

export function creerBase() {
  const lundi = new Date(); lundi.setHours(0,0,0,0); lundi.setDate(lundi.getDate() - ((lundi.getDay()+6)%7))
  const at = (jour, h) => { const d = new Date(lundi); d.setDate(d.getDate()+jour); d.setHours(h,0,0,0); return d.toISOString() }
  const jl = (jour) => { const d = new Date(lundi); d.setDate(d.getDate()+jour); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
  const db = {
    comptes: { 'admin@x.fr': 'A', 'lea@x.fr': 'L', 'karim@x.fr': 'K', 'off@x.fr': 'O' },
    profiles: [
      { id: 'A', prenom: 'Ana', nom: 'Dupont', role: 'admin', actif: true, email: 'admin@x.fr' },
      { id: 'L', prenom: 'Léa', nom: 'Martin', role: 'employe', actif: true, email: 'lea@x.fr' },
      { id: 'K', prenom: 'Karim', nom: 'Benali', role: 'employe', actif: true, email: 'karim@x.fr' },
      { id: 'O', prenom: 'Zoé', nom: 'Off', role: 'employe', actif: false, email: 'off@x.fr' },
    ],
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
    const [op, ...reste] = val.split('.'); const v = reste.join('.')
    lignes = lignes.filter((l) => {
      const x = l[cle]
      if (op === 'eq') return String(x) === v
      if (op === 'neq') return String(x) !== v
      if (op === 'is') return v === 'null' ? x == null : String(x) === v
      const a = new Date(x).getTime(), b = new Date(v).getTime()
      if (op === 'lt') return a < b
      if (op === 'gt') return a > b
      if (op === 'gte') return a >= b
      if (op === 'lte') return a <= b
      throw new Error('op inconnue ' + op)
    })
  }
  const ordre = params.get('order')
  if (ordre) { const c = ordre.split('.')[0]; lignes = [...lignes].sort((p, q) => String(p[c]).localeCompare(String(q[c]))) }
  if (params.get('limit')) lignes = lignes.slice(0, +params.get('limit'))
  return lignes
}

// RLS simplifiée, comme en base
function visibles(db, table, uid) {
  const moi = db.profiles.find((p) => p.id === uid)
  const admin = moi?.role === 'admin' && moi.actif
  if (table === 'profiles') return admin ? db.profiles : db.profiles.filter((p) => p.id === uid)
  if (table === 'equipes') return db.equipes
  if (table === 'modeles_horaires') return admin ? db.modeles_horaires : []
  if (table === 'notifications') return (db.notifications ??= []).filter((n) => n.destinataire_id === uid)
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
    const table = url.pathname.replace('/rest/v1/', '')
    if (!['profiles', 'shifts', 'equipes', 'conges', 'notifications', 'modeles_horaires'].includes(table)) { console.log('NON SIMULÉ', m, url.pathname); return route.fulfill({ status: 404, json: {} }) }
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
      if (m !== 'PATCH') return refus()
      const maj = req.postDataJSON(); if (Object.keys(maj).some((k) => k !== 'lue')) return refus()
      lignes.forEach((l) => Object.assign(l, maj)); return route.fulfill({ status: 204, body: '' })
    }
    // Congés : l'employé peut demander pour lui (en attente) et annuler sa demande en attente.
    if (table === 'conges' && !admin) {
      if (m === 'POST') {
        const l = req.postDataJSON()
        if (l.employe_id !== uid || (l.statut && l.statut !== 'en_attente')) return refus()
        db.conges.push({ id: crypto.randomUUID(), statut: 'en_attente', reponse: null, motif: null, cree_le: new Date().toISOString(), traite_le: null, ...l })
        return route.fulfill({ status: 201, body: '' })
      }
      if (m === 'DELETE') {
        const ids = new Set(lignes.filter((l) => l.statut === 'en_attente').map((l) => l.id)); db.conges = db.conges.filter((l) => !ids.has(l.id))
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
    if (table === 'conges' && m === 'PATCH') { const maj = req.postDataJSON(); if ('statut' in maj) maj.traite_le = maj.statut === 'en_attente' ? null : new Date().toISOString() }
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
