'use strict';

const { MessageFlags } = require('discord.js');
const { COOLDOWN_HOST_MS, JOGADORES_POR_X1 } = require('./config');
const filaRegras = require('./fila');
const panels = require('./panels');

function mencaoHost(host) {
  if (!host) return null;
  if (host.roleId) return `<@&${host.roleId}>`;
  if (host.userId) return `<@${host.userId}>`;
  return null;
}

/**
 * Trata os botões do painel da fila.
 * Os IDs são fixos (x1:entrar, x1:sair...), então o painel continua válido
 * mesmo depois de reiniciar o bot.
 */
async function handleBotao(interaction, store) {
  const id = interaction.customId;
  if (!id?.startsWith('x1:')) return false;

  if (!interaction.guild) {
    await interaction.reply({
      content: 'Isso só funciona dentro de um servidor.',
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  const guildId = interaction.guild.id;
  const fila = store.fila(guildId);
  const host = store.host(guildId);

  // ---- entrar na fila ----
  if (id === panels.BOTOES.entrar) {
    const resultado = filaRegras.entrar(fila, interaction.user.id);
    store.salvar();

    if (!resultado.ok) {
      await interaction.reply({
        content: `⚠️ ${resultado.motivo} Você está na posição **${resultado.posicao}**.`,
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    await interaction.update(panels.painelFila(fila, host));
    return true;
  }

  // ---- sair da fila ----
  if (id === panels.BOTOES.sair) {
    const resultado = filaRegras.sair(fila, interaction.user.id);
    store.salvar();

    if (!resultado.ok) {
      await interaction.reply({ content: `⚠️ ${resultado.motivo}`, flags: MessageFlags.Ephemeral });
      return true;
    }

    await interaction.update(panels.painelFila(fila, host));
    return true;
  }

  // ---- atualizar painel ----
  if (id === panels.BOTOES.atualizar) {
    await interaction.update(panels.painelFila(fila, host));
    return true;
  }

  // ---- ranking ----
  if (id === panels.BOTOES.ranking) {
    const partidas = store.partidas(guildId);
    await interaction.reply({ ...panels.painelRanking(partidas, 10), flags: MessageFlags.Ephemeral });
    return true;
  }

  // ---- chamar host ----
  if (id === panels.BOTOES.host) {
    const mencao = mencaoHost(host);

    if (!mencao) {
      await interaction.reply({
        content: '⚙️ Ainda não tem host configurado. Um administrador precisa usar `/sethost cargo:@Host` (ou `usuario:@fulano`).',
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    if (!filaRegras.temX1Pronto(fila, JOGADORES_POR_X1)) {
      await interaction.reply({
        content: `⏳ Ainda não fechou X1: precisa de **${JOGADORES_POR_X1}** jogadores na fila e tem ${fila.entradas.length}.`,
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    const desde = filaRegras.esperaDesdeChamada(fila);
    if (desde !== null && desde < COOLDOWN_HOST_MS) {
      const faltam = Math.ceil((COOLDOWN_HOST_MS - desde) / 1000);
      await interaction.reply({
        content: `⏳ O host já foi chamado agora. Espere **${faltam}s** para chamar de novo.`,
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    const [jogadorA, jogadorB] = filaRegras.proximos(fila, JOGADORES_POR_X1);
    fila.chamadoEm = Date.now();
    fila.chamadoPor = interaction.user.id;
    store.salvar();

    await interaction.reply({
      content: [
        `📣 ${mencao} — **sala pedida!**`,
        '',
        `**X1:** <@${jogadorA}> vs <@${jogadorB}>`,
        `**Pedido por:** <@${interaction.user.id}>`,
        '',
        'Crie a sala no Free Fire e mande aqui o **ID** e a **senha**.',
        'Depois do X1, registre com `/resultado`.',
      ].join('\n'),
      allowedMentions: { parse: ['roles', 'users'] },
    });
    return true;
  }

  return false;
}

module.exports = { handleBotao, mencaoHost };
