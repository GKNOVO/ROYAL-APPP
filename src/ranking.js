'use strict';

/** Calcula o ranking a partir do histórico de partidas. */

function novoJogador(userId) {
  return {
    userId,
    vitorias: 0,
    derrotas: 0,
    partidas: 0,
    sequencia: 0,
    melhorSequencia: 0,
    ultimaEm: 0,
  };
}

function calcular(partidas) {
  const mapa = new Map();
  const pegar = (userId) => {
    if (!mapa.has(userId)) mapa.set(userId, novoJogador(userId));
    return mapa.get(userId);
  };

  const emOrdem = [...partidas].sort(
    (a, b) => new Date(a.criadoEm).getTime() - new Date(b.criadoEm).getTime(),
  );

  for (const partida of emOrdem) {
    const quando = new Date(partida.criadoEm).getTime() || 0;

    const vencedor = pegar(partida.vencedorId);
    vencedor.vitorias += 1;
    vencedor.partidas += 1;
    vencedor.sequencia += 1;
    vencedor.melhorSequencia = Math.max(vencedor.melhorSequencia, vencedor.sequencia);
    vencedor.ultimaEm = Math.max(vencedor.ultimaEm, quando);

    const perdedor = pegar(partida.perdedorId);
    perdedor.derrotas += 1;
    perdedor.partidas += 1;
    perdedor.sequencia = 0;
    perdedor.ultimaEm = Math.max(perdedor.ultimaEm, quando);
  }

  return [...mapa.values()].sort(
    (a, b) =>
      b.vitorias - a.vitorias ||
      b.melhorSequencia - a.melhorSequencia ||
      aproveitamento(b) - aproveitamento(a) ||
      a.userId.localeCompare(b.userId),
  );
}

function aproveitamento(jogador) {
  return jogador.partidas ? jogador.vitorias / jogador.partidas : 0;
}

function percentual(jogador) {
  return `${Math.round(aproveitamento(jogador) * 100)}%`;
}

function top(partidas, limite = 10) {
  return calcular(partidas).slice(0, Math.max(1, limite));
}

function posicaoDe(partidas, userId) {
  const lista = calcular(partidas);
  const indice = lista.findIndex((j) => j.userId === userId);
  return indice === -1 ? null : indice + 1;
}

module.exports = { calcular, aproveitamento, percentual, top, posicaoDe };
