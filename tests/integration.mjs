/** Real HTTP integration tests. Run after `npm run build`; no real user database is opened. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { existsSync, lstatSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const require = createRequire(import.meta.url);
const checks = [];
const skipped = [];
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

async function request(label, route, { method = 'GET', body, actor, origin = base, expected = 200 } = {}) {
  checkInterrupted();
  const headers = { Accept: 'application/json' };
  if (origin) headers.Origin = origin;
  if (actor?.cookie) headers.Cookie = actor.cookie;
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
}

async function loadEditorialData() {
  // Data modules are pure TypeScript. Compile only these two into the disposable test directory.
  const ts = require('typescript');
  for (const name of ['events', 'courses', 'models']) {
    const source = readFileSync(path.join(root, 'src', 'data', `${name}.ts`), 'utf8');
    const emitted = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
      .replace(/from\s+["'](?:\.\/events|@\/data\/events)["']/g, 'from "./events.mjs"');
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
  const plainFields = { height: '', age: '', measurements: '' };

  for (const route of ['/', '/models', '/events', '/shoots', '/casting', '/academy', '/backstage', '/contact', '/login', '/register', '/account', '/admin']) await requestHTML(`HTML route ${route}`, route);
  for (const model of models) await requestHTML(`HTML model ${model.id}`, `/models/${model.id}`);
  for (const event of events) await requestHTML(`HTML event ${event.id}`, `/events/${event.id}`);

  await request('health', '/api/health');
  assert.equal((await request('guest account', '/api/auth/me')).data.user, null);
  await request('guest cannot list applications', '/api/applications', { expected: 401 });
  await request('cross-origin blocked', '/api/auth/register', { method: 'POST', origin: 'http://other.invalid', body: {}, expected: 403 });
  await request('missing Origin blocked', '/api/auth/register', { method: 'POST', origin: null, body: {}, expected: 403 });
  await request('invalid registration fields', '/api/auth/register', { method: 'POST', body: { name: ' ', email: 'broken', password: 'short', city: ' ', consent: false }, expected: 422 });
  for (const [actor, name] of [[alice, 'Алиса Тест'], [bob, 'Боб Тест'], [admin, 'Администратор Тест']]) {
    const { data, headers } = await request(`register ${name}`, '/api/auth/register', { method: 'POST', actor, body: { name, email: actor.email, password, city: 'Алматы', consent: true, role: 'admin' }, expected: 201 });
    actor.id = data.user.id;
    assert.equal(data.user.role, 'member');
    assert.match(headers.get('set-cookie'), /HttpOnly/);
    assert.match(headers.get('set-cookie'), /SameSite=Lax/);
  }
  await request('case-insensitive duplicate registration', '/api/auth/register', { method: 'POST', body: { name: 'Тест Повтор', email: alice.email.toUpperCase(), password, city: 'Алматы', consent: true }, expected: 409 });
  await request('bad login credentials', '/api/auth/login', { method: 'POST', body: { email: alice.email, password: 'wrong-password' }, expected: 401 });
  assert.equal((await request('owner session', '/api/auth/me', { actor: alice })).data.user.id, alice.id);
  await request('member admin access blocked', '/api/admin/applications', { actor: alice, expected: 403 });
  await request('profile role injection ignored', '/api/profile', { method: 'PATCH', actor: alice, body: { name: 'Алиса Новый Профиль', city: 'Астана', role: 'admin' } });
  const profile = (await request('profile updated', '/api/auth/me', { actor: alice })).data.user;
  assert.equal(profile.role, 'member'); assert.equal(profile.name, 'Алиса Новый Профиль'); assert.equal(profile.city, 'Астана');
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
  await request('admin demotes team member', `/api/admin/users/${bob.id}`, { method: 'PATCH', actor: admin, body: { role: 'member' } });
  await request('last admin protected', `/api/admin/users/${admin.id}`, { method: 'PATCH', actor: admin, body: { role: 'member' }, expected: 409 });
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
      fixtureDatabase.prepare("INSERT INTO users(id,name,email,password_hash,city,role,created_at) VALUES(?,?,?,?,?,'member',?)").run(userId, 'Seat fixture', `seat-${index}-${suffix}@example.com`, 'fixture-no-login', 'Астана', at);
      fixtureDatabase.prepare("INSERT INTO applications(id,reference,user_id,type,title,target_id,status,name,email,phone,city,idempotency_key,dedupe_key,created_at,updated_at) VALUES(?,?,?,'viewer','Capacity fixture',?,'accepted',?,?,?,?,?,?,?,?)").run(applicationId, `SEAT-${suffix}-${index}`, userId, capacityEvent.id, 'Seat fixture', `seat-${index}-${suffix}@example.com`, '+77001234567', 'Астана', randomUUID(), `viewer:${capacityEvent.id}`, at, at);
    }
    assert.ok(fixtures.length, 'Capacity fixture needs at least one disposable reservation.');
    const waiting = (await request('full event waitlist', '/api/applications', { method: 'POST', actor: bob, body: form(bob, { ...plainFields, type: 'viewer', targetId: capacityEvent.id }, []), expected: 201 })).data.application;
    assert.equal(waiting.status, 'waiting');
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
  const persistedUser = (await request('session survives server restart', '/api/auth/me', { actor: alice })).data.user;
  assert.equal(persistedUser.id, alice.id); assert.equal(persistedUser.name, 'Алиса Новый Профиль'); assert.equal(alice.cookie, cookieBeforeRestart);
  const persisted = (await request('applications survive server restart', '/api/applications', { actor: alice })).data.applications;
  assert.equal(persisted.find(item => item.id === app.id).status, 'rejected');
  assert.equal(persisted.find(item => item.id === replacement.id).status, 'withdrawn');
  assert.deepEqual((await request('private photo survives server restart', app.photos[0].url, { actor: alice })).data, imageBeforeRestart);
  const persistedFavorites = (await request('favorites survive server restart', '/api/favorites', { actor: alice })).data;
  assert.equal(persistedFavorites.userId, alice.id); assert.deepEqual(persistedFavorites.ids, ['arman-kim', 'eva-sokolova']);
  assert.equal((await request('admin role survives server restart', '/api/auth/me', { actor: admin })).data.user.role, 'admin');
  await request('admin access survives server restart', '/api/admin/applications', { actor: admin });
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
  const port = await freePort();
  await startServer(port);
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
