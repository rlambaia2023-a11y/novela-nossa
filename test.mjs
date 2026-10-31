import { test } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
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

test('novela nossa: contribuições públicas com aprovação', async () => {
  const PORT2 = 3200, dir2 = mkdtempSync(join(tmpdir(), 'novela-nossa-contrib-'));
  let child2;
  async function waitHealth2() {
    for (let i = 0; i < 50; i++) {
      try { const r = await fetch(`http://localhost:${PORT2}/api/health`); if (r.ok) return; } catch {}
      await new Promise(r => setTimeout(r, 200));
    }
    throw new Error('servidor de contribuições não subiu');
  }
  child2 = spawn(process.execPath, ['--experimental-sqlite', 'server.mjs'], { cwd: new URL('.', import.meta.url).pathname, env: { ...process.env, PORT: String(PORT2), DATA_DIR: dir2, ADMIN_USER: 'admin', ADMIN_PASSWORD: 'senha-forte-teste-123' }, stdio: 'pipe' });
  try {
    await waitHealth2();
    const pub = async (body, headers = {}) => fetch(`http://localhost:${PORT2}/api/contributions`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
    // Sem confirmação de originalidade, rejeita.
    assert.equal((await pub({ kind: 'ideia', title: 'X', synopsis: 'Y' })).status, 400);
    const ideia = await (await pub({ kind: 'ideia', title: 'Ideia de Teste', genre: 'Drama', synopsis: 'Uma ideia inventada para teste.', era: 'hoje', place: 'Salvador', author: 'Leitor Teste', originalConfirmed: true })).json();
    assert.ok(ideia.id);
    const stories = await (await fetch(`http://localhost:${PORT2}/api/stories`)).json();
    const first = stories[0];
    const cont = await (await pub({ kind: 'continuacao', story_id: first.id, title: 'Capítulo enviado', text: 'Texto de continuação enviado por um leitor.', hook: 'E agora?', author: 'Leitor Teste', originalConfirmed: true })).json();
    assert.ok(cont.id);
    // Nada publicou sozinho: ideia não está no catálogo e capítulo não entrou.
    const before = await (await fetch(`http://localhost:${PORT2}/api/stories/${first.id}`)).json();
    assert.equal(before.chapters.length, first.chapters.length);
    assert.ok(!(await (await fetch(`http://localhost:${PORT2}/api/stories`)).json()).some(s => s.title === 'Ideia de Teste'));
    const login = await (await fetch(`http://localhost:${PORT2}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'senha-forte-teste-123' }) })).json();
    const auth = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.token };
    assert.equal((await fetch(`http://localhost:${PORT2}/api/admin/contributions`)).status, 401);
    const queue = await (await fetch(`http://localhost:${PORT2}/api/admin/contributions`, { headers: auth })).json();
    assert.equal(queue.filter(c => c.status === 'pendente').length, 2);
    const apIdea = await (await fetch(`http://localhost:${PORT2}/api/admin/contributions/${ideia.id}/approve`, { method: 'POST', headers: auth })).json();
    assert.ok(apIdea.storyId);
    // Ideia aprovada vira rascunho, não catálogo público.
    assert.ok(!(await (await fetch(`http://localhost:${PORT2}/api/stories`)).json()).some(s => s.id === apIdea.storyId));
    const apCont = await (await fetch(`http://localhost:${PORT2}/api/admin/contributions/${cont.id}/approve`, { method: 'POST', headers: auth })).json();
    assert.equal(apCont.chapterPosition, first.chapters.length + 1);
    const after = await (await fetch(`http://localhost:${PORT2}/api/stories/${first.id}`)).json();
    assert.equal(after.chapters.length, first.chapters.length + 1);
    assert.equal(after.chapters[after.chapters.length - 1].text, 'Texto de continuação enviado por um leitor.');
    // Descarte: cria, descarta, exclui.
    const extra = await (await pub({ kind: 'ideia', title: 'Ideia para descartar', synopsis: 'Não usar.', originalConfirmed: true })).json();
    assert.equal((await fetch(`http://localhost:${PORT2}/api/admin/contributions/${extra.id}/discard`, { method: 'POST', headers: auth })).status, 200);
    assert.equal((await fetch(`http://localhost:${PORT2}/api/admin/contributions/${extra.id}`, { method: 'DELETE', headers: auth })).status, 200);
  } finally { child2.kill(); try { rmSync(dir2, { recursive: true, force: true }); } catch {} }
});
