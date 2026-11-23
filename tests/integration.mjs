/** Real HTTP integration tests. Run after `npm run build`; no real user database is opened. */
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const require = createRequire(import.meta.url);
const checks = [];
const skipped = [];
const legacyToken = randomBytes(32).toString('base64url');
const legacyPhotoId = randomUUID();
const interruption = new AbortController();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let temporaryDirectory;
let databaseDirectory;
let server;
let fixtureDatabase;
let base;
let serverLog = '';

function checkInterrupted() { if (interruption.signal.aborted) throw new Error('Integration tests interrupted.'); }
function interrupted() { interruption.abort(); }
process.once('SIGINT', interrupted);
process.once('SIGTERM', interrupted);

async function freePort() {
  const probe = createServer();
  await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', resolve); });
  const port = probe.address().port;
  await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
  return port;
}

async function stopServer() {
  const child = server;
  if (!child) return;
  if (child.exitCode !== null || child.signalCode !== null) { server = null; return; }
  const exited = once(child, 'exit').then(() => true);
  child.kill('SIGTERM');
  let timeout;
  const stopped = await Promise.race([exited, new Promise(resolve => { timeout = setTimeout(() => resolve(false), 5000); })]);
  clearTimeout(timeout);
  if (stopped) { server = null; return; }
  child.kill('SIGKILL');
  const killed = await Promise.race([exited, new Promise(resolve => { timeout = setTimeout(() => resolve(false), 5000); })]);
  clearTimeout(timeout);
  if (!killed) throw new Error(`Could not stop owned test server PID ${child.pid}; temporary files retained.`);
  server = null;
}

async function startServer(port) {
  checkInterrupted();
  base = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(port), '--keepAliveTimeout', '1000'], {
    cwd: root,
    env: { ...process.env, NODE_ENV: 'production', PORT: String(port), RUNWAY_DATA_DIR: databaseDirectory, NEXT_TELEMETRY_DISABLED: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let spawnError;
  server.on('error', error => { spawnError = error; });
  const collect = chunk => { serverLog = (serverLog + chunk.toString()).slice(-16_000); };
  server.stdout.on('data', collect);
  server.stderr.on('data', collect);
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    checkInterrupted();
    if (spawnError) throw spawnError;
    if (server.exitCode !== null || server.signalCode !== null) throw new Error(`Production server exited before readiness.\n${serverLog}`);
    try {
      const response = await fetch(`${base}/api/health/`, { signal: AbortSignal.any([interruption.signal, AbortSignal.timeout(1500)]) });
      if (response.ok && (await response.json()).ok === true && server.exitCode === null && server.signalCode === null && existsSync(path.join(databaseDirectory, 'runway.sqlite'))) return;
    } catch { /* bounded readiness polling during startup */ }
    await delay(200);
  }
  throw new Error(`Production server did not become ready.\n${serverLog}`);
}

function cleanupTemporaryDirectory() {
  if (!temporaryDirectory || !existsSync(temporaryDirectory)) return;
  // Only this exact mkdtemp child of the OS temp directory may be removed.
  const parent = realpathSync(tmpdir());
  const candidate = realpathSync(temporaryDirectory);
  if (lstatSync(temporaryDirectory).isSymbolicLink() || path.dirname(candidate) !== parent || !path.basename(candidate).startsWith('runway-integration-')) throw new Error('Refusing unsafe temporary-directory cleanup.');
  rmSync(candidate, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}

async function request(label, route, { method = 'GET', body, actor, origin = base, expected = 200, reviewVersion = true } = {}) {
  checkInterrupted();
  const headers = { Accept: 'application/json' };
  if (origin) headers.Origin = origin;
  if (actor?.cookie) headers.Cookie = actor.cookie;
  const reviewTarget = /^\/api\/admin\/applications\/([^/?]+)\/?$/.exec(route);
  if (reviewVersion && method === 'PATCH' && reviewTarget && body && typeof body === 'object' && !(body instanceof FormData) && !Object.hasOwn(body, 'expectedUpdatedAt')) {
    // Ordinary review tests make a decision after opening the latest queue.
    // Explicit stale/missing-version tests bypass this preparation. A denied
    // actor still reaches PATCH so its own authorization response is asserted.
    const queue = await fetch(`${base}/api/admin/applications/`, { headers, signal: AbortSignal.any([interruption.signal, AbortSignal.timeout(45_000)]) });
    if (queue.ok) {
      const application = (await queue.json()).applications?.find(item => item.id === reviewTarget[1]);
      if (application) body = { ...body, expectedUpdatedAt: application.updatedAt };
    }
  }
  if (body !== undefined && !(body instanceof FormData)) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(body); }
  const target = new URL(route, base);
  if (!target.pathname.endsWith('/')) target.pathname += '/';
  const response = await fetch(target, { method, body, headers, signal: AbortSignal.any([interruption.signal, AbortSignal.timeout(45_000)]) });
  const cookie = response.headers.getSetCookie?.()[0];
  if (cookie && actor) actor.cookie = cookie.split(';')[0];
  const contentType = response.headers.get('content-type') || '';
  let data;
  if (contentType.startsWith('image/')) data = Buffer.from(await response.arrayBuffer());
  else {
    const text = await response.text();
    try { data = JSON.parse(text); } catch { throw new Error(`${label}: expected JSON, received HTTP ${response.status}: ${text.slice(0, 300)}`); }
  }
  const allowed = Array.isArray(expected) ? expected : [expected];
  assert.ok(allowed.includes(response.status), `${label}: expected ${allowed.join('/')} but received ${response.status}: ${Buffer.isBuffer(data) ? 'image' : JSON.stringify(data).slice(0, 350)}`);
  checks.push(label);
  return { data, headers: response.headers, status: response.status };
}

async function requestHTML(label, route, expected = 200) {
  checkInterrupted();
  const target = new URL(route, base);
  if (!target.pathname.endsWith('/')) target.pathname += '/';
  const response = await fetch(target, { headers: { Accept: 'text/html' }, signal: AbortSignal.any([interruption.signal, AbortSignal.timeout(45_000)]) });
  const html = await response.text();
  assert.equal(response.status, expected, `${label}: expected HTTP ${expected}, received ${response.status}`);
  assert.match(response.headers.get('content-type') || '', /text\/html/i, `${label}: HTML content type`);
  assert.match(html, /<html\b/, `${label}: HTML document`);
  assert.match(html, /<body(?:\s|>)/, `${label}: document body`);
  if (expected === 200) {
    assert.match(html, /<html\b[^>]*\blang="ru"/, `${label}: Russian document`);
    assert.match(html, /<main\b/, `${label}: main content`);
    assert.match(html, /Runway Models/, `${label}: application metadata`);
  }
  assert.doesNotMatch(html, /Application error: a (?:server|client)-side exception has occurred|Internal Server Error/i, `${label}: no application exception`);
  checks.push(label);
  return html;
}

async function loadEditorialData() {
  // Data modules are pure TypeScript. Compile only these two into the disposable test directory.
  const ts = require('typescript');
  for (const name of ['events', 'courses', 'models']) {
    const source = readFileSync(path.join(root, 'src', 'data', `${name}.ts`), 'utf8');
    const emitted = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
      .replace(/from\s+["'](?:\.\/events(?:\.ts)?|@\/data\/events)["']/g, 'from "./events.mjs"');
    writeFileSync(path.join(temporaryDirectory, `${name}.mjs`), emitted);
  }
  const eventsModule = await import(pathToFileURL(path.join(temporaryDirectory, 'events.mjs')).href);
  const coursesModule = await import(pathToFileURL(path.join(temporaryDirectory, 'courses.mjs')).href);
  const modelsModule = await import(pathToFileURL(path.join(temporaryDirectory, 'models.mjs')).href);
  return { events: eventsModule.events, courses: coursesModule.courses, models: modelsModule.models, today: eventsModule.getToday() };
}

function noteSkip(label) { skipped.push(label); }

async function runSuite() {
  const sharp = require('sharp');
  const image = await sharp({ create: { width: 600, height: 800, channels: 3, background: '#bfbfbf' } }).jpeg().withExif({ IFD0: { Artist: 'Runway integration fixture' } }).toBuffer();
  const fixtureMetadata = await sharp(image).metadata();
  assert.ok(fixtureMetadata.exif, 'EXIF fixture must actually contain metadata.');
  const suffix = randomUUID();
  const password = `Runway-QA-${randomUUID()}`;
  const alice = { email: `alice-${suffix}@example.com`, cookie: '' };
  const bob = { email: `bob-${suffix}@example.com`, cookie: '' };
  const admin = { email: `admin-${suffix}@example.com`, cookie: '' };
  const moderator = { email: `moderator-${suffix}@example.com`, cookie: '' };
  const publicRoles = ['viewer', 'model', 'organizer', 'brand', 'agent'];
  const roleAccounts = publicRoles.map(role => ({ role, email: `${role}-${suffix}@example.com`, cookie: '' }));
  const { events, courses, models, today } = await loadEditorialData();
  const viewers = events.filter(event => event.type === 'Показ' && event.openToPublic && event.seats > 0 && event.status === 'Открыт набор' && event.date >= today && event.deadline >= today);
  const course = courses.find(item => item.date >= today);
  const past = events.find(event => event.date < today);
  const privateEvent = events.find(event => !event.openToPublic);
  const collaborationDate = new Date(`${today}T12:00:00Z`);
  collaborationDate.setUTCDate(collaborationDate.getUTCDate() + 30);

  function form(actor, overrides = {}, files = [image]) {
    const body = new FormData();
    const fields = { type: 'model', targetId: '', modelId: '', name: 'Тестовая Модель', email: actor.email, phone: '+7 700 123 45 67', city: 'Алматы', height: '180', age: '23', measurements: '90/65/92', description: 'Опыт дефиле и editorial-съёмок.', projectType: '', projectDate: '', consent: 'true', idempotencyKey: randomUUID(), ...overrides };
    for (const [key, value] of Object.entries(fields)) body.set(key, String(value));
    for (const [index, file] of files.entries()) body.append('photos', file instanceof File ? file : new File([file], `portrait-${index}.jpg`, { type: 'image/jpeg' }));
    return body;
  }
  function editForm(actor, application, overrides = {}, files = []) {
    const body = new FormData();
    const fields = {
      action: 'edit', expectedUpdatedAt: application.updatedAt,
      type: application.type, targetId: application.targetId || '', modelId: application.modelId || '',
      name: application.name, email: actor.email, phone: application.phone, city: application.city,
      height: application.height ?? '', age: application.age ?? '', measurements: application.measurements,
      description: application.description, projectType: application.projectType, projectDate: application.projectDate,
      consent: 'true', photoIds: JSON.stringify(application.photos.map(photo => photo.id)), ...overrides,
    };
    for (const [key, value] of Object.entries(fields)) body.set(key, String(value));
    for (const [index, file] of files.entries()) body.append('photos', file instanceof File ? file : new File([file], `edited-${index}.jpg`, { type: 'image/jpeg' }));
    return body;
  }

  async function editingChecks() {
    const owner = { email: `editor-${suffix}@example.com`, cookie: '' };
    const other = { email: `editor-other-${suffix}@example.com`, cookie: '' };
    for (const [actor, name] of [[owner, 'Редактор Анкеты'], [other, 'Другой Редактор']]) {
      actor.id = (await request(`register ${name}`, '/api/auth/register', {
        method: 'POST', actor, body: { name, email: actor.email, password, city: 'Алматы', consent: true }, expected: 201,
      })).data.user.id;
    }
    await request('guest cannot load saved application template', '/api/application-template?type=model', { expected: 401 });
    await request('unknown template type is rejected', '/api/application-template?type=admin', { actor: owner, expected: 422 });
    assert.equal((await request('new account has no application template', '/api/application-template?type=model', { actor: owner })).data.application, null);
    const originalKey = randomUUID();
    const original = (await request('create application for editing', '/api/applications', { method: 'POST', actor: owner, body: form(owner, { idempotencyKey: originalKey }), expected: 201 })).data.application;
    const otherApp = (await request('create isolated foreign photo fixture', '/api/applications', { method: 'POST', actor: other, body: form(other), expected: 201 })).data.application;
    assert.equal((await request('new submission becomes reusable template', '/api/application-template?type=model', { actor: owner })).data.application.id, original.id);
    assert.equal((await request('template type does not leak across form types', '/api/application-template?type=viewer', { actor: owner })).data.application, null);
    assert.equal((await request('other account receives only its own template', '/api/application-template?type=model', { actor: other })).data.application.id, otherApp.id);
    assert.equal((await request('template owner cannot be selected through query injection', `/api/application-template?type=model&userId=${other.id}`, { actor: owner })).data.application.userId, owner.id);
    await request('guest cannot edit an application', `/api/applications/${original.id}`, { method: 'PATCH', body: editForm(owner, original), expected: 401 });
    for (const [actor, label] of [[other, 'another user'], [admin, 'administrator'], [moderator, 'moderator']]) {
      await request(`${label} cannot edit another user's application`, `/api/applications/${original.id}`, { method: 'PATCH', actor, body: editForm(owner, original), expected: 404 });
    }
    const accepted = (await request('accept application before author correction', `/api/admin/applications/${original.id}`, { method: 'PATCH', actor: admin, body: { status: 'accepted', note: 'Первоначальное подтверждение.' } })).data.application;
    const corrections = { name: 'Исправленное Имя', city: 'Астана', phone: '+7 701 888 99 00', age: '24', height: '182', measurements: '92/66/94', description: 'Новый опыт подиума после редактирования.' };
    let current = (await request('owner edits accepted application and keeps its photo', `/api/applications/${accepted.id}`, { method: 'PATCH', actor: owner, body: editForm(owner, accepted, corrections) })).data.application;
    assert.equal(current.id, original.id); assert.equal(current.reference, original.reference); assert.equal(current.createdAt, original.createdAt);
    assert.ok(current.updatedAt > accepted.updatedAt);
    assert.equal(current.status, 'submitted'); assert.equal(current.adminNote, '');
    assert.equal(current.name, corrections.name); assert.equal(current.city, corrections.city); assert.equal(current.phone, corrections.phone);
    assert.equal(current.age, 24); assert.equal(current.height, 182); assert.equal(current.measurements, corrections.measurements); assert.equal(current.description, corrections.description);
    assert.equal(current.email, owner.email); assert.equal(current.userId, owner.id);
    assert.deepEqual(current.photos.map(photo => photo.id), original.photos.map(photo => photo.id));
    assert.equal(current.history.length, accepted.history.length + 1);
    assert.ok(current.history.some(item => item.status === 'accepted' && item.note === 'Первоначальное подтверждение.'));
    assert.equal(current.history.at(-1).status, 'submitted'); assert.ok(current.history.at(-1).note);
    await request('stale moderator decision cannot approve unseen author corrections', `/api/admin/applications/${current.id}`, {
      method: 'PATCH', actor: moderator, body: { status: 'accepted', note: 'Устаревшее подтверждение.', expectedUpdatedAt: accepted.updatedAt }, expected: 409,
    });
    await request('moderation requires the reviewed application version', `/api/admin/applications/${current.id}`, {
      method: 'PATCH', actor: moderator, body: { status: 'accepted', note: 'Решение без версии.' }, reviewVersion: false, expected: 409,
    });
    assert.deepEqual((await request('rejected stale reviews preserve author corrections', `/api/applications/${current.id}`, { actor: owner })).data.application, current);
    current = (await request('moderator may review the refreshed corrected application', `/api/admin/applications/${current.id}`, {
      method: 'PATCH', actor: moderator, body: { status: 'reviewing', note: 'Проверяем исправленную анкету.', expectedUpdatedAt: current.updatedAt },
    })).data.application;
    assert.equal(current.status, 'reviewing'); assert.equal(current.adminNote, 'Проверяем исправленную анкету.');
    const saved = (await request('edited data and photo become the saved template', '/api/application-template?type=model', { actor: owner })).data.application;
    assert.equal(saved.name, corrections.name); assert.equal(saved.phone, corrections.phone); assert.equal(saved.height, 182);
    assert.equal(saved.photos[0].id, original.photos[0].id);
    await request('stale application editor cannot overwrite a newer save', `/api/applications/${current.id}`, { method: 'PATCH', actor: owner, body: editForm(owner, accepted, { phone: '+77009998877' }), expected: 409 });
    const withoutVersion = editForm(owner, current); withoutVersion.delete('expectedUpdatedAt');
    await request('edit requires a version to avoid losing concurrent decisions', `/api/applications/${current.id}`, { method: 'PATCH', actor: owner, body: withoutVersion, expected: 409 });
    for (const [field, value] of [['type', 'collaboration'], ['targetId', 'another-event'], ['modelId', 'arman-kim'], ['email', other.email]]) {
      await request(`edit cannot change protected ${field}`, `/api/applications/${current.id}`, { method: 'PATCH', actor: owner, body: editForm(owner, current, { [field]: value }), expected: 422 });
    }
    await request('edit rejects status and ownership privilege injection', `/api/applications/${current.id}`, { method: 'PATCH', actor: owner, body: editForm(owner, current, { status: 'accepted', userId: other.id, adminNote: 'Поддельное решение', role: 'admin' }), expected: 422 });
    for (const [field, value] of [['phone', '-------'], ['age', '17'], ['height', '139'], ['measurements', '90/20/90'], ['consent', 'false']]) {
      await request(`edit validates ${field}`, `/api/applications/${current.id}`, { method: 'PATCH', actor: owner, body: editForm(owner, current, { [field]: value }), expected: 422 });
    }
    await request('editing a model cannot remove every photo', `/api/applications/${current.id}`, { method: 'PATCH', actor: owner, body: editForm(owner, current, { photoIds: '[]' }), expected: 422 });
    await request('editing cannot retain a foreign private photo', `/api/applications/${current.id}`, { method: 'PATCH', actor: owner, body: editForm(owner, current, { photoIds: JSON.stringify([otherApp.photos[0].id]) }), expected: [404, 422] });
    await request('retained and uploaded edit photos share the maximum count', `/api/applications/${current.id}`, { method: 'PATCH', actor: owner, body: editForm(owner, current, {}, [image, image, image]), expected: 422 });
    await request('invalid replacement photo cannot erase a saved photo', `/api/applications/${current.id}`, { method: 'PATCH', actor: owner, body: editForm(owner, current, { photoIds: '[]' }, [new File(['invalid image'], 'bad.jpg', { type: 'image/jpeg' })]), expected: 422 });
    const unchanged = (await request('failed edits preserve the complete saved application', `/api/applications/${current.id}`, { actor: owner })).data.application;
    assert.deepEqual(unchanged, current);
    assert.deepEqual((await request('failed edits do not replace the reusable template', '/api/application-template?type=model', { actor: owner })).data.application, current);
    assert.equal((await request('original create retry still returns the edited record', '/api/applications', { method: 'POST', actor: owner, body: form(owner, { idempotencyKey: originalKey }) })).data.application.id, original.id);

    const copiedKey = randomUUID();
    const copiedFields = { ...plainFields, type: 'collaboration', projectDate: collaborationDate.toISOString().slice(0, 10), projectType: 'Editorial', description: 'Новый проект с фотографией из своей сохранённой анкеты.', photoIds: JSON.stringify([current.photos[0].id]), idempotencyKey: copiedKey };
    const copied = (await request('new application reuses a saved photo without uploading it', '/api/applications', { method: 'POST', actor: owner, body: form(owner, copiedFields, []), expected: 201 })).data.application;
    assert.equal(copied.photos.length, 1); assert.notEqual(copied.photos[0].id, current.photos[0].id);
    const copiedImage = (await request('reused photo has independent private storage', copied.photos[0].url, { actor: owner })).data;
    assert.deepEqual(copiedImage, (await request('saved source photo is still readable', current.photos[0].url, { actor: owner })).data);
    assert.equal((await request('saved-photo create retry is idempotent', '/api/applications', { method: 'POST', actor: owner, body: form(owner, copiedFields, []) })).data.application.id, copied.id);
    await request('new application cannot reuse another account photo', '/api/applications', { method: 'POST', actor: owner, body: form(owner, { ...copiedFields, idempotencyKey: randomUUID(), photoIds: JSON.stringify([otherApp.photos[0].id]) }, []), expected: [404, 422] });
    await request('malformed saved-photo references are rejected', '/api/applications', { method: 'POST', actor: owner, body: form(owner, { ...copiedFields, idempotencyKey: randomUUID(), photoIds: '{broken' }, []), expected: 422 });

    current = (await request('reject corrected model before duplicate check', `/api/admin/applications/${current.id}`, { method: 'PATCH', actor: admin, body: { status: 'rejected', note: 'Нужен повторный отбор.' } })).data.application;
    const replacement = (await request('create another active model application', '/api/applications', { method: 'POST', actor: owner, body: form(owner), expected: 201 })).data.application;
    await request('editing rejected application cannot create active duplicate', `/api/applications/${current.id}`, { method: 'PATCH', actor: owner, body: editForm(owner, current, corrections), expected: 409 });
    const withdrawn = (await request('withdraw duplicate so original may be corrected', `/api/applications/${replacement.id}`, { method: 'PATCH', actor: owner, body: { action: 'withdraw' } })).data.application;
    await request('withdrawn application stays read-only', `/api/applications/${withdrawn.id}`, { method: 'PATCH', actor: owner, body: editForm(owner, withdrawn), expected: 409 });
    current = (await request('rejected application can be corrected once duplicate is withdrawn', `/api/applications/${current.id}`, { method: 'PATCH', actor: owner, body: editForm(owner, current, corrections) })).data.application;
    assert.equal(current.status, 'submitted'); assert.equal(current.adminNote, '');
    const removedPhoto = current.photos[0];
    current = (await request('owner replaces submitted application photograph', `/api/applications/${current.id}`, { method: 'PATCH', actor: owner, body: editForm(owner, current, { photoIds: '[]' }, [image]) })).data.application;
    assert.equal(current.photos.length, 1); assert.notEqual(current.photos[0].id, removedPhoto.id);
    await request('removed application photo is no longer accessible', removedPhoto.url, { actor: owner, expected: 404 });
    assert.deepEqual((await request('copied photo survives removal from the original application', copied.photos[0].url, { actor: owner })).data, copiedImage);
    assert.equal((await request('saved-photo retry survives deletion of its original source', '/api/applications', { method: 'POST', actor: owner, body: form(owner, copiedFields, []) })).data.application.id, copied.id);
    assert.equal((await request('updated saved template uses replacement photo', '/api/application-template?type=model', { actor: owner })).data.application.photos[0].id, current.photos[0].id);
    assert.equal((await request('collaboration template remains separate from corrected model', '/api/application-template?type=collaboration', { actor: owner })).data.application.id, copied.id);
    await request('cross-origin application edit is blocked', `/api/applications/${current.id}`, { method: 'PATCH', actor: owner, origin: 'http://other.invalid', body: editForm(owner, current), expected: 403 });

    const unavailable = events.find(item => item.status !== 'Открыт набор' || item.date < today || item.deadline < today);
    assert.ok(unavailable, 'editing regression fixture requires an unavailable editorial event');
    const fixtures = new DatabaseSync(path.join(databaseDirectory, 'runway.sqlite'));
    let closedId;
    let pastProjectId;
    try {
      const seed = fixtures.prepare('SELECT * FROM applications WHERE id=?').get(current.id);
      const insert = fields => {
        const row = { ...seed, id: randomUUID(), reference: `EDIT-${randomUUID()}`, idempotency_key: randomUUID(), ...fields };
        const columns = Object.keys(row);
        fixtures.prepare(`INSERT INTO applications(${columns.join(',')}) VALUES(${columns.map(() => '?').join(',')})`).run(...columns.map(column => row[column]));
        return row.id;
      };
      closedId = insert({ target_id: unavailable.id, dedupe_key: `model:${unavailable.id}` });
      pastProjectId = insert({ type: 'collaboration', target_id: null, project_date: '1900-01-01', project_type: 'Editorial', dedupe_key: `past-project:${suffix}` });
    } finally { fixtures.close(); }
    const closed = (await request('read closed-event application fixture', `/api/applications/${closedId}`, { actor: owner })).data.application;
    await request('closed or past event application cannot be edited', `/api/applications/${closed.id}`, { method: 'PATCH', actor: owner, body: editForm(owner, closed, {}, [image]), expected: 409 });
    const pastProject = (await request('read past collaboration fixture', `/api/applications/${pastProjectId}`, { actor: owner })).data.application;
    await request('past collaboration application cannot be edited', `/api/applications/${pastProject.id}`, { method: 'PATCH', actor: owner, body: editForm(owner, pastProject), expected: 409 });
    assert.equal((await request('blocked edits keep the existing reusable source', '/api/application-template?type=model', { actor: owner })).data.application.id, current.id);
    return { owner, other, current, otherApp, copied, copiedImage };
  }
  const plainFields = { height: '', age: '', measurements: '' };

  for (const route of ['/', '/models', '/events', '/shoots', '/casting', '/academy', '/backstage', '/contact', '/login', '/register', '/account', '/admin']) await requestHTML(`HTML route ${route}`, route);
  for (const model of models) await requestHTML(`HTML model ${model.id}`, `/models/${model.id}`);
  for (const event of events) await requestHTML(`HTML event ${event.id}`, `/events/${event.id}`);
  const cancelled = events.find(event => event.status === 'Отменено');
  if (cancelled) {
    const html = await requestHTML('closed viewer target explains closure before sign-in', `/casting?event=${cancelled.id}&role=viewer`);
    assert.match(html, /Событие отменено/);
    assert.doesNotMatch(html, /aria-label="Загрузка формы"/);
  }
  const openShow = events.find(event => event.type === 'Показ' && event.openToPublic && event.seats > 0
    && event.status === 'Открыт набор' && event.deadline >= today && event.date >= today);
  if (openShow) {
    const html = await requestHTML('viewer registration shows the selected show before sign-in', `/casting?event=${openShow.id}&role=viewer`);
    assert.ok(html.includes(`Запись зрителем на ${openShow.title}`));
    assert.ok(html.includes(openShow.venue));
    assert.doesNotMatch(html, /Для первого знакомства достаточно/);
  }

  await request('health', '/api/health');
  assert.equal((await request('guest account', '/api/auth/me')).data.user, null);
  await request('guest cannot list applications', '/api/applications', { expected: 401 });
  await request('cross-origin blocked', '/api/auth/register', { method: 'POST', origin: 'http://other.invalid', body: {}, expected: 403 });
  await request('missing Origin blocked', '/api/auth/register', { method: 'POST', origin: null, body: {}, expected: 403 });
  await request('invalid registration fields', '/api/auth/register', { method: 'POST', body: { name: ' ', email: 'broken', password: 'short', city: ' ', consent: false }, expected: 422 });
  for (const role of ['admin', 'moderator', 'unknown']) {
    const email = `forbidden-${role}-${suffix}@example.com`;
    await request(`registration rejects ${role} role`, '/api/auth/register', { method: 'POST', body: { name: 'Запрещённая Роль', email, password, city: 'Алматы', consent: true, role }, expected: 422 });
    await request(`rejected ${role} registration creates no account`, '/api/auth/login', { method: 'POST', body: { email, password }, expected: 401 });
  }
  for (const [actor, name] of [[alice, 'Алиса Тест'], [bob, 'Боб Тест'], [admin, 'Администратор Тест'], [moderator, 'Модератор Тест'], ...roleAccounts.map(actor => [actor, `Роль ${actor.role}`])]) {
    const { data, headers } = await request(`register ${name}`, '/api/auth/register', { method: 'POST', actor, body: { name, email: actor.email, password, city: 'Алматы', consent: true, ...(actor.role ? { role: actor.role } : {}) }, expected: 201 });
    actor.id = data.user.id;
    assert.equal(data.user.role, actor.role || 'viewer');
    assert.match(headers.get('set-cookie'), /HttpOnly/);
    assert.match(headers.get('set-cookie'), /SameSite=Lax/);
  }
  await request('case-insensitive duplicate registration', '/api/auth/register', { method: 'POST', body: { name: 'Тест Повтор', email: alice.email.toUpperCase(), password, city: 'Алматы', consent: true }, expected: 409 });
  await request('bad login credentials', '/api/auth/login', { method: 'POST', body: { email: alice.email, password: 'wrong-password' }, expected: 401 });
  assert.equal((await request('owner session', '/api/auth/me', { actor: alice })).data.user.id, alice.id);
  await request('member admin access blocked', '/api/admin/applications', { actor: alice, expected: 403 });
  await request('profile role injection ignored', '/api/profile', { method: 'PATCH', actor: alice, body: { name: 'Алиса Новый Профиль', city: 'Астана', role: 'admin' } });
  const profile = (await request('profile updated', '/api/auth/me', { actor: alice })).data.user;
  assert.equal(profile.role, 'viewer'); assert.equal(profile.name, 'Алиса Новый Профиль'); assert.equal(profile.city, 'Астана');
  const savedDetails = {
    phone: '+7 701 555 66 77', birthDate: '2000-11-13', height: 178,
    chest: 89, waist: 63, hips: 92, experience: 'Опыт подиума и съёмок',
  };
  const identity = { name: profile.name, city: profile.city };
  await request('profile details can be saved', '/api/profile', {
    method: 'PATCH', actor: alice, body: { ...identity, ...savedDetails },
  });
  const invalidDate = await request('future birth date is rejected', '/api/profile', {
    method: 'PATCH', actor: alice, body: { ...identity, birthDate: '9999-01-01' }, expected: 422,
  });
  assert.ok(invalidDate.data.fieldErrors.birthDate);
  const missingPassword = await request('changing login email requires current password', '/api/profile', {
    method: 'PATCH', actor: alice, body: { ...identity, email: `changed-${suffix}@example.com` }, expected: 422,
  });
  assert.ok(missingPassword.data.fieldErrors.currentPassword);
  await request('changing login email rejects duplicate account', '/api/profile', {
    method: 'PATCH', actor: alice, body: { ...identity, email: bob.email, currentPassword: password }, expected: 409,
  });
  const updatedEmail = `changed-${suffix}@example.com`;
  const updatedProfile = (await request('login email changes with current password', '/api/profile', {
    method: 'PATCH', actor: alice, body: { ...identity, email: updatedEmail.toUpperCase(), currentPassword: password },
  })).data.user;
  assert.equal(updatedProfile.email, updatedEmail);
  for (const [field, value] of Object.entries(savedDetails)) assert.equal(updatedProfile[field], value);
  await request('old email no longer signs in', '/api/auth/login', {
    method: 'POST', body: { email: alice.email, password }, expected: 401,
  });
  alice.email = updatedEmail;
  await request('photos required', '/api/applications', { method: 'POST', actor: alice, body: form(alice, {}, []), expected: 422 });
  await request('underage blocked', '/api/applications', { method: 'POST', actor: alice, body: form(alice, { age: '17' }), expected: 422 });
  await request('contact spoof blocked', '/api/applications', { method: 'POST', actor: alice, body: form(alice, { email: bob.email }), expected: 422 });
  await request('bad phone blocked', '/api/applications', { method: 'POST', actor: alice, body: form(alice, { phone: '-------' }), expected: 422 });
  await request('fake image rejected', '/api/applications', { method: 'POST', actor: alice, body: form(alice, {}, [new File(['<svg>script</svg>'], 'fake.jpg', { type: 'image/jpeg' })]), expected: 422 });
  await request('oversize image rejected', '/api/applications', { method: 'POST', actor: alice, body: form(alice, {}, [new File([Buffer.alloc(5 * 1024 * 1024 + 1)], 'big.jpg', { type: 'image/jpeg' })]), expected: 422 });
  await request('consent required', '/api/applications', { method: 'POST', actor: alice, body: form(alice, { consent: 'false' }), expected: 422 });
  const idempotencyKey = randomUUID();
  const app = (await request('valid model application', '/api/applications', { method: 'POST', actor: alice, body: form(alice, { idempotencyKey }), expected: 201 })).data.application;
  assert.equal(app.height, 180); assert.equal(app.age, 23); assert.equal(app.phone, '+7 700 123 45 67'); assert.equal(app.measurements, '90/65/92'); assert.equal(app.photos.length, 1); assert.equal(app.photos[0].type, 'image/jpeg'); assert.ok(app.reference);
  assert.equal((await request('idempotent retry', '/api/applications', { method: 'POST', actor: alice, body: form(alice, { idempotencyKey }) })).data.application.id, app.id);
  await request('idempotency payload conflict', '/api/applications', { method: 'POST', actor: alice, body: form(alice, { idempotencyKey, city: 'Астана' }), expected: 409 });
  await request('active duplicate blocked', '/api/applications', { method: 'POST', actor: alice, body: form(alice), expected: 409 });
  const privateImage = await request('own image visible', app.photos[0].url, { actor: alice });
  assert.ok(privateImage.data.length > 100); assert.match(privateImage.headers.get('cache-control'), /no-store/);
  assert.equal((await sharp(privateImage.data).metadata()).exif, undefined, 'Stored images must not retain EXIF.');
  await request('other user image blocked', app.photos[0].url, { actor: bob, expected: 404 });
  await request('guest image blocked', app.photos[0].url, { expected: 401 });
  await request('other user detail blocked', `/api/applications/${app.id}`, { actor: bob, expected: 404 });
  assert.equal((await request('other user applications isolated', '/api/applications', { actor: bob })).data.applications.length, 0);
  for (const actor of roleAccounts) {
    assert.equal((await request(`${actor.role} session retains selected role`, '/api/auth/me', { actor })).data.user.role, actor.role);
    const personal = (await request(`${actor.role} creates own application`, '/api/applications', { method: 'POST', actor, body: form(actor), expected: 201 })).data.application;
    actor.applicationId = personal.id;
    assert.equal(personal.userId, actor.id);
    assert.deepEqual((await request(`${actor.role} lists only personal data`, '/api/applications', { actor })).data.applications.map(item => item.id), [personal.id]);
    await request(`${actor.role} sees own photo`, personal.photos[0].url, { actor });
    await request(`${actor.role} cannot see another application`, `/api/applications/${app.id}`, { actor, expected: 404 });
    await request(`${actor.role} cannot see another photo`, app.photos[0].url, { actor, expected: 404 });
    await request(`${actor.role} has no global moderation access`, '/api/admin/applications', { actor, expected: 403 });
    await request(`${actor.role} cannot list users`, '/api/admin/users', { actor, expected: 403 });
    await request(`${actor.role} cannot grant staff access`, `/api/admin/users/${actor.id}`, { method: 'PATCH', actor, body: { role: 'moderator' }, expected: 403 });
    await request(`${actor.role} profile cannot change role`, '/api/profile', { method: 'PATCH', actor, body: { name: `Роль ${actor.role}`, city: 'Алматы', role: 'moderator' } });
    assert.equal((await request(`${actor.role} privilege injection has no effect`, '/api/auth/me', { actor })).data.user.role, actor.role);
  }
  if (privateEvent) await request('private event viewer blocked', '/api/applications', { method: 'POST', actor: alice, body: form(alice, { ...plainFields, type: 'viewer', targetId: privateEvent.id }, []), expected: 422 });
  else noteSkip('private-event fixture unavailable');
  if (past) await request('past event blocked', '/api/applications', { method: 'POST', actor: alice, body: form(alice, { targetId: past.id }), expected: 422 });
  else noteSkip('past-event fixture unavailable');
  if (viewers.length) await request('viewer booking', '/api/applications', { method: 'POST', actor: alice, body: form(alice, { ...plainFields, type: 'viewer', targetId: viewers[0].id }, []), expected: 201 });
  else noteSkip('future public show unavailable; positive viewer booking skipped');
  if (course) await request('course enrollment', '/api/applications', { method: 'POST', actor: alice, body: form(alice, { ...plainFields, type: 'course', targetId: course.id }, []), expected: 201 });
  else { noteSkip('future course unavailable; positive enrollment skipped'); if (courses.length) await request('past course enrollment blocked', '/api/applications', { method: 'POST', actor: alice, body: form(alice, { ...plainFields, type: 'course', targetId: courses[0].id }, []), expected: 422 }); }
  const brief = { ...plainFields, type: 'collaboration', modelId: 'arman-kim', projectDate: collaborationDate.toISOString().slice(0, 10), projectType: 'Editorial', description: 'Коммерческая editorial съёмка в студии, гонорар обсуждается.' };
  await request('collaboration request', '/api/applications', { method: 'POST', actor: alice, body: form(alice, brief, []), expected: 201 });
  await request('different collaboration brief same date', '/api/applications', { method: 'POST', actor: alice, body: form(alice, { ...brief, description: 'Другая съёмка lookbook в другой студии в тот же день.' }, []), expected: 201 });
  await request('favorites saved', '/api/favorites', { method: 'PUT', actor: alice, body: { ids: ['arman-kim', 'eva-sokolova'], expectedUserId: alice.id } });
  assert.deepEqual((await request('favorites persist', '/api/favorites', { actor: alice })).data.ids, ['arman-kim', 'eva-sokolova']);
  assert.deepEqual((await request('favorites isolated', '/api/favorites', { actor: bob })).data.ids, []);
  await request('stale-user favorite write blocked', '/api/favorites', { method: 'PUT', actor: bob, body: { ids: ['mark-ivanov'], expectedUserId: alice.id }, expected: 409 });
  assert.deepEqual((await request('stale favorite write changes nothing', '/api/favorites', { actor: bob })).data.ids, []);
  await request('unknown favorite blocked', '/api/favorites', { method: 'PUT', actor: alice, body: { ids: ['unknown-model'] }, expected: 422 });

  const promoted = spawnSync(process.execPath, [path.join(root, 'scripts', 'manage-admin.mjs'), '--email', admin.email], { cwd: root, env: { ...process.env, RUNWAY_DATA_DIR: databaseDirectory }, encoding: 'utf8' });
  assert.equal(promoted.status, 0, promoted.stderr || promoted.stdout);
  assert.equal((await request('admin CLI promotion', '/api/auth/me', { actor: admin })).data.user.role, 'admin');
  await request('admin list applications', '/api/admin/applications', { actor: admin });
  await request('admin private photo', app.photos[0].url, { actor: admin });
  await request('admin accepts application', `/api/admin/applications/${app.id}`, { method: 'PATCH', actor: admin, body: { status: 'accepted', note: 'Приглашаем на примерку.' } });
  const reviewed = (await request('owner sees review', '/api/applications', { actor: alice })).data.applications.find(item => item.id === app.id);
  assert.equal(reviewed.status, 'accepted'); assert.equal(reviewed.adminNote, 'Приглашаем на примерку.'); assert.ok(reviewed.history.length >= 2);
  await request('admin rejects original', `/api/admin/applications/${app.id}`, { method: 'PATCH', actor: admin, body: { status: 'rejected', note: 'Нужны новые фотографии.' } });
  const replacement = (await request('new model after rejection', '/api/applications', { method: 'POST', actor: alice, body: form(alice), expected: 201 })).data.application;
  await request('reactivation duplicate handled', `/api/admin/applications/${app.id}`, { method: 'PATCH', actor: admin, body: { status: 'accepted', note: 'Повторное решение' }, expected: 409 });
  await request('other user cannot withdraw', `/api/applications/${replacement.id}`, { method: 'PATCH', actor: bob, body: { action: 'withdraw' }, expected: 404 });
  assert.equal((await request('owner withdraws', `/api/applications/${replacement.id}`, { method: 'PATCH', actor: alice, body: { action: 'withdraw' } })).data.application.status, 'withdrawn');
  await request('withdrawn cannot be reviewed', `/api/admin/applications/${replacement.id}`, { method: 'PATCH', actor: admin, body: { status: 'accepted' }, expected: 409 });
  await request('member cannot assign role', `/api/admin/users/${bob.id}`, { method: 'PATCH', actor: alice, body: { role: 'admin' }, expected: 403 });
  await request('admin promotes team member', `/api/admin/users/${bob.id}`, { method: 'PATCH', actor: admin, body: { role: 'admin' } });
  await request('admin demotes team member', `/api/admin/users/${bob.id}`, { method: 'PATCH', actor: admin, body: { role: 'viewer' } });
  for (const role of [...publicRoles, 'moderator']) {
    await request(`last admin cannot be downgraded to ${role}`, `/api/admin/users/${admin.id}`, { method: 'PATCH', actor: admin, body: { role }, expected: 409 });
  }
  await request('admin rejects unknown role', `/api/admin/users/${bob.id}`, { method: 'PATCH', actor: admin, body: { role: 'unknown' }, expected: 422 });
  for (const role of [...publicRoles, 'moderator', 'admin']) {
    await request(`admin assigns ${role}`, `/api/admin/users/${bob.id}`, { method: 'PATCH', actor: admin, body: { role } });
    assert.equal((await request(`active session reflects ${role} assignment`, '/api/auth/me', { actor: bob })).data.user.role, role);
  }
  await request('admin returns test member to viewer', `/api/admin/users/${bob.id}`, { method: 'PATCH', actor: admin, body: { role: 'viewer' } });
  await request('admin appoints moderator', `/api/admin/users/${moderator.id}`, { method: 'PATCH', actor: admin, body: { role: 'moderator' } });
  assert.ok((await request('moderator lists global applications', '/api/admin/applications', { actor: moderator })).data.applications.some(item => item.id === app.id));
  await request('moderator sees review photo', app.photos[0].url, { actor: moderator });
  await request('moderator cannot list users', '/api/admin/users', { actor: moderator, expected: 403 });
  await request('moderator cannot change roles', `/api/admin/users/${bob.id}`, { method: 'PATCH', actor: moderator, body: { role: 'admin' }, expected: 403 });
  await request('moderator cannot promote self', `/api/admin/users/${moderator.id}`, { method: 'PATCH', actor: moderator, body: { role: 'admin' }, expected: 403 });
  await request('moderator can review', `/api/admin/applications/${app.id}`, { method: 'PATCH', actor: moderator, body: { status: 'rejected', note: 'Проверено модератором.' } });
  assert.equal((await request('owner sees moderator decision', `/api/applications/${app.id}`, { actor: alice })).data.application.adminNote, 'Проверено модератором.');
  await request('admin revokes moderator', `/api/admin/users/${moderator.id}`, { method: 'PATCH', actor: admin, body: { role: 'viewer' } });
  assert.equal((await request('existing session reflects moderator revocation', '/api/auth/me', { actor: moderator })).data.user.role, 'viewer');
  await request('revoked moderator cannot list applications', '/api/admin/applications', { actor: moderator, expected: 403 });
  await request('revoked moderator cannot review', `/api/admin/applications/${app.id}`, { method: 'PATCH', actor: moderator, body: { status: 'reviewing' }, expected: 403 });
  await request('revoked moderator cannot read private photo', app.photos[0].url, { actor: moderator, expected: 404 });
  await request('admin restores moderator for persistence check', `/api/admin/users/${moderator.id}`, { method: 'PATCH', actor: admin, body: { role: 'moderator' } });
  const editedPersistence = await editingChecks();

  for (const role of [...publicRoles, 'moderator', 'admin', 'viewer']) {
    const assigned = spawnSync(process.execPath, [path.join(root, 'scripts', 'manage-admin.mjs'), '--email', bob.email, '--role', role], { cwd: root, env: { ...process.env, RUNWAY_DATA_DIR: databaseDirectory }, encoding: 'utf8' });
    assert.equal(assigned.status, 0, assigned.stderr || assigned.stdout);
    assert.equal((await request(`CLI assigns ${role} to existing account`, '/api/auth/me', { actor: bob })).data.user.role, role);
  }
  for (const role of ['viewer', 'moderator']) {
    const protectedAdmin = spawnSync(process.execPath, [path.join(root, 'scripts', 'manage-admin.mjs'), '--email', admin.email, '--role', role], { cwd: root, env: { ...process.env, RUNWAY_DATA_DIR: databaseDirectory }, encoding: 'utf8' });
    assert.notEqual(protectedAdmin.status, 0, 'CLI must protect the last administrator.');
    assert.equal((await request(`CLI preserves last admin when assigning ${role}`, '/api/auth/me', { actor: admin })).data.user.role, 'admin');
  }
  await request('password changed', '/api/auth/password', { method: 'POST', actor: alice, body: { currentPassword: password, newPassword: `${password}-new` } });
  await request('password old rejected', '/api/auth/login', { method: 'POST', body: { email: alice.email, password }, expected: 401 });
  const oldCookie = alice.cookie;
  await request('logout', '/api/auth/logout', { method: 'POST', actor: alice, body: {} });
  assert.equal((await request('old session invalidated', '/api/auth/me', { actor: { cookie: oldCookie } })).data.user, null);
  await request('new password login', '/api/auth/login', { method: 'POST', actor: alice, body: { email: alice.email, password: `${password}-new` } });

  fixtureDatabase = new DatabaseSync(path.join(databaseDirectory, 'runway.sqlite'));
  fixtureDatabase.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000');
  const storedHash = fixtureDatabase.prepare('SELECT password_hash FROM users WHERE id=?').get(alice.id).password_hash;
  assert.match(storedHash, /^scrypt\$/); assert.notEqual(storedHash, password);
  const sessionHash = fixtureDatabase.prepare('SELECT token_hash FROM sessions WHERE user_id=?').get(alice.id).token_hash;
  assert.match(sessionHash, /^[a-f0-9]{64}$/); assert.notEqual(sessionHash, alice.cookie.split('=')[1]);
  checks.push('password and session tokens stored as hashes');

  if (viewers.length) {
    const capacityEvent = viewers[1] || viewers[0];
    const alreadyReserved = fixtureDatabase.prepare("SELECT COUNT(*) AS n FROM applications WHERE type='viewer' AND target_id=? AND status IN ('submitted','reviewing','accepted')").get(capacityEvent.id).n;
    const fixtures = [];
    const at = new Date().toISOString();
    for (let index = alreadyReserved; index < capacityEvent.seats; index++) {
      const userId = randomUUID(); const applicationId = randomUUID(); fixtures.push(applicationId);
      fixtureDatabase.prepare("INSERT INTO users(id,name,email,password_hash,city,role,created_at) VALUES(?,?,?,?,?,'viewer',?)").run(userId, 'Seat fixture', `seat-${index}-${suffix}@example.com`, 'fixture-no-login', 'Астана', at);
      fixtureDatabase.prepare("INSERT INTO applications(id,reference,user_id,type,title,target_id,status,name,email,phone,city,idempotency_key,dedupe_key,created_at,updated_at) VALUES(?,?,?,'viewer','Capacity fixture',?,'accepted',?,?,?,?,?,?,?,?)").run(applicationId, `SEAT-${suffix}-${index}`, userId, capacityEvent.id, 'Seat fixture', `seat-${index}-${suffix}@example.com`, '+77001234567', 'Астана', randomUUID(), `viewer:${capacityEvent.id}`, at, at);
    }
    assert.ok(fixtures.length, 'Capacity fixture needs at least one disposable reservation.');
    const waiting = (await request('full event waitlist', '/api/applications', { method: 'POST', actor: bob, body: form(bob, { ...plainFields, type: 'viewer', targetId: capacityEvent.id }, []), expected: 201 })).data.application;
    assert.equal(waiting.status, 'waiting');
    const editedWaiting = (await request('editing a full-show booking preserves the waitlist', `/api/applications/${waiting.id}`, { method: 'PATCH', actor: bob, body: editForm(bob, waiting, { phone: '+77005554433' }) })).data.application;
    assert.equal(editedWaiting.status, 'waiting'); assert.equal(editedWaiting.id, waiting.id);
    const rejectedWaiting = (await request('reject full-show booking before author correction', `/api/admin/applications/${waiting.id}`, { method: 'PATCH', actor: admin, body: { status: 'rejected', note: 'Уточните контактные данные.' } })).data.application;
    const resubmittedWaiting = (await request('editing rejected booking cannot oversell a full show', `/api/applications/${waiting.id}`, { method: 'PATCH', actor: bob, body: editForm(bob, rejectedWaiting, { phone: '+77005554422' }) })).data.application;
    assert.equal(resubmittedWaiting.status, 'waiting');
    await request('capacity oversell prevented', `/api/admin/applications/${waiting.id}`, { method: 'PATCH', actor: admin, body: { status: 'accepted' }, expected: 409 });
    fixtureDatabase.prepare('DELETE FROM applications WHERE id=?').run(fixtures[0]);
    await request('released seat accepted', `/api/admin/applications/${waiting.id}`, { method: 'PATCH', actor: admin, body: { status: 'accepted', note: 'Освободилось место.' } });
  } else noteSkip('future public show unavailable; capacity cases skipped');

  const sameKey = randomUUID();
  const same = await Promise.all([0, 1].map(index => request(`concurrent identical submission ${index + 1}`, '/api/applications', { method: 'POST', actor: bob, body: form(bob, { idempotencyKey: sameKey }), expected: [200, 201] })));
  assert.deepEqual(same.map(item => item.status).sort(), [200, 201]);
  assert.equal(same[0].data.application.id, same[1].data.application.id);
  assert.equal(fixtureDatabase.prepare('SELECT COUNT(*) AS n FROM applications WHERE user_id=? AND idempotency_key=?').get(bob.id, sameKey).n, 1);
  const conflictingKey = randomUUID();
  const conflicting = await Promise.all(['Алматы', 'Астана'].map((city, index) => request(`concurrent conflicting submission ${index + 1}`, '/api/applications', { method: 'POST', actor: admin, body: form(admin, { idempotencyKey: conflictingKey, city }), expected: [201, 409] })));
  assert.deepEqual(conflicting.map(item => item.status).sort(), [201, 409]);
  assert.equal(fixtureDatabase.prepare('SELECT COUNT(*) AS n FROM applications WHERE user_id=? AND idempotency_key=?').get(admin.id, conflictingKey).n, 1);
  fixtureDatabase.close(); fixtureDatabase = null;

  const cookieBeforeRestart = alice.cookie;
  const imageBeforeRestart = privateImage.data;
  const port = Number(new URL(base).port);
  await stopServer();
  await startServer(port);
  const editedAfterRestart = (await request('edited application and replacement photo survive restart', `/api/applications/${editedPersistence.current.id}`, { actor: editedPersistence.owner })).data.application;
  assert.deepEqual(editedAfterRestart, editedPersistence.current);
  assert.deepEqual((await request('saved application template survives restart', '/api/application-template?type=model', { actor: editedPersistence.owner })).data.application, editedPersistence.current);
  assert.equal((await request('template isolation survives restart', '/api/application-template?type=model', { actor: editedPersistence.other })).data.application.id, editedPersistence.otherApp.id);
  assert.deepEqual((await request('copied template photo survives restart independently', editedPersistence.copied.photos[0].url, { actor: editedPersistence.owner })).data, editedPersistence.copiedImage);
  const persistedUser = (await request('session survives server restart', '/api/auth/me', { actor: alice })).data.user;
  assert.equal(persistedUser.id, alice.id); assert.equal(persistedUser.name, 'Алиса Новый Профиль'); assert.equal(alice.cookie, cookieBeforeRestart);
  for (const [field, value] of Object.entries(savedDetails)) assert.equal(persistedUser[field], value);
  assert.equal(persistedUser.email, updatedEmail);
  const persisted = (await request('applications survive server restart', '/api/applications', { actor: alice })).data.applications;
  assert.equal(persisted.find(item => item.id === app.id).status, 'rejected');
  assert.equal(persisted.find(item => item.id === replacement.id).status, 'withdrawn');
  assert.deepEqual((await request('private photo survives server restart', app.photos[0].url, { actor: alice })).data, imageBeforeRestart);
  const persistedFavorites = (await request('favorites survive server restart', '/api/favorites', { actor: alice })).data;
  assert.equal(persistedFavorites.userId, alice.id); assert.deepEqual(persistedFavorites.ids, ['arman-kim', 'eva-sokolova']);
  assert.equal((await request('admin role survives server restart', '/api/auth/me', { actor: admin })).data.user.role, 'admin');
  await request('admin access survives server restart', '/api/admin/applications', { actor: admin });
  assert.equal((await request('moderator role survives server restart', '/api/auth/me', { actor: moderator })).data.user.role, 'moderator');
  await request('moderator access survives server restart', '/api/admin/applications', { actor: moderator });
  await request('moderator photo access survives server restart', app.photos[0].url, { actor: moderator });
  await request('moderator user restriction survives server restart', '/api/admin/users', { actor: moderator, expected: 403 });
  for (const actor of roleAccounts) {
    assert.equal((await request(`${actor.role} role survives server restart`, '/api/auth/me', { actor })).data.user.role, actor.role);
    assert.deepEqual((await request(`${actor.role} data stays personal after restart`, '/api/applications', { actor })).data.applications.map(item => item.id), [actor.applicationId]);
    await request(`${actor.role} still cannot view private photo after restart`, app.photos[0].url, { actor, expected: 404 });
  }
  const adminUsers = (await request('private profile details stay out of admin user list', '/api/admin/users', { actor: admin })).data.users;
  const adminViewOfAlice = adminUsers.find(person => person.id === alice.id);
  assert.ok(adminViewOfAlice);
  for (const field of Object.keys(savedDetails)) assert.equal(Object.hasOwn(adminViewOfAlice, field), false);
  await request('cross-user image isolation after restart', app.photos[0].url, { actor: bob, expected: 404 });
  await requestHTML('unknown model returns404', '/models/integration-unknown-model', 404);
  await requestHTML('unknown event returns404', '/events/integration-unknown-event', 404);
  await requestHTML('unknown page returns404', '/integration-unknown-page', 404);

}

try {
  assert.ok(Number(process.versions.node.split('.')[0]) >= 24, 'Node.js 24+ is required.');
  assert.ok(existsSync(path.join(root, '.next', 'BUILD_ID')), 'Production build missing. Run npm run build before npm run test:integration.');
  temporaryDirectory = mkdtempSync(path.join(tmpdir(), 'runway-integration-'));
  databaseDirectory = path.join(temporaryDirectory, '.runway-data');
  mkdirSync(databaseDirectory);
  const legacyDbPath = path.join(databaseDirectory, 'runway.sqlite');
  const legacyImage = await require('sharp')({ create: { width: 10, height: 10, channels: 3, background: '#888888' } }).jpeg().toBuffer();
  mkdirSync(path.join(databaseDirectory, 'uploads'));
  writeFileSync(path.join(databaseDirectory, 'uploads', `${legacyPhotoId}.jpg`), legacyImage);
  const legacyDb = new DatabaseSync(legacyDbPath);
  try {
    legacyDb.exec(`
      PRAGMA foreign_keys=ON;
      CREATE TABLE users (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL, city TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('member','admin')),
        created_at TEXT NOT NULL
      );
      INSERT INTO users(id,name,email,password_hash,city,created_at)
      VALUES('legacy-user','Existing user','legacy@example.test','fixture-no-login','Алматы','2025-01-01');
      CREATE TABLE sessions (
        token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at INTEGER NOT NULL, created_at TEXT NOT NULL
      );
      CREATE TABLE applications (
        id TEXT PRIMARY KEY, reference TEXT NOT NULL UNIQUE, user_id TEXT NOT NULL REFERENCES users(id),
        type TEXT NOT NULL CHECK(type IN ('model','viewer','course','collaboration')), title TEXT NOT NULL,
        target_id TEXT, model_id TEXT, status TEXT NOT NULL CHECK(status IN ('submitted','reviewing','accepted','rejected','withdrawn','waiting')),
        name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL, city TEXT NOT NULL,
        height INTEGER, measurements TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '',
        project_type TEXT NOT NULL DEFAULT '', project_date TEXT NOT NULL DEFAULT '',
        idempotency_key TEXT NOT NULL, dedupe_key TEXT NOT NULL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, admin_note TEXT NOT NULL DEFAULT '',
        UNIQUE(user_id,idempotency_key)
      );
      INSERT INTO applications(id,reference,user_id,type,title,status,name,email,phone,city,idempotency_key,dedupe_key,created_at,updated_at)
      VALUES('legacy-application','LEGACY-1','legacy-user','model','Existing application','rejected','Existing user','legacy@example.test','+77001112233','Алматы','legacy-key','model:general','2025-01-01','2025-01-01');
      CREATE TABLE photos (
        id TEXT PRIMARY KEY, application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
        file_name TEXT NOT NULL UNIQUE, original_name TEXT NOT NULL, size INTEGER NOT NULL, content_type TEXT NOT NULL
      );
      CREATE TABLE application_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT, application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
        status TEXT NOT NULL, at TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', actor_id TEXT NOT NULL REFERENCES users(id)
      );
      INSERT INTO application_history(application_id,status,at,note,actor_id)
      VALUES('legacy-application','rejected','2025-01-01','Existing history','legacy-user');
      CREATE TABLE favorites (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, model_id TEXT NOT NULL,
        PRIMARY KEY(user_id,model_id)
      );
      INSERT INTO favorites(user_id,model_id) VALUES('legacy-user','arman-kim');
      PRAGMA user_version=2;
    `);
    legacyDb.prepare('INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)').run(createHash('sha256').update(legacyToken).digest('hex'), 'legacy-user', Date.now() + 30 * 24 * 60 * 60 * 1000, '2025-01-01');
    legacyDb.prepare('INSERT INTO photos(id,application_id,file_name,original_name,size,content_type) VALUES(?,?,?,?,?,?)').run(legacyPhotoId, 'legacy-application', `${legacyPhotoId}.jpg`, 'legacy.jpg', legacyImage.length, 'image/jpeg');
  } finally {
    legacyDb.close();
  }
  const port = await freePort();
  await startServer(port);
  const migratedDb = new DatabaseSync(legacyDbPath);
  try {
    const legacyUser = migratedDb.prepare("SELECT name, email, birth_date, height, role FROM users WHERE id='legacy-user'").get();
    assert.equal(legacyUser?.name, 'Existing user');
    assert.equal(legacyUser?.email, 'legacy@example.test');
    assert.equal(legacyUser?.birth_date, '');
    assert.equal(legacyUser?.height, null);
    assert.equal(legacyUser?.role, 'viewer');
    assert.equal(migratedDb.prepare("SELECT COUNT(*) AS n FROM sessions WHERE user_id='legacy-user'").get().n, 1);
    assert.equal(migratedDb.prepare("SELECT user_id FROM applications WHERE id='legacy-application'").get().user_id, 'legacy-user');
    assert.equal(migratedDb.prepare("SELECT actor_id FROM application_history WHERE application_id='legacy-application'").get().actor_id, 'legacy-user');
    assert.equal(migratedDb.prepare("SELECT model_id FROM favorites WHERE user_id='legacy-user'").get().model_id, 'arman-kim');
    assert.equal(migratedDb.prepare("SELECT application_id FROM photos WHERE id=?").get(legacyPhotoId).application_id, 'legacy-application');
    assert.deepEqual(migratedDb.prepare('PRAGMA foreign_key_check').all(), []);
    checks.push('legacy migration preserves role, sessions and all dependent foreign keys');
  } finally {
    migratedDb.close();
  }
  const legacyActor = { cookie: `runway-session=${legacyToken}` };
  const legacyUser = (await request('legacy session remains valid after migration', '/api/auth/me', { actor: legacyActor })).data.user;
  assert.equal(legacyUser.id, 'legacy-user');
  assert.equal(legacyUser.role, 'viewer');
  const legacyApplication = (await request('legacy application and history remain available', '/api/applications/legacy-application', { actor: legacyActor })).data.application;
  assert.equal(legacyApplication.history[0].note, 'Existing history');
  assert.deepEqual((await request('legacy favorites remain available', '/api/favorites', { actor: legacyActor })).data.ids, ['arman-kim']);
  assert.deepEqual((await request('legacy private photo remains available', legacyApplication.photos[0].url, { actor: legacyActor })).data, legacyImage);
  await runSuite();
  console.log(JSON.stringify({ passed: checks.length, skipped, checks }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ passedBeforeFailure: checks.length, skipped, checks }, null, 2));
  console.error(error instanceof Error ? error.stack : error);
  if (serverLog) console.error(`\nOwned test server output:\n${serverLog.slice(-5000)}`);
  process.exitCode = interruption.signal.aborted ? 130 : 1;
} finally {
  process.removeListener('SIGINT', interrupted);
  process.removeListener('SIGTERM', interrupted);
  if (fixtureDatabase) { try { fixtureDatabase.close(); } catch { /* already closed */ } }
  try { await stopServer(); cleanupTemporaryDirectory(); }
  catch (error) { console.error(`Cleanup failed: ${error.message}`); process.exitCode = 1; }
}
