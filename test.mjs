import { test } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 3199;
const dir = mkdtempSync(join(tmpdir(), 'novela-nossa-'));
let child;
async function waitHealth() {
  for (let i = 0; i < 50; i++) {
    try { const r = await fetch(`http://localhost:${PORT}/api/health`); if (r.ok) return await r.json(); } catch {}
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error('servidor não subiu');
}
test('novela nossa: saúde, criação, sugestão, leitura e exclusão', async () => {
  child = spawn(process.execPath, ['--experimental-sqlite', 'server.mjs'], { cwd: new URL('.', import.meta.url).pathname, env: { ...process.env, PORT: String(PORT), DATA_DIR: dir, ADMIN_USER: 'admin', ADMIN_PASSWORD: 'senha-forte-teste-123' }, stdio: 'pipe' });
  try {
    const health = await waitHealth();
    assert.equal(health.ok, true);
    assert.equal(health.stories, 3); // 3 novelas originais semeadas: Maré, Costura e Trem
    const login = await (await fetch(`http://localhost:${PORT}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'senha-forte-teste-123' }) })).json();
    assert.ok(login.token);
    const auth = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.token };
    const created = await (await fetch(`http://localhost:${PORT}/api/admin/stories`, { method: 'POST', headers: auth, body: JSON.stringify({ title: 'Teste Original', genre: 'Drama', synopsis: 'Uma história inventada para teste.', tone: 'leve', era: 'hoje', place: 'Salvador', published: true, originalConfirmed: true, characters: [{ name: 'Lia', role: 'protagonista', secret: 'guarda uma carta', arc: 'aprende a falar' }], chapters: [{ title: 'Capítulo 1', text: 'Era uma vez uma carta.', hook: 'Quem escreveu a carta?' }] }) })).json();
    assert.ok(created.id);
    const sug = await (await fetch(`http://localhost:${PORT}/api/admin/suggest`, { method: 'POST', headers: auth, body: JSON.stringify({ storyId: created.id }) })).json();
    assert.equal(sug.suggestions.length, 3);
    const pub = await (await fetch(`http://localhost:${PORT}/api/stories`)).json();
    assert.ok(pub.some(s => s.id === created.id));
    const one = await (await fetch(`http://localhost:${PORT}/api/stories/${created.id}`)).json();
    assert.equal(one.chapters[0].title, 'Capítulo 1');
    const del = await fetch(`http://localhost:${PORT}/api/admin/stories/${created.id}`, { method: 'DELETE', headers: auth });
    assert.equal(del.status, 200);
  } finally { child.kill(); }
});
