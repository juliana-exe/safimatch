// src/services/bonusService.js - Safimatch
// Sistema de bônus aleatórios para usuários ativos.
// Lógica: ~10% de chance por sessão, com cooldown de 24h entre bônus.
// Bônus disponíveis: 5 Superlikes grátis  OU  2 Desfazer grátis.

import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Constantes ───────────────────────────────────────────────────────────────
const CHAVE_BONUS  = '@safimatch:bonus_ativo';
const CHAVE_ULTIMO = '@safimatch:ultimo_bonus_em';

const COOLDOWN_MS  = 24 * 60 * 60 * 1000; // 24 horas entre bônus
const PROB_BONUS   = 0.10;                  // 10 % de chance ao rolar

const TIPOS_BONUS = [
  { tipo: 'superlike', qtd: 5, label: 'Você ganhou 5 Superlikes grátis! ⭐' },
  { tipo: 'desfazer',  qtd: 2, label: 'Você ganhou 2 Desfazeres grátis! ↩️' },
];

// ─── Obter bônus ativo ────────────────────────────────────────────────────────
/**
 * Retorna o bônus atualmente ativo (ou null se não houver / estiver expirado).
 * @returns {Promise<{tipo:string, qtd:number, label:string, expira:number}|null>}
 */
export async function obterBonusAtivo() {
  try {
    const raw = await AsyncStorage.getItem(CHAVE_BONUS);
    if (!raw) return null;

    const bonus = JSON.parse(raw);

    // Expirou depois de 24 h ou sem quantidade restante → limpa
    if (bonus.expira < Date.now() || bonus.qtd <= 0) {
      await AsyncStorage.removeItem(CHAVE_BONUS);
      return null;
    }

    return bonus;
  } catch {
    return null;
  }
}

// ─── Rolar bônus ──────────────────────────────────────────────────────────────
/**
 * Tenta conceder um bônus ao usuário.
 * - Só rola se não há bônus ativo E o cooldown de 24 h passou.
 * - Probabilidade: PROB_BONUS (10 %).
 * @returns {Promise<{tipo:string, qtd:number, label:string, expira:number}|null>}
 *          Retorna o bônus ganho, ou null se não houve ganho.
 */
export async function rolarBonus() {
  try {
    // Já tem bônus ativo? Não rola de novo.
    const ativo = await obterBonusAtivo();
    if (ativo) return null;

    // Cooldown — verifica quando foi o último bônus
    const ultimoRaw = await AsyncStorage.getItem(CHAVE_ULTIMO);
    const ultimo = ultimoRaw ? parseInt(ultimoRaw, 10) : 0;
    if (Date.now() - ultimo < COOLDOWN_MS) return null;

    // Sorteio
    if (Math.random() > PROB_BONUS) return null;

    // Ganhou! Sorteia o tipo
    const tipo = TIPOS_BONUS[Math.floor(Math.random() * TIPOS_BONUS.length)];
    const novoBonus = {
      ...tipo,
      expira: Date.now() + COOLDOWN_MS, // expira em 24 h
    };

    await AsyncStorage.setItem(CHAVE_BONUS, JSON.stringify(novoBonus));
    await AsyncStorage.setItem(CHAVE_ULTIMO, String(Date.now()));

    return novoBonus;
  } catch {
    return null;
  }
}

// ─── Resetar bônus (apenas DEV) ──────────────────────────────────────────────
/**
 * Apaga qualquer bônus ativo e o registro de último sorteio.
 * Use apenas em ambiente de desenvolvimento para testar o fluxo.
 */
export async function resetarBonus() {
  try {
    await AsyncStorage.multiRemove([CHAVE_BONUS, CHAVE_ULTIMO]);
  } catch {}
}

// ─── Consumir bônus ───────────────────────────────────────────────────────────
/**
 * Decrementa 1 unidade do bônus do tipo informado.
 * @param {'superlike'|'desfazer'} tipo
 * @returns {Promise<boolean>} true se consumiu com sucesso, false caso contrário.
 */
export async function consumirBonus(tipo) {
  try {
    const ativo = await obterBonusAtivo();
    if (!ativo || ativo.tipo !== tipo || ativo.qtd <= 0) return false;

    const novoQtd = ativo.qtd - 1;

    if (novoQtd <= 0) {
      await AsyncStorage.removeItem(CHAVE_BONUS);
    } else {
      await AsyncStorage.setItem(
        CHAVE_BONUS,
        JSON.stringify({ ...ativo, qtd: novoQtd }),
      );
    }

    return true;
  } catch {
    return false;
  }
}
