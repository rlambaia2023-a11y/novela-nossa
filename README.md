# Novela Nossa — a história é nossa

Estúdio novo, código próprio, sem dependências externas, só em pt-BR.
A diferença para o Novela Livre que veio nos zips: aqui não há catálogo
de vídeos de terceiros. A novela nasce no estúdio, original, e cresce
capítulo a capítulo com a escolha de quem está criando.

## O que é inovador aqui

1. **Criação, não catálogo**: premissa, tom, época e lugar primeiro.
2. **Bíblia da novela**: cada personagem tem papel, segredo e arco
   (como ele muda ao longo da história).
3. **Gancho em todo capítulo**: cada capítulo termina com a pergunta
   que o próximo precisa responder.
4. **Co-criação com 3 rumos**: o botão "Sugerir 3 continuações" propõe
   Revelação, Reviravolta e Decisão impossível, usando os personagens
   e o gancho anterior. Você escolhe um, edita o texto e salva.
   Na v1 as sugestões são locais, sem gastar cota de IA.
5. **Leitura completa**: progresso salvo no navegador, tempo de
   leitura, narração em voz do próprio navegador (pt-BR) e
   exportação da novela em texto.
6. **Contribuições com aprovação**: qualquer visitante, sem login,
   pode enviar uma ideia de novela nova ou uma continuação de uma
   novela que já existe, na seção "Contribua" da página inicial.
   Nada publica sozinho: a contribuição fica pendente numa fila
   dentro do estúdio. Aprovar uma ideia cria um rascunho (não
   publica); aprovar uma continuação publica o capítulo na novela.
   Descartar não publica nada. Limite de 10 contribuições por hora
   por visitante, contra spam.

## O que NÃO veio dos zips

Os arquivos `links-novelas.json` e `LINKS-DAS-NOVELAS.md` do pacote
anterior são só referências de pesquisa, com acesso integral não
confirmado. Nenhum desses links, vídeos ou títulos foi importado
para este sistema. O catálogo aqui começa com uma novela-exemplo
100% original, "A Maré de Itapuã", criada neste projeto.

## Rodar localmente

Requer Node.js 22.13 ou superior.

```sh
cp .env.example .env
# edite .env e troque ADMIN_PASSWORD por uma senha forte, 12+ caracteres
node --env-file=.env --experimental-sqlite server.mjs
```

- Leitura: http://localhost:3106
- Estúdio: http://localhost:3106/estudio
- Saúde: http://localhost:3106/api/health

## Próximo passo (v2, com sua aprovação)

Continuação de capítulo com Gemini, seguindo a regra vigente:
só Gemini, nunca OpenAI; modelo Lite primeiro; cache de sugestões
iguais; parada imediata em 429, sem tentar outro modelo; e verificação
com uma chamada real, não só com a presença da variável.
Isso exige `GEMINI_API_KEY` no ambiente (nunca colada no chat) e
volume persistente em produção, senão um redeploy apaga o banco.

## Testes

```sh
npm test
```

## Parâmetros do estilo (pesquisa, sem copiar obra alheia)

Parâmetros usados para criar novelas novas neste estilo, a partir de
referências públicas sobre o gênero, não de enredos copiados:

- Melodrama: tensão entre vício e virtude, reparação de uma injustiça e
  busca pela realização amorosa.
- Cada capítulo movimenta a história e termina com um gancho, uma
  pergunta concreta que o próximo capítulo responde.
- Arquétipos reconhecíveis logo no início, com camadas depois:
  protagonista comum com talento escondido, rival com segredo, aliado
  improvável, amor do passado que volta, segunda chance, romance
  proibido por circunstâncias, não por vilania vazia.
- Novela curta: um fio principal por capítulo, poucos lugares, ritmo
  rápido, espiral de tensão até o clímax e desfecho fechado.

## Novelas completas semeadas (originais)

- "A Maré de Itapuã" (exemplo, 2 capítulos, arco em aberto para
  continuar no estúdio).
- "A Costura de Lina" (completa, 6 capítulos, Cachoeira, BA).
- "O Trem das Sete" (completa, 6 capítulos, interior da Bahia).

As duas novas entram no catálogo na primeira execução, pelo seed do
servidor, e chegam à Railway no próximo deploy a partir do main.
