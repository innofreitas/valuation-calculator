// ============================================
// Utilitários: formatação, máscara, validação
// ============================================

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});
const BRL_FULL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
});

export function formatBRL(value, { compact = false } = {}) {
  if (!Number.isFinite(value)) return 'R$ 0';
  if (compact) {
    if (Math.abs(value) >= 1_000_000_000) return `R$ ${(value/1_000_000_000).toFixed(2)}B`;
    if (Math.abs(value) >= 1_000_000) return `R$ ${(value/1_000_000).toFixed(2)}M`;
    if (Math.abs(value) >= 1_000) return `R$ ${(value/1_000).toFixed(1)}K`;
  }
  return BRL.format(Math.round(value));
}

export function formatBRLFull(value) {
  if (!Number.isFinite(value)) return 'R$ 0,00';
  return BRL_FULL.format(value);
}

export function formatPercent(value, decimals = 1) {
  if (!Number.isFinite(value)) return '0%';
  return `${value.toFixed(decimals)}%`;
}

/**
 * Aplica máscara de moeda BRL em input ao digitar.
 * Permite negativos via sinal "-".
 */
export function attachCurrencyMask(input) {
  const handler = () => {
    const raw = input.value;
    const isNegative = raw.trim().startsWith('-');
    const digits = raw.replace(/\D/g, '');
    if (!digits) {
      input.value = '';
      return;
    }
    const cents = parseInt(digits, 10);
    const value = cents / 100;
    const formatted = new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
    input.value = isNegative ? `-${formatted}` : formatted;
  };
  input.addEventListener('input', handler);
}

/**
 * Lê valor numérico de um input com máscara
 */
export function parseCurrency(input) {
  if (!input?.value) return 0;
  const raw = input.value.trim();
  const isNegative = raw.startsWith('-');
  const clean = raw
    .replace(/[^\d,]/g, '')
    .replace(',', '.');
  const num = parseFloat(clean) || 0;
  return isNegative ? -num : num;
}

/**
 * Debounce para inputs reativos
 */
export function debounce(fn, ms = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/**
 * Encoda e decoda estado em base64 para URL share
 */
export function encodeState(state) {
  try {
    const json = JSON.stringify(state);
    return btoa(unescape(encodeURIComponent(json)));
  } catch {
    return '';
  }
}
export function decodeState(b64) {
  try {
    const json = decodeURIComponent(escape(atob(b64)));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Gera ID curto para cenários salvos
 */
export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
