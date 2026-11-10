# 🎮 Bot de Fila X1 · Free Fire AP (Discord)

Bot para servidor de **AP/X1 de Free Fire**: fila com painel de botões, chamada do host que cria a
sala, registro de resultados e ranking que **não se perde** quando o bot reinicia.

Sem API da Garena, sem serviço de terceiro, sem custo por sala. O host cria a sala no jogo (como
sempre) e o bot cuida de toda a organização.

---

## O que ele faz

| Recurso | Como funciona |
|---|---|
| **Fila** | Botão **Entrar na fila** / **Sair da fila**, com posição e ordem de chegada |
| **Próximo X1** | O painel mostra automaticamente os 2 primeiros: `@fulano vs @ciclano` |
| **Chamar host** | Botão marca o cargo/usuário do host, mostra o confronto e pede ID + senha da sala |
| **Anti-flood** | O host só pode ser chamado 1x por minuto (configurável) |
| **Resultado** | `/resultado vencedor:@x perdedor:@y sala:12345678` — tira os dois da fila e salva no histórico |
| **Ranking** | `/ranking` com vitórias, derrotas, aproveitamento, sequência de vitórias e medalhas |
| **Persistência** | Tudo salvo em `data/dados.json` (arquivo local, sem banco de dados) |
| **Segurança** | Painel/limpar fila = staff; resultado = host ou staff; `/sethost` = admin |

## Comandos

| Comando | Quem pode | Para que serve |
|---|---|---|
| `/painelx1` | Gerenciar Canais | Publica o painel fixo com os botões |
| `/fila` | todos | Vê a fila atual (só você vê) |
| `/ranking [quantos]` | todos | Tabela de vitórias do servidor |
| `/resultado vencedor: perdedor: [sala:]` | host ou staff | Registra o X1 |
| `/sethost cargo:` ou `/sethost usuario:` | Gerenciar Servidor | Define quem é marcado no "Chamar host" |
| `/limparfila` | Gerenciar Canais | Zera a fila (não apaga partidas) |
| `/ajuda` | todos | Explica o fluxo |

---

## Como rodar (passo a passo)

### 1. Criar o bot no Discord
1. Abra **https://discord.com/developers/applications** → **New Application** → nome `Fila X1`.
2. Menu **Bot** → **Reset Token** → **Copy**. Guarde: é a senha do bot.
3. Ainda em **Bot**, **não ligue** nenhuma opção de *Privileged Gateway Intents* (não precisa).
4. Anote o **Application ID** (menu **General Information**).

### 2. Convidar o bot para o servidor
**OAuth2 → URL Generator** → marque `bot` e `applications.commands` → marque as permissões
**View Channels**, **Send Messages**, **Embed Links** e **Read Message History**
→ copie o link e abra no navegador → escolha o servidor.

Link pronto (troque `SEU_APP_ID`):
```
https://discord.com/oauth2/authorize?client_id=SEU_APP_ID&permissions=84992&scope=bot%20applications.commands
```

### 3. Instalar e configurar
Com Node.js 18+ instalado (no celular, dentro do Termux: `pkg install -y nodejs`):

```bash
# dentro da pasta do bot
npm install
```

Abra o arquivo `.env` e coloque o token:

```
DISCORD_TOKEN=seu_token_aqui
HOST_ROLE_ID=
HOST_USUARIO_ID=
DATA_FILE=data/dados.json
COOLDOWN_HOST_MS=60000
```

`HOST_ROLE_ID` / `HOST_USUARIO_ID` são opcionais: você pode definir o host direto no Discord
com `/sethost`, que é mais fácil.

### 4. Ligar
```bash
npm start
```

Deve aparecer `✅ Bot conectado como ...` e a lista de comandos registrados.

### 5. Usar no Discord
1. Num canal de texto, staff roda **`/painelx1`** → o painel fica fixo com os botões.
2. Admin roda **`/sethost cargo:@Host`** (o cargo que cria as salas).
3. Jogadores clicam em **Entrar na fila**.
4. Com 2 na fila, alguém clica em **Chamar host** → o bot marca o host e mostra o X1.
5. Host cria a sala no Free Fire e manda **ID + senha** no chat.
6. Depois do X1: **`/resultado vencedor:@ganhador perdedor:@perdedor sala:12345678`**.
7. **`/ranking`** mostra a tabela.

---

## Estrutura do código

```
index.js               → liga o bot, registra comandos, roteia cliques
src/config.js          → configuração (token, host, cores, limites)
src/store.js           → salva/carrega o JSON (gravação atômica)
src/fila.js            → regras puras da fila (entrar, sair, próximos)
src/ranking.js         → cálculo de ranking a partir das partidas
src/panels.js          → painéis e embeds (botões com IDs fixos)
src/comandos.js        → definição e tratamento dos slash commands
src/componentes.js     → tratamento dos botões
testes/rodar.js        → 24 verificações offline (npm test)
```

Os módulos de regra (`fila.js`, `ranking.js`) não dependem do Discord, e `store.js` só conhece o
arquivo — por isso os testes rodam sem token e sem internet.

## Testar sem Discord

```bash
npm test
```

Roda fila, ranking, gravação/leitura do arquivo, montagem dos painéis, todos os comandos e todos os
botões com interações simuladas.

## Onde ficam os dados

`data/dados.json` (criado sozinho). Faça backup de vez em quando: é ele que tem o histórico e o
ranking. Se o arquivo for corrompido, o bot avisa, salva uma cópia `.quebrado-...` e começa vazio em
vez de travar.

## Deixar 24h online (opcional)

Funciona em qualquer host de Node.js: rode `npm install` e `npm start`. Não precisa de porta aberta
nem banco de dados. Em hospedagem por upload de ZIP, mande a pasta sem `node_modules` e sem `.env`
(suba o token como variável de ambiente do painel, ou inclua o `.env` apenas se o serviço exigir).

## Problemas comuns

| Problema | Solução |
|---|---|
| `Token não configurado` | Falta o `DISCORD_TOKEN` no `.env` |
| `O token do Discord é inválido` | Gere outro (Reset Token) e cole numa linha só |
| Comando não aparece | O bot precisa estar online; recarregue o Discord (Ctrl+R) |
| `Chamar host` diz que não tem host | Rode `/sethost cargo:@SeuCargo` |
| Ranking zerado depois de atualizar | Confira se `data/dados.json` está na mesma pasta de onde o bot roda |
| Bot cai ao fechar o Termux | Normal: sem hospedagem, ele só vive enquanto o processo roda |
