// ============================================
// Exportação de PDF e share via URL
// ============================================

import {
  METHOD_META, effectivePreset, SECTOR_PRESETS, calcDCFDetailed,
  digitalMetricsModifier, ltvCacTier, churnTier,
  simplifiedValuation, SIMPLIFIED_MULTIPLES,
} from './valuation.js';
import { formatBRL, formatBRLFull, formatPercent, encodeState } from './utils.js';

export async function exportPDF(calc) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const { consolidated, range, margin, health, methods, inputs, params } = calc;

  const pageW = doc.internal.pageSize.getWidth();
  const margin_ = 48;
  let y = margin_;

  // Header
  doc.setFillColor(2, 6, 23);
  doc.rect(0, 0, pageW, 100, 'F');
  doc.setTextColor(255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Relatório de Valuation', margin_, 42);
  if (inputs.companyName) {
    doc.setFontSize(13);
    doc.setTextColor(103, 232, 249);
    doc.text(inputs.companyName, margin_, 64);
  }
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(150);
  doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}`, margin_, inputs.companyName ? 84 : 70);

  y = inputs.companyName ? 140 : 130;
  doc.setTextColor(20);

  // Valuation final como faixa
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text('VALUATION ESTIMADO', margin_, y);
  y += 24;
  doc.setFontSize(22);
  doc.setTextColor(8, 145, 178);
  doc.setFont('helvetica', 'bold');
  const bandText = range
    ? `Entre ${formatBRL(range.low, { compact: true })} e ${formatBRL(range.high, { compact: true })}`
    : formatBRL(consolidated.final);
  doc.text(bandText, margin_, y);
  y += 18;
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.setFont('helvetica', 'normal');
  if (range) {
    doc.text(`Valor central: ${formatBRLFull(consolidated.final)}  ·  Banda: ±${(range.bandPct*100).toFixed(0)}%`, margin_, y);
  } else {
    doc.text(formatBRLFull(consolidated.final), margin_, y);
  }
  y += 30;

  if (consolidated.penaltyApplied) {
    doc.setFillColor(252, 165, 165);
    doc.rect(margin_, y, pageW - margin_*2, 22, 'F');
    doc.setTextColor(127, 29, 29);
    doc.setFontSize(9);
    doc.text(`Dependencia dos socios: -${(consolidated.founderPenalty*100).toFixed(0)}% (-${formatBRL(consolidated.penaltyAmount)})`, margin_ + 10, y + 14);
    y += 30;
  }
  if (consolidated.trademarkApplied) {
    doc.setFillColor(187, 247, 208);
    doc.rect(margin_, y, pageW - margin_*2, 22, 'F');
    doc.setTextColor(20, 83, 45);
    doc.setFontSize(9);
    doc.text(`Marca registrada: +5% (+${formatBRL(consolidated.trademarkAmount)})`, margin_ + 10, y + 14);
    y += 30;
  }

  // Inputs resumo
  doc.setTextColor(20);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Dados de entrada', margin_, y);
  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const ratio = typeof inputs.recurringRatio === 'number' ? inputs.recurringRatio : (inputs.model === 'oneshot' ? 0 : 1);
  const ratioLabel = ratio === 1 ? '100% assinatura'
                   : ratio === 0 ? '100% vendas avulsas'
                   : `${Math.round(ratio*100)}% recorrente / ${Math.round((1-ratio)*100)}% avulso`;
  const founderLabels = {
    none: 'Nenhuma Dependência', low: 'Pouco Dependente', medium: 'Médio Dependente',
    high_: 'Muito Dependente', total: 'Totalmente Dependente',
    high: 'Alta (legado)', low: 'Baixa (legado)',
  };
  const momentLabels = {
    growing_fast: 'Crescendo Muito', growing_moderate: 'Crescendo Moderadamente',
    stagnant: 'Estagnada', difficulties: 'Dificuldades Financeiras', not_operating: 'Não opera',
  };
  const preset = effectivePreset(inputs);
  const sectorLine = inputs.sector === 'custom'
    ? `Personalizado · EBITDA ${preset.ebitdaMultiple.min}–${preset.ebitdaMultiple.max}×, Receita ${preset.revenueMultiple.min}–${preset.revenueMultiple.max}×`
    : preset.label.replace(/[^\w\sÀ-ÿ]/g, '').trim();

  const summary = [
    ['Setor / Tipo de negócio', sectorLine],
    ['Composição da receita', ratioLabel],
    ['Dependência dos sócios', founderLabels[inputs.founder] || inputs.founder || '—'],
    ['Momento da empresa', momentLabels[inputs.companyMoment] || '—'],
    ['Marca registrada', inputs.trademark ? 'Sim (+5%)' : 'Não'],
    ['Tempo de mercado', inputs.age === 'lt1' ? '< 1 ano' : inputs.age === '1to3' ? '1 a 3 anos' : '> 3 anos'],
    ...(inputs.digitalMetrics?.ltv && inputs.digitalMetrics?.cac
      ? [(() => {
          const ratio = inputs.digitalMetrics.ltv / inputs.digitalMetrics.cac;
          const tier = ltvCacTier(ratio);
          return ['LTV / CAC', `${ratio.toFixed(2)}× (${tier?.label || '—'})`];
        })()]
      : []),
    ...(typeof inputs.digitalMetrics?.monthlyChurn === 'number'
      ? [(() => {
          const tier = churnTier(inputs.digitalMetrics.monthlyChurn);
          return ['Churn mensal', `${(inputs.digitalMetrics.monthlyChurn*100).toFixed(1)}% (${tier?.label || '—'})`];
        })()]
      : []),
    ...((inputs.digitalMetrics?.ltv || inputs.digitalMetrics?.cac || typeof inputs.digitalMetrics?.monthlyChurn === 'number')
      ? [(() => {
          const mod = digitalMetricsModifier(inputs.digitalMetrics);
          const sign = mod > 0 ? '+' : '';
          return ['Ajuste por métricas digitais', `${sign}${(mod*100).toFixed(1)} p.p. na interpolação dos múltiplos`];
        })()]
      : []),
    ['Faturamento anual', formatBRL(inputs.revenue)],
    ['EBITDA anual', formatBRL(inputs.ebitda)],
    ['Investimento inicial', formatBRL(inputs.investment)],
    ['Ativos líquidos', formatBRL(inputs.assets)],
    ['WACC (DCF)', formatPercent(params.wacc*100, 1)],
    ['Crescimento (DCF)', formatPercent(params.growth*100, 1)],
  ];
  summary.forEach(([k, v]) => {
    doc.setTextColor(100);
    doc.text(k, margin_, y);
    doc.setTextColor(20);
    doc.text(v, margin_ + 200, y);
    y += 16;
  });

  y += 14;

  // Margem
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Margem EBITDA', margin_, y);
  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const tierLabel = margin.tier === 'low' ? '[Baixa]' : margin.tier === 'healthy' ? '[Saudavel]' : '[Alta]';
  doc.text(`${formatPercent(margin.value)} ${tierLabel} - ${margin.label}`, margin_, y);
  y += 16;
  const msgLines = doc.splitTextToSize(margin.message, pageW - margin_*2);
  doc.setTextColor(100);
  doc.text(msgLines, margin_, y);
  y += msgLines.length * 12 + 14;
  doc.setTextColor(20);

  // Score de Saúde do Negócio
  if (health) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Score de Saúde do Negócio', margin_, y);
    y += 18;
    doc.setFontSize(20);
    // Cor por tier — hex → RGB simples
    const hex = health.tier.color.replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    doc.setTextColor(r, g, b);
    doc.text(`${health.score}/100`, margin_, y);
    doc.setFontSize(11);
    doc.text(`[${health.tier.label}]`, margin_ + 90, y);
    y += 20;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(110);
    health.breakdown.forEach(c => {
      const label = c.missing ? `${c.label} (não informado)` : c.label;
      doc.text(`   ${label}`, margin_, y);
      doc.text(`${c.score}/100 · peso ${c.weight}%`, pageW - margin_ - 130, y);
      y += 12;
    });
    y += 10;
    doc.setTextColor(20);
  }

  // Métodos
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Detalhamento por método', margin_, y);
  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const dcfDetailed = calcDCFDetailed(inputs.ebitda, {
    wacc: params.wacc, growth: params.growth, years: params.dcfYears, terminalGrowth: params.terminalGrowth,
  });

  Object.entries(METHOD_META).forEach(([key, meta]) => {
    const val = methods[key];
    const contrib = val * meta.weight;
    doc.setTextColor(60);
    doc.text(`${meta.label} (peso ${(meta.weight*100).toFixed(0)}%)`, margin_, y);
    doc.setTextColor(20);
    doc.text(formatBRL(val), pageW - margin_ - 180, y);
    doc.setTextColor(120);
    doc.text(`→ ${formatBRL(contrib)}`, pageW - margin_ - 70, y);
    y += 16;

    // Decomposição do DCF: VP operacional + Valor Terminal
    if (key === 'dcf' && val > 0) {
      doc.setFontSize(9);
      doc.setTextColor(110);
      const opShare = (dcfDetailed.operationalPV / dcfDetailed.total) * 100;
      const vtShare = dcfDetailed.terminalShare * 100;
      doc.text(`   • VP dos 5 anos: ${formatBRL(dcfDetailed.operationalPV)} (${opShare.toFixed(0)}%)`, margin_, y);
      y += 12;
      doc.text(`   • Valor Terminal (perpetuidade ${(params.terminalGrowth*100).toFixed(1)}%): ${formatBRL(dcfDetailed.terminalPV)} (${vtShare.toFixed(0)}%)`, margin_, y);
      y += 14;
      doc.setFontSize(10);
    }
  });

  // Comparação simplificada: Valuation = Lucro Líquido × Múltiplo
  const sv = simplifiedValuation(inputs.netIncome);
  y += 8;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20);
  doc.text('Comparação rápida — fórmula simplificada do mercado', margin_, y);
  y += 16;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(`Regra prática: Valuation = Lucro Líquido Anual × Múltiplo (${SIMPLIFIED_MULTIPLES.low}x a ${SIMPLIFIED_MULTIPLES.high}x). Apresentada apenas como referência —`, margin_, y);
  y += 11;
  doc.text('NÃO entra na consolidação ponderada dos 5 métodos.', margin_, y);
  y += 16;

  if (sv.available) {
    doc.setFontSize(10);
    doc.setTextColor(60);
    doc.text(`Lucro Líquido Anual: ${formatBRL(inputs.netIncome)}`, margin_, y);
    y += 14;
    doc.setTextColor(20);
    doc.text(`   • Conservador (${SIMPLIFIED_MULTIPLES.low}x): ${formatBRL(sv.low)}`, margin_, y);
    y += 12;
    doc.setTextColor(8, 145, 178);
    doc.setFont('helvetica', 'bold');
    doc.text(`   • Mediana (${SIMPLIFIED_MULTIPLES.mid}x):    ${formatBRL(sv.mid)}`, margin_, y);
    y += 12;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(20);
    doc.text(`   • Otimista (${SIMPLIFIED_MULTIPLES.high}x):    ${formatBRL(sv.high)}`, margin_, y);
    y += 14;

    const ratio = consolidated.final > 0 ? sv.mid / consolidated.final : 0;
    const diffMsg = ratio > 1.2 ? 'mais otimista que o cálculo formal'
                  : ratio < 0.8 ? 'mais conservadora que o cálculo formal'
                  : 'alinhada com o cálculo formal';
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(`A faixa simplificada está ${diffMsg} (mediana = ${(ratio*100).toFixed(0)}% do valor central R$ ${formatBRL(consolidated.final)}).`, margin_, y);
    y += 14;
  } else {
    doc.setFontSize(10);
    doc.setTextColor(110);
    doc.text('Sem lucro líquido positivo, a fórmula simplificada não se aplica.', margin_, y);
    y += 14;
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(140);
  const footerY = doc.internal.pageSize.getHeight() - 30;
  doc.text('Relatório educacional gerado pela Calculadora de Valuation. Não substitui análise profissional de Fusões e Aquisições (M&A).', margin_, footerY);

  const date = new Date().toISOString().split('T')[0];
  const slug = slugify(inputs.companyName);
  const filename = slug
    ? `valuation-${slug}-${date}.pdf`
    : `valuation-${date}.pdf`;
  doc.save(filename);
}

/**
 * Converte nome da empresa em slug seguro para filename:
 * remove acentos, trocar não-alfanuméricos por hífen, limita 50 chars.
 */
function slugify(name) {
  if (!name || typeof name !== 'string') return '';
  return name
    .normalize('NFD').replace(/[̀-ͯ]/g, '')  // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

/**
 * Gera URL com estado encodado em base64
 */
export function buildShareURL(state, params) {
  const payload = { ...state, _w: params.wacc, _g: params.growth };
  const encoded = encodeState(payload);
  const url = new URL(window.location.href);
  url.hash = `s=${encoded}`;
  return url.toString();
}

/**
 * Lê estado da URL (hash)
 */
export function readShareURL() {
  const hash = window.location.hash;
  if (!hash.startsWith('#s=')) return null;
  const encoded = hash.slice(3);
  try {
    const json = decodeURIComponent(escape(atob(encoded)));
    return JSON.parse(json);
  } catch {
    return null;
  }
}
