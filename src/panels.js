'use strict';

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { COR, COR_OK, JOGADORES_POR_X1, TAMANHO_MAX_FILA } = require('./config');
const filaRegras = require('./fila');
const rankingRegras = require('./ranking');

// IDs fixos dos botões: o painel continua funcionando mesmo depois de reiniciar o bot.
const BOTOES = {
  entrar: 'x1:entrar',
  sair: 'x1:sair',
  atualizar: 'x1:atualizar',
  host: 'x1:host',
  ranking: 'x1:ranking',
};

function textoHost(host) {
  if (!host) return '_ninguém configurado ainda_';
  if (host.roleId) return `<@&${host.roleId}>`;
  if (host.userId) return `<@${host.userId}>`;
  return '_ninguém configurado ainda_';
}

function listaDaFila(fila) {
  if (fila.entradas.length === 0) return '_Fila vazia. Clique em **Entrar na fila**._';
  return fila.entradas
    .map((entrada, indice) => `**${indice + 1}.** <@${entrada.userId}>`)
    .join('\n');
}

function textoDoX1(fila) {
  const [primeiro, segundo] = filaRegras.proximos(fila, JOGADORES_POR_X1);
  if (!primeiro || !segundo) return '_Faltando jogadores para fechar um X1._';
  return `<@${primeiro}> **vs** <@${segundo}>`;
}

/** Painel principal da fila (mensagem pública, com botões fixos). */
function painelFila(fila, host) {
  const embed = new EmbedBuilder()
    .setColor(COR)
    .setTitle('🎮 Fila X1 · Free Fire AP')
    .setDescription(
      [
        `**Na fila:** ${fila.entradas.length}`,
        '',
        listaDaFila(fila),
      ].join('\n'),
    )
    .addFields(
      { name: 'Próximo X1', value: textoDoX1(fila), inline: false },
      { name: 'Host da sala', value: textoHost(host), inline: true },
      { name: 'Como funciona', value: '1️⃣ Entre na fila\n2️⃣ Chame o host\n3️⃣ Ele cria a sala no jogo\n4️⃣ Quem ganhar registra o resultado', inline: false },
    )
    .setFooter({ text: 'Use /resultado para registrar a partida · /ranking para ver a tabela' });

  const botoes = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(BOTOES.entrar)
      .setLabel('Entrar na fila')
      .setStyle(ButtonStyle.Success)
      .setDisabled(fila.entradas.length >= TAMANHO_MAX_FILA),
    new ButtonBuilder()
      .setCustomId(BOTOES.sair)
      .setLabel('Sair da fila')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(BOTOES.atualizar)
      .setLabel('Atualizar')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(BOTOES.host)
      .setLabel('Chamar host')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(BOTOES.ranking)
      .setLabel('Ranking')
      .setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [botoes] };
}

const MEDALHAS = ['🥇', '🥈', '🥉'];

/** Embed do ranking (top X). */
function painelRanking(partidas, limite = 10) {
  const lista = rankingRegras.top(partidas, limite);

  if (lista.length === 0) {
    return {
      embeds: [
        new EmbedBuilder()
          .setColor(COR)
          .setTitle('🏆 Ranking X1 · Free Fire AP')
          .setDescription('Ainda não tem nenhuma partida registrada.\nUse `/resultado` depois do primeiro X1.'),
      ],
      components: [],
    };
  }

  const linhas = lista.map((jogador, indice) => {
    const medalha = MEDALHAS[indice] ?? `**${indice + 1}.**`;
    const sequencia = jogador.sequencia > 1 ? ` · 🔥 ${jogador.sequencia} seguidas` : '';
    return `${medalha} <@${jogador.userId}> — **${jogador.vitorias}V** / ${jogador.derrotas}D · ${rankingRegras.percentual(jogador)}${sequencia}`;
  });

  return {
    embeds: [
      new EmbedBuilder()
        .setColor(COR)
        .setTitle('🏆 Ranking X1 · Free Fire AP')
        .setDescription(linhas.join('\n'))
        .setFooter({ text: `${partidas.length} partida(s) registrada(s) · V = vitórias · D = derrotas` }),
    ],
    components: [],
  };
}

/** Embed mostrado logo depois de registrar um resultado. */
function embedResultado({ vencedorMencao, perdedorMencao, salaId, statsVencedor, statsPerdedor, posicaoVencedor, totalPartidas }) {
  return new EmbedBuilder()
    .setColor(COR_OK)
    .setTitle('✅ Resultado registrado')
    .setDescription(`${vencedorMencao} venceu ${perdedorMencao}${salaId ? `\nSala: \`${salaId}\`` : ''}`)
    .addFields(
      {
        name: 'Vencedor',
        value: `${vencedorMencao}\n${statsVencedor.vitorias}V / ${statsVencedor.derrotas}D · ${rankingRegras.percentual(statsVencedor)}${posicaoVencedor ? ` · #${posicaoVencedor} no ranking` : ''}`,
        inline: true,
      },
      {
        name: 'Perdedor',
        value: `${perdedorMencao}\n${statsPerdedor.vitorias}V / ${statsPerdedor.derrotas}D · ${rankingRegras.percentual(statsPerdedor)}`,
        inline: true,
      },
      { name: 'Total no servidor', value: `${totalPartidas} partida(s)`, inline: false },
    );
}

module.exports = {
  BOTOES,
  painelFila,
  painelRanking,
  embedResultado,
  textoDoX1,
  listaDaFila,
  textoHost,
};
