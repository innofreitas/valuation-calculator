// ============================================
// Engine de cálculo de Valuation
// Funções puras — sem dependência de DOM
// ============================================

/**
 * Presets de setor — cada um define faixas típicas de múltiplos, margem e
 * crescimento. Usuário pode ajustar manualmente no dashboard.
 *
 * Faixas baseadas em benchmarks públicos de M&A (Brasil + global).
 */
export const SECTOR_PRESETS = {
  edtech_subscription: {
    label: '🎓 EdTech Subscription',
    description: 'Plataformas EAD com mensalidade/assinatura recorrente',
    ebitdaMultiple: { min: 4.0, default: 6.0, max: 8.0 },
    revenueMultiple: { min: 1.5, default: 2.0, max: 3.0 },
    healthyMargin: { min: 25, max: 45 },
    expectedGrowth: 0.20,
    defaultRecurringRatio: 1.0,
  },
  ead_hybrid: {
    label: '🎯 EAD Híbrido',
    description: 'Mix de assinatura + cursos avulsos',
    ebitdaMultiple: { min: 4.0, default: 5.5, max: 7.5 },
    revenueMultiple: { min: 1.3, default: 1.8, max: 2.5 },
    healthyMargin: { min: 20, max: 40 },
    expectedGrowth: 0.15,
    defaultRecurringRatio: 0.5,
  },
  infoproduct: {
    label: '📚 Infoproduto',
    description: 'Cursos avulsos, lançamentos, vendas únicas',
    ebitdaMultiple: { min: 3.0, default: 5.0, max: 7.0 },
    revenueMultiple: { min: 1.0, default: 1.5, max: 2.5 },
    healthyMargin: { min: 15, max: 35 },
    expectedGrowth: 0.10,
    defaultRecurringRatio: 0.0,
  },
  saas_b2b: {
    label: '💻 SaaS B2B',
    description: 'Software empresarial com receita recorrente',
    ebitdaMultiple: { min: 5.0, default: 8.0, max: 12.0 },
    revenueMultiple: { min: 2.0, default: 4.0, max: 8.0 },
    healthyMargin: { min: 20, max: 45 },
    expectedGrowth: 0.25,
    defaultRecurringRatio: 1.0,
  },
  marketplace: {
    label: '🛒 Marketplace',
    description: 'Plataformas conectando vendedores e compradores',
    ebitdaMultiple: { min: 5.0, default: 7.0, max: 10.0 },
    revenueMultiple: { min: 1.5, default: 3.0, max: 5.0 },
    healthyMargin: { min: 10, max: 30 },
    expectedGrowth: 0.20,
    defaultRecurringRatio: 0.3,
  },
  custom: {
    label: '⚙️ Personalizado',
    description: 'Defina seus próprios múltiplos',
    ebitdaMultiple: { min: 2.0, default: 5.0, max: 15.0 },
    revenueMultiple: { min: 0.5, default: 2.0, max: 10.0 },
    healthyMargin: { min: 10, max: 50 },
    expectedGrowth: 0.12,
    defaultRecurringRatio: 0.5,
  },
};

export const DEFAULT_SECTOR = 'ead_hybrid';

/**
 * Resolve preset a partir do input (ou fallback).
 */
export function getSectorPreset(sectorKey) {
  return SECTOR_PRESETS[sectorKey] || SECTOR_PRESETS[DEFAULT_SECTOR];
}

export const DEFAULT_PARAMS = {
  wacc: 0.22,
  growth: 0.12,
  dcfYears: 5,
  weights: {
    revenue: 0.30,
    ebitda: 0.35,
    dcf: 0.25,
    nav: 0.05,
    replacement: 0.05,
  },
  replacementMultiplier: 1.20,
  trademarkBonus: 0.05,
};

/**
 * Escala 1-5 de dependência dos sócios (penalidade aplicada ao valuation final).
 */
export const FOUNDER_PENALTIES = {
  none:    { label: 'Nenhuma Dependência',    penalty: 0.00 },
  low:     { label: 'Pouco Dependente',       penalty: 0.05 },
  medium:  { label: 'Médio Dependente',       penalty: 0.10 },
  high_:   { label: 'Muito Dependente',       penalty: 0.17 },
  total:   { label: 'Totalmente Dependente',  penalty: 0.25 },
};

/**
 * Momento da empresa — define a taxa de crescimento esperada para o DCF.
 */
export const COMPANY_MOMENTS = {
  growing_fast:     { label: '💎 Crescendo Muito',          growth: 0.25 },
  growing_moderate: { label: '📈 Crescendo Moderadamente',  growth: 0.15 },
  stagnant:         { label: '📊 Estagnada',                growth: 0.03 },
  difficulties:     { label: '📉 Dificuldades Financeiras', growth: -0.05 },
  not_operating:    { label: '📐 Não está em operação',     growth: 0.00 },
};

/**
 * Normaliza valor antigo (high/low) ou novo (none/low/medium/high_/total) para penalidade.
 */
export function founderPenaltyOf(founder) {
  if (typeof founder === 'number') return Math.min(0.30, Math.max(0, founder));
  if (FOUNDER_PENALTIES[founder]) return FOUNDER_PENALTIES[founder].penalty;
  // Compat com modelo binário antigo
  if (founder === 'high') return 0.20;
  if (founder === 'low') return 0;
  return 0;
}

/**
 * Componentes financeiros padrão (% do faturamento anual).
 * Defaults inspirados na calculadora BuyCo.
 */
export const FINANCIAL_DEFAULTS = {
  simple: {
    imposto: 0.05,
    custoDespesas: 0.55,
  },
  advanced: {
    imposto: 0.05,
    custos: 0.30,
    despesas: 0.20,
    depreciacao: 0.05,
    receitaFinanceira: 0.05,
    despesaFinanceira: 0.05,
  },
};

/**
 * Calcula EBITDA e Lucro Líquido a partir do faturamento e percentuais.
 * EBITDA = Faturamento − Custos − Despesas Operacionais
 * Lucro Líquido = EBITDA − Impostos − Depreciação + Rec. Fin. − Desp. Fin.
 */
export function computeFinancials(revenue, components, mode = 'simple') {
  const rev = Math.max(0, revenue);
  let custos = 0, despesas = 0, imposto = 0, depreciacao = 0, recFin = 0, despFin = 0;

  if (mode === 'simple') {
    custos = 0; // tudo agrupado em "custoDespesas"
    despesas = rev * (components.custoDespesas ?? 0);
    imposto = rev * (components.imposto ?? 0);
  } else {
    custos = rev * (components.custos ?? 0);
    despesas = rev * (components.despesas ?? 0);
    imposto = rev * (components.imposto ?? 0);
    depreciacao = rev * (components.depreciacao ?? 0);
    recFin = rev * (components.receitaFinanceira ?? 0);
    despFin = rev * (components.despesaFinanceira ?? 0);
  }

  const ebitda = rev - custos - despesas;
  const netIncome = ebitda - imposto - depreciacao + recFin - despFin;
  return { ebitda, netIncome, custos, despesas, imposto, depreciacao, recFin, despFin };
}

/**
 * Múltiplos interpolados pelo % de receita recorrente, dentro da faixa
 * do setor selecionado. ratio = 0 → min, ratio = 1 → max.
 *
 * Se o usuário definiu um valor manual (manualOverride), ele tem precedência.
 */
export function revenueMultipleFor(recurringRatio, sectorKey = DEFAULT_SECTOR, manualOverride = null) {
  if (typeof manualOverride === 'number') return manualOverride;
  const r = Math.min(1, Math.max(0, recurringRatio));
  const preset = getSectorPreset(sectorKey);
  const { min, max } = preset.revenueMultiple;
  return min + (max - min) * r;
}
export function ebitdaMultipleFor(recurringRatio, sectorKey = DEFAULT_SECTOR, manualOverride = null) {
  if (typeof manualOverride === 'number') return manualOverride;
  const r = Math.min(1, Math.max(0, recurringRatio));
  const preset = getSectorPreset(sectorKey);
  const { min, max } = preset.ebitdaMultiple;
  return min + (max - min) * r;
}

/**
 * Método 1 — Múltiplo de Faturamento Bruto
 */
export function calcRevenue(revenue, recurringRatio, sectorKey, manualOverride) {
  return Math.max(0, revenue) * revenueMultipleFor(recurringRatio, sectorKey, manualOverride);
}

/**
 * Método 2 — Múltiplo de EBITDA
 * +0.5 no múltiplo se empresa tem mais de 3 anos
 * Retorna 0 se EBITDA <= 0
 */
export function calcEbitdaMultiple(ebitda, recurringRatio, age, sectorKey, manualOverride) {
  if (ebitda <= 0) return 0;
  const base = ebitdaMultipleFor(recurringRatio, sectorKey, manualOverride);
  const maturityBonus = age === 'gt3' ? 0.5 : 0;
  return ebitda * (base + maturityBonus);
}

/**
 * Método 3 — Fluxo de Caixa Descontado (5 anos)
 * Projeta EBITDA crescendo a `growth` por `years`, traz cada ano ao VP com `wacc`.
 */
export function calcDCF(ebitda, { wacc = 0.22, growth = 0.12, years = 5 } = {}) {
  if (ebitda <= 0) return 0;
  let pv = 0;
  let projected = ebitda;
  for (let year = 1; year <= years; year++) {
    projected = projected * (1 + growth);
    pv += projected / Math.pow(1 + wacc, year);
  }
  return pv;
}

/**
 * Método 4 — Valor Patrimonial Líquido
 */
export function calcNAV(netAssets) {
  return Math.max(0, netAssets);
}

/**
 * Método 5 — Custo de Reposição
 */
export function calcReplacement(initialInvestment, multiplier = DEFAULT_PARAMS.replacementMultiplier) {
  return Math.max(0, initialInvestment) * multiplier;
}

/**
 * Calcula os 5 métodos individualmente
 */
export function calcAllMethods(inputs, params = DEFAULT_PARAMS) {
  const ratio = normalizeRecurringRatio(inputs);
  const sectorKey = inputs.sector || DEFAULT_SECTOR;
  const manualRev = inputs.manualMultiples?.revenue;
  const manualEbitda = inputs.manualMultiples?.ebitda;
  return {
    revenue: calcRevenue(inputs.revenue, ratio, sectorKey, manualRev),
    ebitda: calcEbitdaMultiple(inputs.ebitda, ratio, inputs.age, sectorKey, manualEbitda),
    dcf: calcDCF(inputs.ebitda, { wacc: params.wacc, growth: params.growth, years: params.dcfYears }),
    nav: calcNAV(inputs.assets),
    replacement: calcReplacement(inputs.investment, params.replacementMultiplier),
  };
}

/**
 * Resolve growth inicial do DCF.
 * Prioridade: momento da empresa > preset do setor > default.
 */
export function initialGrowthFor(inputs, defaultGrowth = DEFAULT_PARAMS.growth) {
  if (inputs.companyMoment && COMPANY_MOMENTS[inputs.companyMoment]) {
    return COMPANY_MOMENTS[inputs.companyMoment].growth;
  }
  if (inputs.sector && SECTOR_PRESETS[inputs.sector]) {
    return SECTOR_PRESETS[inputs.sector].expectedGrowth;
  }
  return defaultGrowth;
}

/**
 * Resolve o ratio de receita recorrente do input, mantendo compatibilidade
 * com o modelo binário antigo (`model: 'subscription' | 'oneshot'`).
 */
export function normalizeRecurringRatio(inputs) {
  if (typeof inputs.recurringRatio === 'number') {
    return Math.min(1, Math.max(0, inputs.recurringRatio));
  }
  if (inputs.model === 'subscription') return 1;
  if (inputs.model === 'oneshot') return 0;
  return 1;
}

/**
 * Consolida via média ponderada, aplica penalidade do fundador
 * e bônus por marca registrada.
 */
export function consolidate(methods, inputs, params = DEFAULT_PARAMS) {
  const { weights, trademarkBonus = 0 } = params;
  const gross =
    methods.revenue * weights.revenue +
    methods.ebitda * weights.ebitda +
    methods.dcf * weights.dcf +
    methods.nav * weights.nav +
    methods.replacement * weights.replacement;

  const founderPenalty = founderPenaltyOf(inputs.founder);
  const afterFounder = gross * (1 - founderPenalty);

  const trademark = inputs.trademark === true || inputs.trademark === 'yes';
  const final = trademark ? afterFounder * (1 + trademarkBonus) : afterFounder;

  return {
    gross,
    final,
    founderPenalty,
    penaltyApplied: founderPenalty > 0,
    penaltyAmount: gross - afterFounder,
    trademarkApplied: trademark,
    trademarkAmount: trademark ? final - afterFounder : 0,
  };
}

/**
 * Margem EBITDA (%) e classificação. Faixas vêm do setor selecionado.
 */
export function calcMargin(revenue, ebitda, sectorKey = DEFAULT_SECTOR) {
  if (revenue <= 0) return { value: 0, tier: 'low', label: 'Sem faturamento', message: '—', range: null };
  const value = (ebitda / revenue) * 100;
  const preset = getSectorPreset(sectorKey);
  const { min, max } = preset.healthyMargin;

  let tier, label, message;
  if (value < min) {
    tier = 'low';
    label = 'Margem Baixa';
    message = `Sua eficiência operacional está abaixo da média esperada para ${preset.label} (${min}–${max}%). Foco em otimizar custos.`;
  } else if (value <= max) {
    tier = 'healthy';
    label = 'Margem Saudável';
    message = `Sua margem está alinhada com a média do setor (${min}–${max}%).`;
  } else {
    tier = 'high';
    label = 'Margem Alta / Alta Eficiência';
    message = `Excelente eficiência — acima do topo da faixa saudável do setor (${max}%). Atrai prêmios em rodadas de investimento.`;
  }
  return { value, tier, label, message, range: { min, max } };
}

/**
 * Faixa de valuation (banda de incerteza) baseada na dispersão
 * dos 3 métodos principais (revenue, ebitda, dcf).
 *
 * Coeficiente de variação alto → banda larga; baixo → estreita.
 * Limites: mínimo ±10%, máximo ±30%.
 * Quando há penalidade do fundador, a banda é aplicada após o desconto.
 */
export function calcRange(methods, consolidated) {
  const principal = [methods.revenue, methods.ebitda, methods.dcf].filter(v => v > 0);
  let bandPct = 0.15; // default conservador
  if (principal.length >= 2) {
    const mean = principal.reduce((s, v) => s + v, 0) / principal.length;
    const variance = principal.reduce((s, v) => s + (v - mean) ** 2, 0) / principal.length;
    const stddev = Math.sqrt(variance);
    const cv = mean > 0 ? stddev / mean : 0;
    bandPct = Math.min(0.30, Math.max(0.10, cv * 0.6));
  }
  const center = consolidated.final;
  const low = Math.max(0, center * (1 - bandPct));
  const high = center * (1 + bandPct);
  return { low, high, center, bandPct };
}

/**
 * Cálculo completo
 */
export function fullCalculation(inputs, params = DEFAULT_PARAMS) {
  const methods = calcAllMethods(inputs, params);
  const consolidated = consolidate(methods, inputs, params);
  const margin = calcMargin(inputs.revenue, inputs.ebitda, inputs.sector);
  const range = calcRange(methods, consolidated);
  return { methods, consolidated, range, margin, params, inputs };
}

/**
 * Metadados dos métodos para UI
 */
export const METHOD_META = {
  revenue:     { label: 'Múltiplo de Faturamento',   short: 'Faturamento',  color: '#22d3ee', weight: 0.30 },
  ebitda:      { label: 'Múltiplo de EBITDA',        short: 'EBITDA',       color: '#8b5cf6', weight: 0.35 },
  dcf:         { label: 'Fluxo de Caixa Descontado', short: 'DCF',          color: '#a78bfa', weight: 0.25 },
  nav:         { label: 'Valor Patrimonial Líquido', short: 'NAV',          color: '#34d399', weight: 0.05 },
  replacement: { label: 'Custo de Reposição',        short: 'Reposição',    color: '#fbbf24', weight: 0.05 },
};
