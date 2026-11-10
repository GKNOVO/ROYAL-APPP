'use strict';

/**
 * Testes sem precisar de internet nem token:
 *   node testes/rodar.js
 *
 * Cobre as regras da fila, o ranking, a persistência em arquivo, os painéis,
 * os comandos e os botões (com interações simuladas).
 */

process.env.DISCORD_TOKEN = 'token-de-teste';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { PermissionsBitField } = require('discord.js');

const filaRegras = require('../src/fila');
const rankingRegras = require('../src/ranking');
const { Store } = require('../src/store');
const panels = require('../src/panels');
const { executarComando, comandos } = require('../src/comandos');
const { handleBotao } = require('../src/componentes');

const MANAGE_CHANNELS = PermissionsBitField.Flags.ManageChannels;

let ok = 0;
function passar(texto) {
  ok += 1;
  console.log(`OK  ${texto}`);
}

function fakeGuild(id = 'g1') {
  return { id, name: 'Servidor Teste' };
}

function fakeInteraction({ commandName, customId, userId = 'u1', guild = fakeGuild(), options = {}, perms = [], roles = [] } = {}) {
  const chamadas = {};
  const interaction = {
    commandName,
    customId,
    user: { id: userId, bot: false, username: `user-${userId}` },
    guild,
    guildId: guild?.id,
    channelId: 'canal-1',
    memberPermissions: { has: (flag) => perms.includes(flag) },
    member: { roles: { cache: { has: (id) => roles.includes(id) } } },
    options: {
      getUser: (nome) => options[nome] ?? null,
      getString: (nome) => options[nome] ?? null,
      getInteger: (nome) => options[nome] ?? null,
      getRole: (nome) => options[nome] ?? null,
    },
    chamadas,
    async reply(payload) {
      chamadas.reply = payload;
      return payload;
    },
    async update(payload) {
      chamadas.update = payload;
      return payload;
    },
    async deferReply(payload) {
      chamadas.deferred = payload ?? true;
    },
    async editReply(payload) {
      chamadas.edit = payload;
      return payload;
    },
    async followUp(payload) {
      chamadas.followUp = payload;
    },
    replied: false,
    deferred: false,
  };
  return interaction;
}

function idsDosBotoes(payload) {
  return payload.components[0].toJSON().components.map((b) => b.custom_id);
}

function novosDados() {
  return {
    entradas: [],
    chamadoEm: null,
    chamadoPor: null,
  };
}

(async () => {
  // ---------------- fila ----------------
  {
    const fila = novosDados();
    assert.deepStrictEqual(filaRegras.entrar(fila, 'a'), { ok: true, posicao: 1 });
    passar('fila: primeiro jogador entra na posição 1');

    const repetido = filaRegras.entrar(fila, 'a');
    assert.strictEqual(repetido.ok, false);
    assert.strictEqual(repetido.posicao, 1);
    passar('fila: ninguém entra duas vezes');

    filaRegras.entrar(fila, 'b');
    filaRegras.entrar(fila, 'c');
    assert.deepStrictEqual(filaRegras.proximos(fila, 2), ['a', 'b']);
    assert.strictEqual(filaRegras.temX1Pronto(fila), true);
    assert.strictEqual(filaRegras.posicao(fila, 'c'), 3);
    passar('fila: ordem correta e X1 fechado com 2 jogadores');

    assert.strictEqual(filaRegras.sair(fila, 'nao-existe').ok, false);
    assert.strictEqual(filaRegras.sair(fila, 'c').ok, true);
    assert.strictEqual(filaRegras.remover(fila, ['a', 'b']), 2);
    assert.strictEqual(fila.entradas.length, 0);
    assert.strictEqual(filaRegras.temX1Pronto(fila), false);

    filaRegras.entrar(fila, 'd');
    filaRegras.limpar(fila);
    assert.strictEqual(fila.entradas.length, 0);
    assert.strictEqual(fila.chamadoEm, null);
    passar('fila: sair, remover após resultado e limpar');
  }

  // ---------------- ranking ----------------
  {
    const partidas = [
      { vencedorId: 'a', perdedorId: 'b', criadoEm: '2026-01-01T10:00:00.000Z' },
      { vencedorId: 'b', perdedorId: 'a', criadoEm: '2026-01-02T10:00:00.000Z' },
      { vencedorId: 'a', perdedorId: 'c', criadoEm: '2026-01-03T10:00:00.000Z' },
    ];
    const ranking = rankingRegras.calcular(partidas);

    assert.strictEqual(ranking[0].userId, 'a');
    assert.strictEqual(ranking[0].vitorias, 2);
    assert.strictEqual(ranking[0].derrotas, 1);
    assert.strictEqual(ranking[0].partidas, 3);
    assert.strictEqual(rankingRegras.percentual(ranking[0]), '67%');
    assert.strictEqual(ranking[1].userId, 'b');
    assert.strictEqual(ranking[2].userId, 'c');
    passar('ranking: ordem por vitórias, contagem e aproveitamento');

    // sequência: 3 vitórias seguidas
    const seguidas = [
      { vencedorId: 'z', perdedorId: 'y', criadoEm: '2026-02-01T10:00:00.000Z' },
      { vencedorId: 'z', perdedorId: 'y', criadoEm: '2026-02-02T10:00:00.000Z' },
      { vencedorId: 'z', perdedorId: 'y', criadoEm: '2026-02-03T10:00:00.000Z' },
      { vencedorId: 'y', perdedorId: 'z', criadoEm: '2026-02-04T10:00:00.000Z' },
    ];
    const ranking2 = rankingRegras.calcular(seguidas);
    const z = ranking2.find((j) => j.userId === 'z');
    assert.strictEqual(z.melhorSequencia, 3);
    assert.strictEqual(z.sequencia, 0, 'perdeu a última, então a sequência atual zera');
    passar('ranking: melhor sequência guardada e sequência atual zerada ao perder');

    assert.deepStrictEqual(rankingRegras.calcular([]), []);
    assert.strictEqual(rankingRegras.posicaoDe([], 'ninguem'), null);
    passar('ranking: aguenta histórico vazio');
  }

  // ---------------- persistência ----------------
  {
    const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'bot-x1-'));
    const arquivo = path.join(pasta, 'dados.json');

    const store = new Store(arquivo).carregar();
    filaRegras.entrar(store.fila('g1'), 'u1');
    store.registrarPartida({ guildId: 'g1', vencedorId: 'u1', perdedorId: 'u2', salaId: '12345678' });
    store.definirHost('g1', { roleId: 'cargo-host' });
    store.gravar();

    const relido = new Store(arquivo).carregar();
    assert.strictEqual(relido.fila('g1').entradas.length, 1);
    assert.strictEqual(relido.partidas('g1').length, 1);
    assert.strictEqual(relido.partidas('g1')[0].salaId, '12345678');
    assert.strictEqual(relido.host('g1').roleId, 'cargo-host');
    passar('dados: fila, partida e host sobrevivem ao reinício do bot');

    assert.ok(fs.existsSync(arquivo));
    const conteudo = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
    assert.strictEqual(conteudo.partidas.length, 1);
    passar('dados: arquivo JSON gravado no formato esperado');

    fs.writeFileSync(arquivo, '{ isso não é json');
    const quebrado = new Store(arquivo).carregar();
    assert.strictEqual(quebrado.partidas('g1').length, 0);
    const copias = fs.readdirSync(pasta).filter((n) => n.includes('quebrado'));
    assert.strictEqual(copias.length, 1);
    passar('dados: arquivo corrompido não derruba o bot e é copiado');

    fs.rmSync(pasta, { recursive: true, force: true });
  }

  // ---------------- painéis ----------------
  {
    const fila = novosDados();
    filaRegras.entrar(fila, 'u1');
    filaRegras.entrar(fila, 'u2');
    const painel = panels.painelFila(fila, { roleId: 'cargo-host', userId: null });

    assert.deepStrictEqual(idsDosBotoes(painel), [
      'x1:entrar',
      'x1:sair',
      'x1:atualizar',
      'x1:host',
      'x1:ranking',
    ]);
    const embed = painel.embeds[0].toJSON();
    assert.ok(embed.description.includes('<@u1>'));
    const campos = Object.fromEntries(embed.fields.map((f) => [f.name, f.value]));
    assert.strictEqual(campos['Próximo X1'], '<@u1> **vs** <@u2>');
    assert.strictEqual(campos['Host da sala'], '<@&cargo-host>');
    passar('painel: 5 botões com IDs fixos, fila e confronto na tela');

    const vazio = panels.painelFila(novosDados(), null);
    const embedVazio = vazio.embeds[0].toJSON();
    assert.ok(embedVazio.description.includes('Fila vazia'));
    const camposVazio = Object.fromEntries(embedVazio.fields.map((f) => [f.name, f.value]));
    assert.ok(camposVazio['Próximo X1'].includes('Faltando jogadores'));
    assert.ok(camposVazio['Host da sala'].includes('ninguém configurado'));
    passar('painel: fila vazia e host não configurado tratados');

    const partidas = [
      { vencedorId: 'a', perdedorId: 'b', criadoEm: '2026-01-01T10:00:00.000Z' },
      { vencedorId: 'a', perdedorId: 'c', criadoEm: '2026-01-02T10:00:00.000Z' },
    ];
    const ranking = panels.painelRanking(partidas, 10);
    const rankingEmbed = ranking.embeds[0].toJSON();
    assert.ok(rankingEmbed.description.includes('🥇'));
    assert.ok(rankingEmbed.description.includes('2V'));
    const rankingVazio = panels.painelRanking([], 10).embeds[0].toJSON();
    assert.ok(rankingVazio.description.includes('Ainda não'));
    passar('painel: ranking com medalhas e aviso quando não há partidas');
  }

  // ---------------- comandos ----------------
  {
    const store = new Store(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bot-x1-cmd-')), 'd.json')).carregar();

    assert.strictEqual(comandos.length, 7);
    const resultado = comandos.find((c) => c.name === 'resultado');
    assert.deepStrictEqual(
      resultado.options.filter((o) => o.required).map((o) => o.name),
      ['vencedor', 'perdedor'],
    );
    passar('comandos: 7 registrados e /resultado exige vencedor e perdedor');

    // /painelx1 sem permissão
    let it = fakeInteraction({ commandName: 'painelx1' });
    await executarComando(it, store);
    assert.ok(it.chamadas.reply.content.includes('Gerenciar Canais'));
    passar('/painelx1: bloqueia quem não é staff');

    // /painelx1 com permissão
    it = fakeInteraction({ commandName: 'painelx1', perms: [MANAGE_CHANNELS] });
    await executarComando(it, store);
    assert.strictEqual(it.chamadas.reply.components.length, 1);
    passar('/painelx1: publica o painel para staff');

    // /resultado sem permissão
    it = fakeInteraction({
      commandName: 'resultado',
      options: { vencedor: { id: 'u1' }, perdedor: { id: 'u2' } },
    });
    await executarComando(it, store);
    assert.ok(it.chamadas.reply.content.includes('Só o **host**'));
    passar('/resultado: bloqueia quem não é host nem staff');

    // /resultado com permissão
    filaRegras.entrar(store.fila('g1'), 'u1');
    filaRegras.entrar(store.fila('g1'), 'u2');
    it = fakeInteraction({
      commandName: 'resultado',
      perms: [MANAGE_CHANNELS],
      options: { vencedor: { id: 'u1' }, perdedor: { id: 'u2' }, sala: '12345678' },
    });
    await executarComando(it, store);
    assert.ok(it.chamadas.reply.embeds);
    const embed = it.chamadas.reply.embeds[0].toJSON();
    assert.ok(embed.description.includes('<@u1>') && embed.description.includes('12345678'));
    assert.strictEqual(store.partidas('g1').length, 1);
    assert.strictEqual(store.fila('g1').entradas.length, 0, 'os dois saem da fila');
    passar('/resultado: registra, mostra estatísticas e tira os dois da fila');

    // mesmo jogador duas vezes
    it = fakeInteraction({
      commandName: 'resultado',
      perms: [MANAGE_CHANNELS],
      options: { vencedor: { id: 'u1' }, perdedor: { id: 'u1' } },
    });
    await executarComando(it, store);
    assert.ok(it.chamadas.reply.content.includes('jogadores diferentes'));
    assert.strictEqual(store.partidas('g1').length, 1);
    passar('/resultado: recusa vencedor e perdedor iguais');

    // host via cargo pode registrar
    store.definirHost('g1', { roleId: 'cargo-host' });
    it = fakeInteraction({
      commandName: 'resultado',
      roles: ['cargo-host'],
      options: { vencedor: { id: 'u3' }, perdedor: { id: 'u4' } },
    });
    await executarComando(it, store);
    assert.strictEqual(store.partidas('g1').length, 2);
    passar('/resultado: host com o cargo certo consegue registrar');

    // /sethost
    it = fakeInteraction({
      commandName: 'sethost',
      perms: [PermissionsBitField.Flags.ManageGuild],
      options: { cargo: { id: 'cargo-novo' } },
    });
    await executarComando(it, store);
    assert.strictEqual(store.host('g1').roleId, 'cargo-novo');
    assert.ok(it.chamadas.reply.content.includes('cargo-novo'));
    passar('/sethost: salva o cargo do host');

    it = fakeInteraction({
      commandName: 'sethost',
      perms: [PermissionsBitField.Flags.ManageGuild],
      options: { cargo: { id: 'c1' }, usuario: { id: 'u9' } },
    });
    await executarComando(it, store);
    assert.ok(it.chamadas.reply.content.includes('só um'));
    passar('/sethost: recusa cargo e usuário ao mesmo tempo');

    // /fila e /ranking
    filaRegras.entrar(store.fila('g1'), 'u7');
    it = fakeInteraction({ commandName: 'fila' });
    await executarComando(it, store);
    assert.ok(it.chamadas.reply.embeds[0].toJSON().description.includes('<@u7>'));
    passar('/fila: mostra a fila para quem pediu');

    it = fakeInteraction({ commandName: 'ranking', options: { quantos: 5 } });
    await executarComando(it, store);
    assert.ok(it.chamadas.reply.embeds[0].toJSON().description.includes('🥇'));
    passar('/ranking: responde com a tabela');

    // /limparfila
    it = fakeInteraction({ commandName: 'limparfila', perms: [MANAGE_CHANNELS] });
    await executarComando(it, store);
    assert.strictEqual(store.fila('g1').entradas.length, 0);
    passar('/limparfila: esvazia a fila sem apagar partidas');

    // /ajuda
    it = fakeInteraction({ commandName: 'ajuda' });
    await executarComando(it, store);
    assert.ok(it.chamadas.reply.embeds[0].description.includes('/painelx1'));
    passar('/ajuda: lista os comandos');
  }

  // ---------------- botões ----------------
  {
    const store = new Store(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bot-x1-btn-')), 'd.json')).carregar();

    // entrar
    let it = fakeInteraction({ customId: 'x1:entrar' });
    assert.strictEqual(await handleBotao(it, store), true);
    assert.strictEqual(store.fila('g1').entradas.length, 1);
    assert.ok(it.chamadas.update.components.length === 1);
    passar('botão: entrar coloca na fila e atualiza o painel');

    // entrar de novo
    it = fakeInteraction({ customId: 'x1:entrar' });
    await handleBotao(it, store);
    assert.ok(it.chamadas.reply.content.includes('já está na fila'));
    assert.strictEqual(store.fila('g1').entradas.length, 1);
    passar('botão: avisa quem já está na fila');

    // chamar host sem host configurado
    it = fakeInteraction({ customId: 'x1:host' });
    await handleBotao(it, store);
    assert.ok(it.chamadas.reply.content.includes('/sethost'));
    passar('botão: chamar host avisa quando não tem host configurado');

    // com host, mas fila incompleta
    store.definirHost('g1', { roleId: 'cargo-host' });
    it = fakeInteraction({ customId: 'x1:host' });
    await handleBotao(it, store);
    assert.ok(it.chamadas.reply.content.includes('Ainda não fechou X1'));
    passar('botão: não chama host sem 2 jogadores');

    // fecha o X1 e chama o host
    store.fila('g1').entradas.push({ userId: 'u2', entrouEm: Date.now() });
    it = fakeInteraction({ customId: 'x1:host' });
    await handleBotao(it, store);
    assert.ok(it.chamadas.reply.content.includes('<@&cargo-host>'));
    assert.ok(it.chamadas.reply.content.includes('<@u1> vs <@u2>'));
    assert.ok(store.fila('g1').chamadoEm > 0);
    assert.deepStrictEqual(it.chamadas.reply.allowedMentions, { parse: ['roles', 'users'] });
    passar('botão: chama o cargo do host com o confronto certo');

    // cooldown
    it = fakeInteraction({ customId: 'x1:host' });
    await handleBotao(it, store);
    assert.ok(it.chamadas.reply.content.includes('Espere'));
    passar('botão: respeita o tempo entre chamadas (anti-flood)');

    // atualizar / ranking / sair
    it = fakeInteraction({ customId: 'x1:atualizar' });
    await handleBotao(it, store);
    assert.ok(it.chamadas.update.embeds);
    it = fakeInteraction({ customId: 'x1:ranking' });
    await handleBotao(it, store);
    assert.ok(it.chamadas.reply.embeds);
    it = fakeInteraction({ customId: 'x1:sair' });
    await handleBotao(it, store);
    assert.strictEqual(store.fila('g1').entradas.length, 1);
    assert.ok(it.chamadas.update.embeds);
    passar('botão: atualizar, ranking e sair funcionam');

    // clique em botão de outro bot é ignorado
    it = fakeInteraction({ customId: 'canal:select' });
    assert.strictEqual(await handleBotao(it, store), false);
    passar('botão: ignora cliques que não são deste bot');
  }

  console.log(`\n${ok} verificações · TODOS OS TESTES PASSARAM`);
})().catch((erro) => {
  console.error('\nFALHOU:', erro.message);
  console.error(erro.stack);
  process.exit(1);
});
