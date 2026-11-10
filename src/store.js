'use strict';

const fs = require('fs');
const path = require('path');

function estadoVazio() {
  return { versao: 1, filas: {}, hosts: {}, partidas: [] };
}

/**
 * Guarda tudo num arquivo JSON:
 *   filas    -> { guildId: { entradas: [{ userId, entrouEm }], chamadoEm, chamadoPor } }
 *   hosts    -> { guildId: { userId|null, roleId|null } }
 *   partidas -> [{ id, guildId, vencedorId, perdedorId, hostId, salaId, registradoPor, criadoEm }]
 */
class Store {
  constructor(arquivo) {
    this.arquivo = path.resolve(arquivo);
    this.dados = estadoVazio();
    this._timer = null;
  }

  carregar() {
    try {
      const lido = JSON.parse(fs.readFileSync(this.arquivo, 'utf8'));
      this.dados = {
        ...estadoVazio(),
        ...lido,
        filas: lido.filas && typeof lido.filas === 'object' ? lido.filas : {},
        hosts: lido.hosts && typeof lido.hosts === 'object' ? lido.hosts : {},
        partidas: Array.isArray(lido.partidas) ? lido.partidas : [],
      };
    } catch (erro) {
      if (erro.code !== 'ENOENT') {
        const copia = `${this.arquivo}.quebrado-${Date.now()}`;
        try {
          fs.copyFileSync(this.arquivo, copia);
        } catch {
          /* sem permissão de cópia: segue o jogo */
        }
        console.error(`[AVISO] Não consegui ler "${this.arquivo}". Comecei com dados vazios.`);
        console.error(`        Uma cópia do arquivo antigo foi salva em "${copia}".`);
      }
    }
    return this;
  }

  /** Salva com atraso curto, para não escrever no disco a cada clique. */
  salvar() {
    if (this._timer) return;
    this._timer = setTimeout(() => {
      this._timer = null;
      this.gravar();
    }, 250);
    if (typeof this._timer.unref === 'function') this._timer.unref();
  }

  /** Grava na hora (usado em testes e no encerramento). */
  gravar() {
    try {
      fs.mkdirSync(path.dirname(this.arquivo), { recursive: true });
      const temporario = `${this.arquivo}.tmp`;
      fs.writeFileSync(temporario, JSON.stringify(this.dados, null, 2), 'utf8');
      fs.renameSync(temporario, this.arquivo);
    } catch (erro) {
      console.error('[ERRO] Não consegui salvar os dados:', erro.message);
    }
  }

  // ---------- fila ----------

  fila(guildId) {
    if (!this.dados.filas[guildId]) {
      this.dados.filas[guildId] = { entradas: [], chamadoEm: null, chamadoPor: null };
    }
    const fila = this.dados.filas[guildId];
    if (!Array.isArray(fila.entradas)) fila.entradas = [];
    if (!('chamadoEm' in fila)) fila.chamadoEm = null;
    if (!('chamadoPor' in fila)) fila.chamadoPor = null;
    return fila;
  }

  // ---------- host ----------

  host(guildId) {
    const host = this.dados.hosts[guildId];
    if (!host) return null;
    return { userId: host.userId || null, roleId: host.roleId || null };
  }

  definirHost(guildId, { userId = null, roleId = null } = {}) {
    this.dados.hosts[guildId] = { userId, roleId, atualizadoEm: new Date().toISOString() };
    this.salvar();
    return this.dados.hosts[guildId];
  }

  // ---------- partidas ----------

  registrarPartida({ guildId, vencedorId, perdedorId, hostId = null, salaId = null, registradoPor = null }) {
    const partida = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      guildId,
      vencedorId,
      perdedorId,
      hostId,
      salaId,
      registradoPor,
      criadoEm: new Date().toISOString(),
    };
    this.dados.partidas.push(partida);
    this.salvar();
    return partida;
  }

  partidas(guildId) {
    return this.dados.partidas.filter((p) => p.guildId === guildId);
  }

  totalPartidas(guildId) {
    return this.partidas(guildId).length;
  }
}

module.exports = { Store, estadoVazio };
