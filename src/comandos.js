'use strict';

const {
  SlashCommandBuilder,
  PermissionsBitField,
  MessageFlags,
} = require('discord.js');

const { JOGADORES_POR_X1 } = require('./config');
const filaRegras = require('./fila');
const rankingRegras = require('./ranking');
const panels = require('./panels');

// ---------- definição dos comandos ----------

const comandos = [
  new SlashCommandBuilder()
    .setName('painelx1')
    .setDescription('Publica o painel da fila X1 com os botões')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageChannels)
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName('fila')
    .setDescription('Mostra quem está na fila agora')
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName('ranking')
    .setDescription('Mostra o ranking de X1 do servidor')
    .setDMPermission(false)
    .addIntegerOption((opt) =>
      opt
        .setName('quantos')
        .setDescription('Quantos jogadores mostrar (5 a 25, padrão 10)')
        .setRequired(false)
        .setMinValue(5)
        .setMaxValue(25),
    ),

  new SlashCommandBuilder()
    .setName('resultado')
    .setDescription('Registra o resultado de um X1 (quem ganhou e quem perdeu)')
    .setDMPermission(false)
    .addUserOption((opt) =>
      opt.setName('vencedor').setDescription('Quem ganhou o X1').setRequired(true),
    )
    .addUserOption((opt) =>
      opt.setName('perdedor').setDescription('Quem perdeu o X1').setRequired(true),
    )
    .addStringOption((opt) =>
      opt.setName('sala').setDescription('ID da sala (opcional, fica no histórico)').setRequired(false).setMaxLength(20),
    ),

  new SlashCommandBuilder()
    .setName('sethost')
    .setDescription('Define quem o bot chama quando alguém pede sala (cargo ou usuário)')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
    .setDMPermission(false)
    .addRoleOption((opt) => opt.setName('cargo').setDescription('Cargo do host/mediador').setRequired(false))
    .addUserOption((opt) => opt.setName('usuario').setDescription('Uma pessoa específica').setRequired(false)),

  new SlashCommandBuilder()
    .setName('limparfila')
    .setDescription('Esvazia a fila (não apaga o histórico de partidas)')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageChannels)
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName('ajuda')
    .setDescription('Explica como o bot de X1 funciona')
    .setDMPermission(false),
].map((comando) => comando.toJSON());

// ---------- permissões ----------

function ehStaff(interaction) {
  return Boolean(
    interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageChannels) ||
      interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild),
  );
}

function ehHost(interaction, host) {
  if (!host) return false;
  if (host.userId && host.userId === interaction.user.id) return true;
  if (host.roleId && interaction.member?.roles?.cache?.has?.(host.roleId)) return true;
  return false;
}

function podeRegistrarResultado(interaction, host) {
  return ehStaff(interaction) || ehHost(interaction, host);
}

// ---------- handlers ----------

async function handlePainelX1(interaction, store) {
  if (!interaction.guild) {
    return interaction.reply({ content: 'Este comando só funciona dentro de um servidor.', flags: MessageFlags.Ephemeral });
  }
  if (!ehStaff(interaction)) {
    return interaction.reply({
      content: '❌ Você precisa da permissão **Gerenciar Canais** para publicar o painel.',
      flags: MessageFlags.Ephemeral,
    });
  }

  const fila = store.fila(interaction.guild.id);
  const host = store.host(interaction.guild.id);
  return interaction.reply(panels.painelFila(fila, host));
}

async function handleFila(interaction, store) {
  const fila = store.fila(interaction.guild.id);
  const host = store.host(interaction.guild.id);
  return interaction.reply({ ...panels.painelFila(fila, host), flags: MessageFlags.Ephemeral });
}

async function handleRanking(interaction, store) {
  const limite = interaction.options?.getInteger('quantos') || 10;
  const partidas = store.partidas(interaction.guild.id);
  return interaction.reply(panels.painelRanking(partidas, limite));
}

async function handleResultado(interaction, store) {
  if (!interaction.guild) {
    return interaction.reply({ content: 'Este comando só funciona dentro de um servidor.', flags: MessageFlags.Ephemeral });
  }

  const host = store.host(interaction.guild.id);
  if (!podeRegistrarResultado(interaction, host)) {
    return interaction.reply({
      content: '❌ Só o **host** (definido com `/sethost`) ou a equipe com **Gerenciar Canais** pode registrar resultado.',
      flags: MessageFlags.Ephemeral,
    });
  }

  const vencedor = interaction.options.getUser('vencedor');
  const perdedor = interaction.options.getUser('perdedor');
  const salaId = interaction.options.getString('sala') || null;

  if (!vencedor || !perdedor) {
    return interaction.reply({ content: 'Escolha o vencedor e o perdedor.', flags: MessageFlags.Ephemeral });
  }
  if (vencedor.id === perdedor.id) {
    return interaction.reply({ content: '❌ O vencedor e o perdedor precisam ser jogadores diferentes.', flags: MessageFlags.Ephemeral });
  }
  if (vencedor.bot || perdedor.bot) {
    return interaction.reply({ content: '❌ Bot não entra em ranking.', flags: MessageFlags.Ephemeral });
  }

  const fila = store.fila(interaction.guild.id);
  filaRegras.remover(fila, [vencedor.id, perdedor.id]);

  store.registrarPartida({
    guildId: interaction.guild.id,
    vencedorId: vencedor.id,
    perdedorId: perdedor.id,
    hostId: interaction.user.id,
    salaId,
    registradoPor: interaction.user.id,
  });

  const partidas = store.partidas(interaction.guild.id);
  const ranking = rankingRegras.calcular(partidas);
  const statsVencedor = ranking.find((j) => j.userId === vencedor.id) || { vitorias: 1, derrotas: 0, partidas: 1 };
  const statsPerdedor = ranking.find((j) => j.userId === perdedor.id) || { vitorias: 0, derrotas: 1, partidas: 1 };
  const posicao = ranking.findIndex((j) => j.userId === vencedor.id) + 1;

  return interaction.reply({
    embeds: [
      panels.embedResultado({
        vencedorMencao: `<@${vencedor.id}>`,
        perdedorMencao: `<@${perdedor.id}>`,
        salaId,
        statsVencedor,
        statsPerdedor,
        posicaoVencedor: posicao || null,
        totalPartidas: partidas.length,
      }),
    ],
  });
}

async function handleSetHost(interaction, store) {
  if (!interaction.guild) {
    return interaction.reply({ content: 'Este comando só funciona dentro de um servidor.', flags: MessageFlags.Ephemeral });
  }
  if (!ehStaff(interaction)) {
    return interaction.reply({
      content: '❌ Você precisa da permissão **Gerenciar Servidor** para definir o host.',
      flags: MessageFlags.Ephemeral,
    });
  }

  const cargo = interaction.options.getRole('cargo');
  const usuario = interaction.options.getUser('usuario');

  if (!cargo && !usuario) {
    return interaction.reply({
      content: 'Escolha pelo menos um: `cargo:` (recomendado) ou `usuario:`.',
      flags: MessageFlags.Ephemeral,
    });
  }
  if (cargo && usuario) {
    return interaction.reply({
      content: 'Escolha **só um**: cargo **ou** usuário (o cargo é melhor, porque vale pra equipe toda).',
      flags: MessageFlags.Ephemeral,
    });
  }

  store.definirHost(interaction.guild.id, {
    roleId: cargo ? cargo.id : null,
    userId: usuario ? usuario.id : null,
  });

  return interaction.reply({
    content: `✅ Host configurado: ${cargo ? `<@&${cargo.id}>` : `<@${usuario.id}>`}.\nAgora o botão **Chamar host** marca essa pessoa.`,
    flags: MessageFlags.Ephemeral,
  });
}

async function handleLimparFila(interaction, store) {
  if (!ehStaff(interaction)) {
    return interaction.reply({
      content: '❌ Você precisa da permissão **Gerenciar Canais** para limpar a fila.',
      flags: MessageFlags.Ephemeral,
    });
  }

  const fila = store.fila(interaction.guild.id);
  const quantidade = fila.entradas.length;
  filaRegras.limpar(fila);
  store.salvar();

  return interaction.reply({
    content: `🧹 Fila limpa. ${quantidade} jogador(es) saíram da fila. O ranking não foi afetado.`,
  });
}

async function handleAjuda(interaction) {
  return interaction.reply({
    embeds: [
      {
        color: 0x5865f2,
        title: '📖 Como usar o bot de X1',
        description: [
          '**1.** Staff publica o painel com `/painelx1`.',
          '**2.** Jogador clica em **Entrar na fila**.',
          '**3.** Quando tiver 2 na fila, alguém clica em **Chamar host** — o bot marca o host e mostra o confronto.',
          '**4.** O host cria a sala no Free Fire (AP) e passa ID e senha no chat.',
          `**5.** Depois do X1, o host registra com \`/resultado vencedor:@x perdedor:@y sala:12345678\`.`,
          '',
          '**Comandos:**',
          '`/painelx1` — publica o painel (staff)',
          '`/fila` — vê a fila atual',
          '`/ranking` — tabela de vitórias',
          '`/resultado` — registra X1 (host/staff)',
          '`/sethost` — define cargo/usuário que será chamado (staff)',
          '`/limparfila` — zera a fila (staff)',
          '',
          `Cada X1 usa ${JOGADORES_POR_X1} jogadores. O ranking fica salvo em arquivo e não se perde quando o bot reinicia.`,
        ].join('\n'),
      },
    ],
    flags: MessageFlags.Ephemeral,
  });
}

const handlers = {
  painelx1: handlePainelX1,
  fila: handleFila,
  ranking: handleRanking,
  resultado: handleResultado,
  sethost: handleSetHost,
  limparfila: handleLimparFila,
  ajuda: handleAjuda,
};

async function executarComando(interaction, store) {
  const handler = handlers[interaction.commandName];
  if (!handler) return;
  return handler(interaction, store);
}

module.exports = { comandos, executarComando, ehStaff, ehHost, podeRegistrarResultado };
