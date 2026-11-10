'use strict';

const { Client, GatewayIntentBits, Events, MessageFlags } = require('discord.js');

const config = require('./src/config');
const { Store } = require('./src/store');
const { comandos, executarComando } = require('./src/comandos');
const { handleBotao } = require('./src/componentes');

config.validarToken();

const store = new Store(config.ARQUIVO_DADOS).carregar();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async (cliente) => {
  console.log(`\n✅ Bot conectado como ${cliente.user.tag}`);
  console.log(`   Servidores: ${cliente.guilds.cache.size}`);
  console.log(`   Dados salvos em: ${config.ARQUIVO_DADOS}`);

  // Registra os comandos em cada servidor (funcionam na hora, sem esperar)
  for (const [guildId, guild] of cliente.guilds.cache) {
    for (const comando of comandos) {
      try {
        await cliente.application.commands.create(comando, guildId);
        console.log(`   /${comando.name} registrado em: ${guild.name}`);
      } catch (erro) {
        console.error(`   Falha ao registrar /${comando.name} em ${guild.name}:`, erro.message);
      }
    }
  }

  if (!config.HOST_CARGO_ID && !config.HOST_USUARIO_ID) {
    console.log('   Dica: configure o host com /sethost ou HOST_ROLE_ID no .env');
  }

  console.log('\nTudo pronto. Use /painelx1 no seu servidor.\n');
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      return await executarComando(interaction, store);
    }
    if (interaction.isButton()) {
      return await handleBotao(interaction, store);
    }
  } catch (erro) {
    console.error('Erro ao processar interação:', erro);
    const aviso = {
      content: '❌ Deu um erro ao processar isso. Tente de novo em instantes.',
      flags: MessageFlags.Ephemeral,
    };
    try {
      if (interaction.deferred || interaction.replied) await interaction.followUp(aviso);
      else await interaction.reply(aviso);
    } catch {
      /* interação já expirou */
    }
  }
});

client.on(Events.Error, (erro) => console.error('Erro no cliente:', erro));
process.on('unhandledRejection', (erro) => console.error('Promise sem tratamento:', erro));

// Salva o que estiver pendente antes de sair
for (const sinal of ['SIGINT', 'SIGTERM']) {
  process.on(sinal, () => {
    store.gravar();
    console.log('\nDados salvos. Até mais!');
    process.exit(0);
  });
}

client.login(config.TOKEN).catch((erro) => {
  if (erro?.code === 'TokenInvalid' || /invalid token/i.test(erro?.message ?? '')) {
    console.error('\n[ERRO] O token do Discord é inválido.');
    console.error('Gere outro em discord.com/developers/applications → seu app → Bot → Reset Token');
    console.error('e cole de novo no .env (sem espaços, numa linha só).\n');
  } else {
    console.error('\n[ERRO] Não consegui conectar ao Discord:', erro?.message ?? erro);
    console.error('Confira sua internet e tente de novo.\n');
  }
  process.exit(1);
});
