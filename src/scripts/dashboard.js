// ============================================
// Dashboard de resultados
// ============================================

import {
  fullCalculation, METHOD_META, DEFAULT_PARAMS, initialGrowthFor,
  effectivePreset, revenueMultipleFor, ebitdaMultipleFor,
} from './valuation.js';
import { formatBRL, formatBRLFull, formatPercent } from './utils.js';
import { BENCHMARKS, TIPS } from '../data/glossary.js';

export class Dashboard {
  constructor({ container, onSave, onShare, onExport }) {
    this.$container = container;
    this.onSave = onSave;
    this.onShare = onShare;
    this.onExport = onExport;
    this.chart = null;
    this.state = null;       // inputs do wizard
    this.params = { ...DEFAULT_PARAMS };
    this.calc = null;        // último resultado
  }

  render(inputs) {
    this.state = { ...inputs, manualMultiples: { ...(inputs.manualMultiples || { revenue: null, ebitda: null }) } };
    // Params vêm dos overrides do passo 1 OU dos defaults do preset/momento
    const wacc = typeof inputs.wacc === 'number' ? inputs.wacc : DEFAULT_PARAMS.wacc;
    const growth = typeof inputs.growth === 'number' ? inputs.growth : initialGrowthFor(inputs);
    this.params = { ...DEFAULT_PARAMS, wacc, growth };
    this._recalc();
    this._mount();
    this._initChart();
    this._animateIn();
  }

  _recalc() {
    this.calc = fullCalculation(this.state, this.params);
  }

  _mount() {
    const { consolidated, margin, methods } = this.calc;
    const bench = BENCHMARKS.ead;

    this.$container.innerHTML = `
      <div id="results-card" class="space-y-6">

        <!-- Hero: Valuation Final (FAIXA) -->
        <div class="text-center py-6 md:py-8 fade-up">
          ${this.state.companyName ? `
            <div class="font-display text-lg md:text-xl font-semibold text-slate-200 mb-1">
              ${this.state.companyName}
            </div>
          ` : ''}
          <div class="text-xs uppercase tracking-[0.2em] text-slate-400 mb-3">
            Valuation estimado
            <span class="tooltip" data-tip="${TIPS.valuation}"></span>
          </div>
          <div class="flex items-baseline justify-center gap-3 flex-wrap font-display font-extrabold leading-tight">
            <span class="text-2xl md:text-4xl text-slate-500">Entre</span>
            <span id="hero-low" class="text-4xl md:text-6xl bg-gradient-to-br from-cyan-400 via-white to-violet-400 bg-clip-text text-transparent">
              ${formatBRL(this.calc.range.low, { compact: true })}
            </span>
            <span class="text-2xl md:text-4xl text-slate-500">e</span>
            <span id="hero-high" class="text-4xl md:text-6xl bg-gradient-to-br from-cyan-400 via-white to-violet-400 bg-clip-text text-transparent">
              ${formatBRL(this.calc.range.high, { compact: true })}
            </span>
          </div>
          <div class="mt-3 flex items-center justify-center gap-2 text-sm text-slate-400">
            <span>Valor central<span class="tooltip" data-tip="${TIPS.centerValue}"></span>:</span>
            <span id="hero-center" class="font-semibold text-slate-200">${formatBRL(consolidated.final)}</span>
            <span class="text-slate-600">·</span>
            <span id="hero-band" class="text-slate-500">banda ±${(this.calc.range.bandPct*100).toFixed(0)}%</span>
            <span class="tooltip" data-tip="${TIPS.range}"></span>
          </div>
          <div class="mt-4 flex items-center justify-center gap-2 flex-wrap">
            ${consolidated.penaltyApplied ? `
              <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                Dependência dos sócios: −${(consolidated.founderPenalty*100).toFixed(0)}% (${formatBRL(consolidated.penaltyAmount, { compact: true })})
              </div>
            ` : ''}
            ${consolidated.trademarkApplied ? `
              <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">
                Marca registrada: +${(this.params.trademarkBonus*100).toFixed(0)}% (${formatBRL(consolidated.trademarkAmount, { compact: true })})
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Margem EBITDA -->
        <div class="glass-soft rounded-2xl p-5 md:p-6 fade-up">
          <div class="flex items-start justify-between gap-4 flex-wrap">
            <div class="flex-1 min-w-[200px]">
              <div class="text-xs uppercase tracking-wider text-slate-400 mb-1">
                Margem EBITDA <span class="tooltip" data-tip="${TIPS.marginEbitda}"></span>
              </div>
              <div class="font-display text-3xl md:text-4xl font-bold">${formatPercent(margin.value)}</div>
              <span class="badge badge-${margin.tier} mt-2">${margin.label}</span>
            </div>
            <div class="flex-1 min-w-[260px] text-sm text-slate-300">${margin.message}</div>
          </div>
        </div>

        <!-- Sensitivity Sliders -->
        ${this._renderSensitivityCard()}

        <!-- Gráfico + Breakdown -->
        <div class="grid lg:grid-cols-5 gap-6">
          <div class="glass-soft rounded-2xl p-5 md:p-6 lg:col-span-3 fade-up">
            <h4 class="font-display font-semibold mb-1">Comparativo dos 5 métodos</h4>
            <p class="text-xs text-slate-400 mb-4">Veja qual abordagem mais infla ou reduz a avaliação.</p>
            <div class="relative" style="height: 280px">
              <canvas id="methods-chart"></canvas>
            </div>
          </div>

          <div class="glass-soft rounded-2xl p-5 md:p-6 lg:col-span-2 fade-up">
            <h4 class="font-display font-semibold mb-1">Detalhamento</h4>
            <p class="text-xs text-slate-400 mb-4">Cada método e sua contribuição ponderada.</p>
            <div id="methods-list" class="space-y-2.5"></div>
          </div>
        </div>

        <!-- Benchmark -->
        <div class="glass-soft rounded-2xl p-5 md:p-6 fade-up">
          <h4 class="font-display font-semibold mb-3">
            Benchmark setorial — ${bench.label}
            <span class="tooltip" data-tip="${TIPS.benchmark}"></span>
          </h4>
          <div class="grid sm:grid-cols-3 gap-4 text-sm">
            <div>
              <div class="text-xs text-slate-400 mb-1">
                Múltiplo de receita (mediana) <span class="tooltip" data-tip="${TIPS.revenueMultiple}"></span>
              </div>
              <div class="font-display text-xl">${bench.revenueMultiple.median.toFixed(1)}x</div>
              <div class="text-xs text-slate-500">Faixa: ${bench.revenueMultiple.min}x – ${bench.revenueMultiple.max}x</div>
            </div>
            <div>
              <div class="text-xs text-slate-400 mb-1">
                Múltiplo de EBITDA (mediana) <span class="tooltip" data-tip="${TIPS.ebitdaMultiple}"></span>
              </div>
              <div class="font-display text-xl">${bench.ebitdaMultiple.median.toFixed(1)}x</div>
              <div class="text-xs text-slate-500">Faixa: ${bench.ebitdaMultiple.min}x – ${bench.ebitdaMultiple.max}x</div>
            </div>
            <div>
              <div class="text-xs text-slate-400 mb-1">
                Margem EBITDA saudável <span class="tooltip" data-tip="${TIPS.marginEbitda}"></span>
              </div>
              <div class="font-display text-xl">${bench.healthyMargin.min}–${bench.healthyMargin.max}%</div>
              <div class="text-xs text-slate-500">Para o setor de EAD</div>
            </div>
          </div>
        </div>

        <!-- Ações -->
        <div class="flex flex-wrap gap-3 pt-2 fade-up">
          <button id="btn-save-scenario" class="px-4 py-2.5 rounded-xl text-sm font-medium bg-white/5 border border-white/10 hover:bg-white/10 transition flex items-center gap-2">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            Salvar cenário
          </button>
          <button id="btn-share" class="px-4 py-2.5 rounded-xl text-sm font-medium bg-white/5 border border-white/10 hover:bg-white/10 transition flex items-center gap-2">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            Compartilhar link
          </button>
          <button id="btn-export-pdf" class="px-4 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-brand-500/20 to-accent-500/20 border border-brand-500/30 text-brand-300 hover:from-brand-500/30 hover:to-accent-500/30 transition flex items-center gap-2">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Exportar PDF
          </button>
        </div>
      </div>
    `;

    this._renderMethodsList();
    this._bindSliders();
    this._bindActions();
  }

  _renderSensitivityCard() {
    const preset = effectivePreset(this.state);
    const ratio = typeof this.state.recurringRatio === 'number' ? this.state.recurringRatio : 1;
    const manualRev = this.state.manualMultiples?.revenue;
    const manualEb = this.state.manualMultiples?.ebitda;
    const currentRev = revenueMultipleFor(ratio, preset, manualRev);
    const currentEb = ebitdaMultipleFor(ratio, preset, manualEb);

    return `
      <div class="glass-soft rounded-2xl p-5 md:p-6 fade-up">
        <div class="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <div class="flex items-center gap-2">
            <svg class="w-4 h-4 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <h4 class="font-display font-semibold">Premissas usadas no cálculo</h4>
          </div>
          <button id="btn-edit-premises" class="text-xs px-3 py-1 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 transition">
            ✎ Editar no passo 1
          </button>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div class="p-3 rounded-xl bg-white/[0.03] border border-white/5">
            <div class="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
              WACC <span class="tooltip" data-tip="Custo Médio Ponderado de Capital. Taxa de desconto usada no DCF. Para negócios digitais brasileiros, 18%–25% é a faixa usual."></span>
            </div>
            <div class="font-display font-bold text-lg text-cyan-400">${(this.params.wacc*100).toFixed(1)}%</div>
          </div>
          <div class="p-3 rounded-xl bg-white/[0.03] border border-white/5">
            <div class="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
              Crescimento EBITDA <span class="tooltip" data-tip="Taxa anual de crescimento projetada para os próximos 5 anos no DCF."></span>
            </div>
            <div class="font-display font-bold text-lg text-violet-400">${(this.params.growth*100).toFixed(1)}%</div>
          </div>
          <div class="p-3 rounded-xl bg-white/[0.03] border border-white/5">
            <div class="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
              Múlt. Receita <span class="tooltip" data-tip="${METHOD_META.revenue.tip}"></span>
            </div>
            <div class="font-display font-bold text-lg text-cyan-400">${currentRev.toFixed(2)}×</div>
          </div>
          <div class="p-3 rounded-xl bg-white/[0.03] border border-white/5">
            <div class="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
              Múlt. EBITDA <span class="tooltip" data-tip="${METHOD_META.ebitda.tip}"></span>
            </div>
            <div class="font-display font-bold text-lg text-violet-400">${currentEb.toFixed(2)}×</div>
          </div>
        </div>
        <p class="text-xs text-slate-500 mt-3">Setor: <strong class="text-slate-300">${preset.label}</strong> · Ajuste essas premissas voltando ao passo "Perfil & Setor".</p>
      </div>
    `;
  }

  _renderMethodsList() {
    const { methods, consolidated } = this.calc;
    const $list = document.getElementById('methods-list');
    const max = Math.max(...Object.values(methods), 1);

    $list.innerHTML = Object.entries(METHOD_META).map(([key, meta]) => {
      const val = methods[key];
      const contribution = val * meta.weight;
      const widthPct = (val / max) * 100;
      return `
        <div class="p-3 rounded-xl bg-white/[0.02] border border-white/5">
          <div class="flex items-center justify-between text-xs mb-1.5">
            <span class="font-medium text-slate-300">
              ${meta.short}
              <span class="tooltip" data-tip="${meta.tip}"></span>
            </span>
            <span class="text-slate-500">peso ${(meta.weight*100).toFixed(0)}%</span>
          </div>
          <div class="font-display font-semibold text-base">${formatBRL(val)}</div>
          <div class="mt-2 h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div class="h-full rounded-full transition-all duration-700" style="width:${widthPct}%; background:${meta.color}"></div>
          </div>
          <div class="text-xs text-slate-500 mt-1.5">Contribui ${formatBRL(contribution)} ao consolidado</div>
        </div>
      `;
    }).join('');
  }

  _chartTheme() {
    const isLight = document.documentElement.classList.contains('light');
    return {
      grid: isLight ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.04)',
      tickX: isLight ? '#64748b' : '#64748b',
      tickY: isLight ? '#334155' : '#cbd5e1',
      tooltipBg: isLight ? 'rgba(255,255,255,0.98)' : 'rgba(2,6,23,0.95)',
      tooltipBorder: isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.1)',
      tooltipText: isLight ? '#0f172a' : '#f1f5f9',
    };
  }

  _initChart() {
    const { methods } = this.calc;
    const ctx = document.getElementById('methods-chart');
    const labels = Object.values(METHOD_META).map(m => m.short);
    const data = Object.keys(METHOD_META).map(k => methods[k]);
    const colors = Object.values(METHOD_META).map(m => m.color);
    const t = this._chartTheme();

    if (this.chart) this.chart.destroy();
    this.chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Valuation por método',
          data,
          backgroundColor: colors.map(c => `${c}cc`),
          borderColor: colors,
          borderWidth: 1,
          borderRadius: 8,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: t.tooltipBg,
            borderColor: t.tooltipBorder,
            borderWidth: 1,
            padding: 12,
            titleColor: t.tooltipText,
            bodyColor: t.tooltipText,
            titleFont: { family: 'Inter', weight: 600 },
            bodyFont: { family: 'Inter' },
            callbacks: {
              label: (ctx) => ` ${formatBRL(ctx.parsed.x)}`,
            },
          },
        },
        scales: {
          x: {
            grid: { color: t.grid },
            ticks: {
              color: t.tickX,
              font: { family: 'Inter', size: 11 },
              callback: (v) => formatBRL(v, { compact: true }),
            },
          },
          y: {
            grid: { display: false },
            ticks: { color: t.tickY, font: { family: 'Inter', size: 12 } },
          },
        },
      },
    });

    // Listener pra atualizar cores ao trocar tema
    if (!this._themeListenerBound) {
      window.addEventListener('theme:change', () => {
        if (this.chart) {
          const nt = this._chartTheme();
          this.chart.options.scales.x.grid.color = nt.grid;
          this.chart.options.scales.x.ticks.color = nt.tickX;
          this.chart.options.scales.y.ticks.color = nt.tickY;
          this.chart.options.plugins.tooltip.backgroundColor = nt.tooltipBg;
          this.chart.options.plugins.tooltip.borderColor = nt.tooltipBorder;
          this.chart.options.plugins.tooltip.titleColor = nt.tooltipText;
          this.chart.options.plugins.tooltip.bodyColor = nt.tooltipText;
          this.chart.update('none');
        }
      });
      this._themeListenerBound = true;
    }
  }

  _updateChart() {
    if (!this.chart) return;
    const { methods } = this.calc;
    this.chart.data.datasets[0].data = Object.keys(METHOD_META).map(k => methods[k]);
    this.chart.update('none');
  }

  _bindSliders() {
    // Botão "Editar no passo 1" volta para o wizard, passo Perfil & Setor
    const btn = document.getElementById('btn-edit-premises');
    if (btn && window.wizardInstance) {
      btn.addEventListener('click', () => {
        window.wizardInstance.current = 1;
        window.wizardInstance._render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  }

  _updateHero() {
    const { consolidated, range } = this.calc;
    document.getElementById('hero-low').textContent = formatBRL(range.low, { compact: true });
    document.getElementById('hero-high').textContent = formatBRL(range.high, { compact: true });
    document.getElementById('hero-center').textContent = formatBRL(consolidated.final);
    document.getElementById('hero-band').textContent = `banda ±${(range.bandPct*100).toFixed(0)}%`;
  }

  _bindActions() {
    document.getElementById('btn-save-scenario').addEventListener('click', () => this.onSave?.(this.state, this.params, this.calc));
    document.getElementById('btn-share').addEventListener('click', () => this.onShare?.(this.state, this.params));
    document.getElementById('btn-export-pdf').addEventListener('click', () => this.onExport?.(this.calc));
  }

  _animateIn() {
    if (!window.gsap) return;
    gsap.from('#hero-low, #hero-high', { scale: 0.8, opacity: 0, duration: 0.8, stagger: 0.15, ease: 'back.out(1.7)' });
    gsap.from('.fade-up', { y: 20, opacity: 0, stagger: 0.08, duration: 0.5, delay: 0.2, ease: 'power2.out' });
  }
}
