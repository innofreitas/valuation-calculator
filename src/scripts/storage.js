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
