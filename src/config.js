'use strict';

require('dotenv').config();

const PLACEHOLDER = 'COLE_SEU_TOKEN_AQUI';

const config = {
  PLACEHOLDER,
  TOKEN: String(process.env.DISCORD_TOKEN || '').trim(),

  // Onde as filas, partidas e ranking ficam salvos
  ARQUIVO_DADOS: process.env.DATA_FILE || 'data/dados.json',

  // Quem o bot chama quando alguém clica em "Chamar host".
  // Pode ser um cargo (recomendado) ou um usuário específico.
  HOST_CARGO_ID: String(process.env.HOST_ROLE_ID || '').trim() || null,
  HOST_USUARIO_ID: String(process.env.HOST_USUARIO_ID || '').trim() || null,

  // Tempo mínimo entre duas chamadas de host (ms)
  COOLDOWN_HOST_MS: Number(process.env.COOLDOWN_HOST_MS || 60000),

  // Quantos jogadores por X1
  JOGADORES_POR_X1: 2,

  // Limite de segurança da fila
  TAMANHO_MAX_FILA: 50,

  COR: 0xf1c40f,
  COR_OK: 0x2ecc71,
  COR_ERRO: 0xe74c3c,
  COR_NEUTRO: 0x5865f2,
};

function validarToken() {
  if (!config.TOKEN || config.TOKEN === PLACEHOLDER) {
    console.error('\n[ERRO] Token não configurado.');
    console.error('Abra o arquivo ".env" nesta mesma pasta e troque a linha:');
    console.error(`  DISCORD_TOKEN=${PLACEHOLDER}`);
    console.error('por:');
    console.error('  DISCORD_TOKEN=seu_token_do_discord\n');
    process.exit(1);
  }
}

module.exports = { ...config, validarToken };
