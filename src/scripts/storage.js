// ============================================
// Persistência em localStorage
// ============================================

import { uid } from './utils.js';

const KEY = 'valuation:scenarios';
const MAX = 12;

export function listScenarios() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveScenario({ inputs, params, calc, name }) {
  const scenarios = listScenarios();
  const entry = {
    id: uid(),
    name: name || `Cenário ${scenarios.length + 1}`,
    createdAt: new Date().toISOString(),
    inputs,
    params,
    summary: {
      final: calc.consolidated.final,
      low: calc.range?.low ?? calc.consolidated.final,
      high: calc.range?.high ?? calc.consolidated.final,
      margin: calc.margin.value,
      tier: calc.margin.tier,
    },
  };
  scenarios.unshift(entry);
  const trimmed = scenarios.slice(0, MAX);
  localStorage.setItem(KEY, JSON.stringify(trimmed));
  return entry;
}

export function deleteScenario(id) {
  const scenarios = listScenarios().filter(s => s.id !== id);
  localStorage.setItem(KEY, JSON.stringify(scenarios));
}

export function clearScenarios() {
  localStorage.removeItem(KEY);
}

// ============================================
// Custom preset (faixas personalizadas do setor)
// ============================================
const CUSTOM_PRESET_KEY = 'valuation:custom-preset';

export function saveCustomPreset(preset) {
  try {
    localStorage.setItem(CUSTOM_PRESET_KEY, JSON.stringify(preset));
    return true;
  } catch {
    return false;
  }
}

export function loadCustomPreset() {
  try {
    const raw = localStorage.getItem(CUSTOM_PRESET_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearCustomPreset() {
  localStorage.removeItem(CUSTOM_PRESET_KEY);
}

// ============================================
// Composição da receita salva como padrão
// ============================================
const RECURRING_KEY = 'valuation:recurring-ratio';

export function saveRecurringRatio(ratio) {
  try { localStorage.setItem(RECURRING_KEY, String(ratio)); return true; }
  catch { return false; }
}
export function loadRecurringRatio() {
  try {
    const v = parseFloat(localStorage.getItem(RECURRING_KEY));
    return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : null;
  } catch { return null; }
}
export function clearRecurringRatio() {
  localStorage.removeItem(RECURRING_KEY);
}

// ============================================
// Ajustes Finos salvos como padrão
// ============================================
const FINE_TUNE_KEY = 'valuation:fine-tune';

export function saveFineTune(obj) {
  try { localStorage.setItem(FINE_TUNE_KEY, JSON.stringify(obj)); return true; }
  catch { return false; }
}
export function loadFineTune() {
  try {
    const raw = localStorage.getItem(FINE_TUNE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
export function clearFineTune() {
  localStorage.removeItem(FINE_TUNE_KEY);
}
