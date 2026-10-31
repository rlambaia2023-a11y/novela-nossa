import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Novela Nossa — estúdio de novelas originais, criadas em parceria.
// Código próprio, sem dependências externas. Só pt-BR.
// NÃO importa links, vídeos ou obras de terceiros: o catálogo nasce vazio,
// exceto uma novela-exemplo 100% original semeada na primeira execução.
const base = dirname(fileURLToPath(import.meta.url));
const password = process.env.ADMIN_PASSWORD;
if (!password || password.length < 12) throw new Error('Defina ADMIN_PASSWORD com pelo menos 12 caracteres.');
const username = process.env.ADMIN_USER || 'admin';
const salt = randomBytes(32), passHash = scryptSync(password, salt, 64);
const data = resolve(process.env.DATA_DIR || resolve(base, 'data')); mkdirSync(data, { recursive: true });
const db = new DatabaseSync(resolve(data, 'novelas.sqlite'));
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS stories(id TEXT PRIMARY KEY,title TEXT NOT NULL,genre TEXT NOT NULL,synopsis TEXT NOT NULL,tone TEXT NOT NULL,era TEXT NOT NULL,place TEXT NOT NULL,published INTEGER NOT NULL,created TEXT NOT NULL,updated TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS characters(id TEXT PRIMARY KEY,story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,name TEXT NOT NULL,role TEXT NOT NULL,secret TEXT NOT NULL,arc TEXT NOT NULL,position INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS chapters(id TEXT PRIMARY KEY,story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,title TEXT NOT NULL,position INTEGER NOT NULL,text TEXT NOT NULL,hook TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,expires INTEGER NOT NULL);`);
db.exec('DELETE FROM sessions');
const tokenHash = t => createHash('sha256').update(t).digest('hex');
const attempts = new Map();
const nowISO = () => new Date().toISOString();
const id = () => randomBytes(12).toString('hex');

function seed() {
  const n = db.prepare('SELECT COUNT(*) c FROM stories').get().c;
  if (n) return;
  const sid = id(), t = nowISO();
  db.prepare('INSERT INTO stories VALUES(?,?,?,?,?,?,?,?,?,?)').run(sid, 'A Maré de Itapuã', 'Drama romântico', 'Em Salvador, uma pescadora herda o farol da família e descobre que a luz que guia os barcos também guarda um segredo antigo.', 'Afetivo, com humor e reviravoltas', 'Hoje', 'Salvador, BA', 1, t, t);
  const chars = [
    ['Marina', 'Pescadora e herdeira do farol', 'Ela nunca contou por que parou de pescar à noite.', 'Aprender a confiar de novo, em si e nos outros.'],
    ['Caio', 'Filho de um armador rival', 'Ele voltou para devolver algo que a família dele tirou.', 'Escolher entre lealdade à família e o que é certo.'],
    ['Dona Zefa', 'Vizinha que sabe de tudo', 'Ela guardou as cartas do antigo faroleiro por trinta anos.', 'Contar a verdade antes que seja tarde.'],
  ];
  chars.forEach((c, i) => db.prepare('INSERT INTO characters VALUES(?,?,?,?,?,?,?)').run(id(), sid, c[0], c[1], c[2], c[3], i + 1));
  const chaps = [
    ['Capítulo 1 — A luz que voltou', 'Marina subiu os degraus do farol como quem sobe uma lembrança. Trinta anos depois da última vez, a lanterna ainda cheirava a sal e a querosene. Na gaveta do faroleiro, embaixo de um mapa desbotado, havia uma chave pequena e um bilhete sem assinatura: "Quando a maré subir, acenda". Naquela noite, pela primeira vez em anos, a luz de Itapuã voltou a girar sobre o mar.', 'Quem deixou o bilhete, e por que só agora?'],
    ['Capítulo 2 — O barco de Caio', 'Na manhã seguinte, um barco desconhecido atracou no cais. Caio desceu com uma caixa de madeira nas mãos e o olhar de quem ensaiou a frase mil vezes. "Vim devolver o que é seu", disse ele, sem olhar para Marina. Dentro da caixa, embrulhado em pano azul, estava o diário do antigo faroleiro. Dona Zefa, da janela, fechou a cortina devagar. Ela sabia o que aquele diário continha.', 'O que o diário revela sobre a família de Marina?'],
  ];
  chaps.forEach((c, i) => db.prepare('INSERT INTO chapters VALUES(?,?,?,?,?,?)').run(id(), sid, c[0], i + 1, c[1], c[2]));
  // Duas novelas originais completas, com arco fechado (início, virada,
  // revelação e desfecho). Nenhuma copia enredo, personagem ou cena de
  // obra existente; só usam os parâmetros do gênero: segredo, rivalidade,
  // segunda chance, reparação de uma injustiça e um gancho por capítulo.
  const addStory = (title, genre, synopsis, tone, era, place, chars2, chaps2) => {
    const s = id(), tt = nowISO();
    db.prepare('INSERT INTO stories VALUES(?,?,?,?,?,?,?,?,?,?)').run(s, title, genre, synopsis, tone, era, place, 1, tt, tt);
    chars2.forEach((c, i) => db.prepare('INSERT INTO characters VALUES(?,?,?,?,?,?,?)').run(id(), s, c[0], c[1], c[2], c[3], i + 1));
    chaps2.forEach((c, i) => db.prepare('INSERT INTO chapters VALUES(?,?,?,?,?,?)').run(id(), s, c[0], i + 1, c[1], c[2]));
  };
  addStory('A Costura de Lina', 'Drama romântico', 'Em Cachoeira, uma costureira herda o ateliê da avó e precisa decidir entre vender para a família rival ou costurar a própria história, quando um antigo amor volta à cidade.', 'Afetivo, com humor e dignidade', 'Hoje', 'Cachoeira, BA', [
    ['Lina', 'Costureira e herdeira do ateliê', 'Ela nunca terminou o vestido de noiva da mãe.', 'Aprender que herdar não é repetir, é escolher.'],
    ['Rafael', 'Filho da família rival, de volta à cidade', 'Ele voltou não para comprar, mas para devolver um molde antigo.', 'Trocar a disputa herdada por um acordo honesto.'],
    ['Dona Cida', 'Costureira aposentada e amiga da avó', 'Ela guardou as cartas da avó de Lina por anos.', 'Contar a verdade no momento certo, sem ferir.'],
  ], [
    ['Capítulo 1 — O ateliê vazio', 'Lina abriu a porta do ateliê e o cheiro de pano e café a recebeu como um abraço. A avó tinha deixado tudo no lugar: tesouras, moldes, uma máquina antiga e um bilhete preso no espelho. "Costura para quem precisa, não para quem paga mais", dizia o bilhete. Naquela tarde, chegou a primeira proposta de compra, com um valor alto e um prazo curto.', 'Quem quer tanto o ateliê, e por quê?'],
    ['Capítulo 2 — O rapaz da porta', 'Rafael apareceu na porta com uma caixa de moldes e um pedido estranho. Ele não queria comprar nada. Queria devolver o que a família dele tinha levado anos atrás, quando as duas famílias brigaram por causa de um vestido. Lina não sabia se acreditava, mas o molde dentro da caixa tinha a letra da avó.', 'O molde é verdadeiro, ou é só uma forma de entrar?'],
    ['Capítulo 3 — O vestido inacabado', 'No fundo do armário, Lina achou o vestido inacabado da mãe, guardado com alfinetes e um papel. O papel dizia que o vestido nunca foi terminado porque a mãe escolheu outro caminho, não porque faltou pano. Pela primeira vez, Lina entendeu que terminar aquele vestido era uma escolha dela, não uma dívida.', 'Lina vai terminar o vestido, ou vai começar um novo?'],
    ['Capítulo 4 — A proposta', 'A família rival aumentou a oferta e colocou uma condição: se Lina não vendesse em uma semana, perderia o fornecedor de tecidos da cidade. Rafael ficou entre os dois lados e fez uma proposta diferente: um acordo em que o ateliê ficava com Lina e a família dele encomendava os vestidos de festa. Era um bom acordo, mas exigia confiança de quem nunca confiou.', 'Lina aceita um acordo com quem já a prejudicou?'],
    ['Capítulo 5 — A carta na festa', 'Na festa da cidade, Dona Cida entregou a Lina as cartas da avó. Nelas, a avó contava que a briga antiga tinha começado por um mal-entendido, não por maldade, e pedia que as duas famílias costurassem juntas de novo. Lina leu a carta em voz alta, sem apontar culpados, e a praça ficou em silêncio. Depois do silêncio, veio o aplauso.', 'Com a verdade na mesa, o que muda entre as famílias?'],
    ['Capítulo 6 — O primeiro vestido novo', 'Lina não vendeu o ateliê. Costurou o primeiro vestido novo com o molde devolvido e o pano que sobrou, e vestiu a si mesma na inauguração. Rafael encomendou o primeiro vestido de festa, a família rival pagou o preço justo, e Dona Cida chorou de orgulho. O ateliê voltou a ter fila na porta, desta vez por escolha, não por herança.', 'Fim da novela: Lina costura, enfim, para si.'],
  ]);
  addStory('O Trem das Sete', 'Drama familiar com romance', 'Na estação de uma cidade do interior da Bahia, uma professora volta para cuidar do pai e reencontra o amigo de infância que nunca partiu, enquanto um bilhete antigo ameaça mudar o que todos lembram.', 'Afetivo, com memória e recomeço', 'Hoje', 'Interior da Bahia', [
    ['Alice', 'Professora de volta à cidade natal', 'Ela saiu sem se despedir direito de Theo.', 'Aprender a ficar sem abrir mão de si.'],
    ['Theo', 'Guardião da estação', 'Ele guardou um bilhete que Alice escreveu na adolescência.', 'Dizer o que sentiu, mesmo tarde.'],
    ['Seu Jonas', 'Pai de Alice, ex-ferroviário', 'Ele trocou um turno para salvar um amigo, e nunca contou.', 'Aceitar ajuda da filha sem perder a dignidade.'],
  ], [
    ['Capítulo 1 — Volta para casa', 'Alice desceu do ônibus com uma mala e um plano simples: cuidar do pai por um tempo e voltar para a capital. A estação estava igual, só mais quieta. Theo estava lá, com o mesmo sorriso e um uniforme novo de guardião. Ele a reconheceu antes de ela falar qualquer coisa.', 'Por que Theo nunca partiu, se sempre quis?'],
    ['Capítulo 2 — O bilhete', 'Arrumando o quarto antigo, Alice achou um bilhete que ela mesma tinha escrito aos dezessete anos e nunca entregou. Nele, ela prometia voltar no trem das sete. Theo, sem saber do bilhete, contou que guardava os bilhetes de todos os trens das sete, como quem guarda promessas. Alice ficou sem palavras.', 'Theo sabe do bilhete, ou guarda só os bilhetes dos trens?'],
    ['Capítulo 3 — A estação à noite', 'À noite, a estação ficava com Theo e com as histórias do pai de Alice. Seu Jonas contou, aos poucos, que tinha trocado um turno para salvar um amigo e que isso custou a promoção dele. Alice entendeu, enfim, por que o pai nunca falava do passado com orgulho, mas com paz.', 'O que o pai sacrificou, e por quem?'],
    ['Capítulo 4 — A escolha de Theo', 'Chegou uma vaga na capital para Theo, o trabalho que ele sempre quis. Aceitar significava partir no trem das sete, o mesmo trem da promessa de Alice. Recusar significava ficar na estação, perto dela e do pai dela. Theo pediu um dia para decidir, e Alice prometeu não interferir.', 'Theo parte, ou fica?'],
    ['Capítulo 5 — A verdade de Jonas', 'Seu Jonas chamou os dois e contou tudo, sem rodeios: o amigo que ele salvou era o pai de Theo. Por isso, Theo tinha crescido cuidando da estação como quem paga uma dívida que não era dele. Jonas pediu que Theo escolhesse por si, não por gratidão, e que Alice ficasse por amor, não por culpa.', 'Livres da dívida, o que cada um escolhe de verdade?'],
    ['Capítulo 6 — O trem das sete', 'No dia seguinte, o trem das sete chegou na hora. Theo não embarcou. Alice não voltou para a capital. Ela ficou para ensinar na escola da cidade, Theo ficou na estação, e Seu Jonas voltou a contar histórias, agora com os dois ouvindo. A promessa do bilhete, enfim, se cumpriu de outro jeito: ninguém partiu sozinho.', 'Fim da novela: a promessa se cumpre sem ninguém partir sozinho.'],
  ]);
}
seed();

const json = (res, status, obj) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); };
function text(v, max, required = true) { if (typeof v !== 'string' || v.length > max || (required && !v.trim())) throw new Error('Campo inválido ou muito longo.'); return v.trim(); }
async function body(req) { let s = ''; for await (const chunk of req) { s += chunk; if (Buffer.byteLength(s) > 524288) { const e = new Error('Solicitação muito grande.'); e.status = 413; throw e; } } try { return JSON.parse(s); } catch { throw new Error('JSON inválido.'); } }
function authorized(req) { const t = req.headers.authorization?.replace(/^Bearer /, '') || ''; if (!t) return false; const row = db.prepare('SELECT expires FROM sessions WHERE hash=?').get(tokenHash(t)); return !!row && row.expires > Date.now(); }
function full(s, admin = false) {
  return { ...s, published: !!s.published,
    characters: db.prepare('SELECT * FROM characters WHERE story_id=? ORDER BY position,id').all(s.id),
    chapters: db.prepare('SELECT * FROM chapters WHERE story_id=? ORDER BY position,id').all(s.id) };
}
function catalog(admin = false) {
  return db.prepare('SELECT * FROM stories ' + (admin ? '' : 'WHERE published=1 ') + 'ORDER BY updated DESC').all().map(s => full(s, admin));
}
// Sugestões locais de continuação: sem custo, sem cota, sem API.
// A v2 com Gemini (só Lite, com cache e parada em 429) usa exatamente este
// formato de resposta, para o estúdio não mudar quando a IA entrar.
function suggest(story, chars, chapters) {
  const last = chapters[chapters.length - 1];
  const hook = last?.hook || story.synopsis;
  const a = chars[0]?.name || 'a protagonista';
  const b = chars[1]?.name || 'alguém do passado';
  const c = chars[2]?.name || 'uma testemunha silenciosa';
  const next = chapters.length + 1;
  return [
    { kind: 'Revelação', title: `Capítulo ${next} — O que ${a} não contou`, text: `O gancho anterior era: ${hook} Neste capítulo, ${a} finalmente encara o que vinha adiando. Uma conversa interrompida, um objeto esquecido e uma frase dita na hora errada mudam o que todos pensavam saber.`, hook: `Se isso é verdade, em quem ${a} ainda pode confiar?` },
    { kind: 'Reviravolta', title: `Capítulo ${next} — A chegada de ${b}`, text: `${b} aparece quando ninguém esperava, trazendo uma versão diferente da mesma história. O que parecia rivalidade vira dúvida, e o que parecia certeza vira pergunta. ${c} observa tudo em silêncio, porque sabe mais do que diz.`, hook: `Qual versão da história ${b} está escondendo?` },
    { kind: 'Decisão impossível', title: `Capítulo ${next} — A maré decide`, text: `Chega a hora de escolher, e nenhuma escolha é limpa. Ficar protege quem se ama e custa um sonho; partir realiza o sonho e deixa alguém para trás. ${a} tem até a maré subir para decidir, e o relógio da história não espera.`, hook: `O que ${a} vai sacrificar para seguir em frente?` },
  ];
}

const html = readFileSync(resolve(base, 'public/index.html'));
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; media-src 'self' https:; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'");
  try {
    const p = new URL(req.url, 'http://localhost').pathname;
    if (req.method === 'GET' && p === '/api/health') return json(res, 200, { ok: true, app: 'novela-nossa', stories: db.prepare('SELECT COUNT(*) c FROM stories').get().c, chapters: db.prepare('SELECT COUNT(*) c FROM chapters').get().c, ai: 'sugestoes-locais', gemini: 'pendente-chave' });
    if (req.method === 'GET' && p === '/api/stories') return json(res, 200, catalog());
    if (req.method === 'GET' && p.startsWith('/api/stories/')) { const s = db.prepare('SELECT * FROM stories WHERE id=? AND published=1').get(p.split('/').pop()); if (!s) return json(res, 404, { error: 'Novela não encontrada.' }); return json(res, 200, full(s)); }
    if (req.method === 'POST' && p === '/api/login') {
      const ip = req.socket.remoteAddress, now = Date.now();
      for (const [k, v] of attempts) if (v.until < now) attempts.delete(k);
      const a = attempts.get(ip) || { count: 0, until: now + 900000 }; if (a.count >= 8) return json(res, 429, { error: 'Muitas tentativas. Aguarde 15 minutos.' });
      const b = await body(req); a.count++; attempts.set(ip, a);
      if (b.username !== username || typeof b.password !== 'string' || b.password.length > 1024 || !timingSafeEqual(scryptSync(b.password, salt, 64), passHash)) return json(res, 401, { error: 'Usuário ou senha incorretos.' });
      attempts.delete(ip); db.prepare('DELETE FROM sessions WHERE expires<?').run(now);
      const token = randomBytes(32).toString('hex'); db.prepare('INSERT INTO sessions VALUES(?,?)').run(tokenHash(token), now + 8 * 3600000); return json(res, 200, { token });
    }
    if (p.startsWith('/api/admin')) {
      if (!authorized(req)) return json(res, 401, { error: 'Entre novamente no estúdio.' });
      if (p === '/api/admin/logout' && req.method === 'POST') { db.prepare('DELETE FROM sessions WHERE hash=?').run(tokenHash(req.headers.authorization.replace(/^Bearer /, ''))); return json(res, 200, { ok: true }); }
      if (p === '/api/admin/stories' && req.method === 'GET') return json(res, 200, catalog(true));
      if (p === '/api/admin/suggest' && req.method === 'POST') {
        const b = await body(req); const s = db.prepare('SELECT * FROM stories WHERE id=?').get(text(b.storyId, 80));
        if (!s) return json(res, 404, { error: 'Novela não encontrada.' });
        const chars = db.prepare('SELECT * FROM characters WHERE story_id=? ORDER BY position').all(s.id);
        const chaps = db.prepare('SELECT * FROM chapters WHERE story_id=? ORDER BY position').all(s.id);
        return json(res, 200, { source: 'local', note: 'Sugestões do estúdio, sem gastar cota de IA. A continuação com Gemini (modelo Lite, com cache e parada em 429) é o próximo passo, quando houver chave.', suggestions: suggest(s, chars, chaps) });
      }
      if (p === '/api/admin/stories' && req.method === 'POST') {
        const b = await body(req), sid = b.id ? text(b.id, 80) : id();
        const title = text(b.title, 180), genre = text(b.genre, 80), synopsis = text(b.synopsis, 4000);
        const tone = text(b.tone, 300, false), era = text(b.era, 120, false), place = text(b.place, 180, false);
        if (typeof b.published !== 'boolean' || b.originalConfirmed !== true) throw new Error('Confirme que a história é original, criada aqui, e a visibilidade.');
        if (!Array.isArray(b.characters) || b.characters.length > 30 || !Array.isArray(b.chapters) || b.chapters.length > 100) throw new Error('Limite: 30 personagens e 100 capítulos.');
        const chars = b.characters.map((c, i) => ({ name: text(c.name, 120), role: text(c.role, 300, false), secret: text(c.secret, 1000, false), arc: text(c.arc, 1000, false), position: i + 1 }));
        const chaps = b.chapters.map((c, i) => ({ title: text(c.title, 180), text: text(c.text, 20000), hook: text(c.hook, 1000, false), position: i + 1 }));
        if (b.published && !chaps.length) throw new Error('Adicione ao menos um capítulo antes de publicar.');
        const t = nowISO();
        db.exec('BEGIN'); try {
          const exists = db.prepare('SELECT created FROM stories WHERE id=?').get(sid);
          db.prepare(`INSERT INTO stories VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,genre=excluded.genre,synopsis=excluded.synopsis,tone=excluded.tone,era=excluded.era,place=excluded.place,published=excluded.published,updated=excluded.updated`).run(sid, title, genre, synopsis, tone, era, place, b.published ? 1 : 0, exists?.created || t, t);
          db.prepare('DELETE FROM characters WHERE story_id=?').run(sid); db.prepare('DELETE FROM chapters WHERE story_id=?').run(sid);
          const ic = db.prepare('INSERT INTO characters VALUES(?,?,?,?,?,?,?)'); chars.forEach(c => ic.run(id(), sid, c.name, c.role, c.secret, c.arc, c.position));
          const ih = db.prepare('INSERT INTO chapters VALUES(?,?,?,?,?,?)'); chaps.forEach(c => ih.run(id(), sid, c.title, c.position, c.text, c.hook));
          db.exec('COMMIT');
        } catch (e) { db.exec('ROLLBACK'); throw e; } return json(res, 200, { id: sid });
      }
      if (p.startsWith('/api/admin/stories/') && req.method === 'DELETE') { db.prepare('DELETE FROM stories WHERE id=?').run(p.split('/').pop()); return json(res, 200, { ok: true }); }
      return json(res, 404, { error: 'Rota não encontrada.' });
    }
    if (req.method === 'GET' && (p === '/' || p === '/estudio')) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' }); return res.end(html); }
    return json(res, 404, { error: 'Página não encontrada.' });
  } catch (e) { if (e.code?.startsWith('SQLITE')) { console.error(e); return json(res, 500, { error: 'Não foi possível salvar. Tente novamente.' }); } return json(res, e.status || 400, { error: e.message || 'Solicitação inválida.' }); }
});
server.requestTimeout = 30000; server.headersTimeout = 15000;
server.listen(Number(process.env.PORT || 3106), '0.0.0.0', () => console.log('Novela Nossa disponível na porta ' + (process.env.PORT || 3106)));
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => server.close(() => { db.close(); process.exit(0); }));
