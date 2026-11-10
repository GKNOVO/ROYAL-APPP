'use strict';

/** Regras da fila. Todas as funções mexem só no objeto da fila recebido. */

function posicao(fila, userId) {
  const indice = fila.entradas.findIndex((e) => e.userId === userId);
  return indice === -1 ? null : indice + 1;
}

function entrar(fila, userId, agora = Date.now()) {
  const jaEsta = posicao(fila, userId);
  if (jaEsta) return { ok: false, motivo: 'Você já está na fila.', posicao: jaEsta };
  fila.entradas.push({ userId, entrouEm: agora });
  return { ok: true, posicao: fila.entradas.length };
}

function sair(fila, userId) {
  const indice = fila.entradas.findIndex((e) => e.userId === userId);
  if (indice === -1) return { ok: false, motivo: 'Você não está na fila.' };
  fila.entradas.splice(indice, 1);
  return { ok: true };
}

/** Remove vários jogadores (usado depois de registrar o resultado). */
function remover(fila, userIds) {
  const alvo = new Set(userIds);
  const antes = fila.entradas.length;
  fila.entradas = fila.entradas.filter((e) => !alvo.has(e.userId));
  return antes - fila.entradas.length;
}

/** Quem são os próximos a jogar (os dois primeiros da fila). */
function proximos(fila, quantidade = 2) {
  return fila.entradas.slice(0, quantidade).map((e) => e.userId);
}

function temX1Pronto(fila, quantidade = 2) {
  return fila.entradas.length >= quantidade;
}

function limpar(fila) {
  fila.entradas = [];
  fila.chamadoEm = null;
  fila.chamadoPor = null;
}

/** Quanto tempo passou desde a última chamada de host (ms) ou null. */
function esperaDesdeChamada(fila, agora = Date.now()) {
  return fila.chamadoEm ? agora - fila.chamadoEm : null;
}

module.exports = { posicao, entrar, sair, remover, proximos, temX1Pronto, limpar, esperaDesdeChamada };
