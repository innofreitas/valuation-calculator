// ============================================
// Wizard de 4 passos
// ============================================

import { attachCurrencyMask, parseCurrency, formatPercent, formatBRL } from './utils.js';
import {
  calcMargin,
  revenueMultipleFor,
  ebitdaMultipleFor,
  computeFinancials,
  FINANCIAL_DEFAULTS,
  SECTOR_PRESETS,
  DEFAULT_SECTOR,
  getSectorPreset,
  COMPANY_MOMENTS,
  DEFAULT_PARAMS,
} from './valuation.js';
import {
  saveCustomPreset, loadCustomPreset, clearCustomPreset,
  saveRecurringRatio, loadRecurringRatio, clearRecurringRatio,
  saveFineTune, loadFineTune, clearFineTune,
} from './storage.js';
import { toast } from './ui-helpers.js';

const COMPONENT_META = {
  imposto:           { label: 'Imposto',           tip: 'Tributos sobre receita (Simples, ICMS, ISS, etc).',                    max: 40 },
  custoDespesas:     { label: 'Custo e Despesas',  tip: 'Soma de CPV/CSP + despesas operacionais (equipe, marketing, plataforma).', max: 95 },
  custos:            { label: 'Custos',            tip: 'CPV/CSP — custo direto de operar (tráfego, infraestrutura, comissões).', max: 80 },
  despesas:          { label: 'Despesas',          tip: 'Operacionais e administrativas — equipe, aluguel, ferramentas.',         max: 80 },
  depreciacao:       { label: 'Depreciação',       tip: 'Perda contábil de valor de equipamentos e ativos.',                      max: 30 },
  receitaFinanceira: { label: 'Receita Financeira',tip: 'Rendimentos de aplicações, juros recebidos.',                            max: 30 },
  despesaFinanceira: { label: 'Despesa Financeira',tip: 'Juros de empréstimos, taxas bancárias.',                                 max: 30 },
};

const STEP_LABELS = {
  1: 'Perfil & Setor',
  2: 'Riscos & Maturidade',
  3: 'Financeiro',
  4: 'Patrimônio',
  5: 'Resultados',
};

export class Wizard {
  constructor({ onComplete }) {
    this.current = 1;
    this.total = 5;
    this.onComplete = onComplete;
    // Carrega padrões salvos (se existirem)
    const savedCustom = loadCustomPreset();
    const savedRatio = loadRecurringRatio();
    const savedFineTune = loadFineTune();
    this.state = {
      companyName: '',
      sector: DEFAULT_SECTOR,
      customPreset: savedCustom,
      manualMultiples: savedFineTune?.manualMultiples ?? { revenue: null, ebitda: null },
      wacc:   typeof savedFineTune?.wacc   === 'number' ? savedFineTune.wacc   : null,
      growth: typeof savedFineTune?.growth === 'number' ? savedFineTune.growth : null,
      recurringRatio: savedRatio !== null ? savedRatio : 1.0,
      founder: 'medium',
      companyMoment: 'growing_fast',
      trademark: false,
      age: '1to3',
      revenue: 0,
      ebitda: 0,
      netIncome: 0,
      investment: 0,
      assets: 0,
      period: 'annual',
      financeMode: 'simple',
      components: { ...FINANCIAL_DEFAULTS.simple },
    };

    this.$panels = document.querySelectorAll('.step-panel');
    this.$progressBar = document.getElementById('progress-bar');
    this.$progressPct = document.getElementById('progress-pct');
    this.$sidebarSteps = document.querySelectorAll('#sidebar-steps .sidebar-item');
    this.$btnBack = document.getElementById('btn-back');
    this.$btnNext = document.getElementById('btn-next');

    this._initInputs();
    this._initNav();
  }

  _initInputs() {
    // Inputs monetários simples (faturamento, investimento, ativos)
    ['revenue', 'investment', 'assets'].forEach(id => {
      const el = document.getElementById(id);
      attachCurrencyMask(el);
    });
    document.getElementById('revenue').addEventListener('input', () => this._onRevenueChange());

    // Pill buttons (companyMoment, founder, trademark)
    document.querySelectorAll('.pill-grid').forEach(group => {
      const key = group.dataset.group;
      group.querySelectorAll('.pill-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          group.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const value = btn.dataset.value;
          if (key === 'trademark') {
            this.state.trademark = value === 'yes';
          } else {
            this.state[key] = value;
          }
          // Mudança de momento da empresa reseta growth manual e re-renderiza ajustes finos
          if (key === 'companyMoment') {
            this.state.growth = null;
            this._renderFineTuneCard();
          }
        });
      });
    });

    document.getElementById('age').addEventListener('change', () => this._syncState());

    // Sidebar: clicks em passos já concluídos voltam pra eles
    this.$sidebarSteps.forEach(item => {
      item.addEventListener('click', () => {
        const target = parseInt(item.dataset.stepTarget, 10);
        if (item.classList.contains('done') || item.classList.contains('active')) {
          this.current = target;
          this._render();
        }
      });
    });

    // Nome da empresa
    const $name = document.getElementById('company-name');
    if ($name) {
      $name.addEventListener('input', () => {
        this.state.companyName = $name.value.trim();
      });
    }

    // Seletor de setor
    this._renderSectorGrid();

    // Slider de % recorrente — aplica valor salvo (se houver) no carregamento
    const $ratio = document.getElementById('recurring-ratio');
    $ratio.addEventListener('input', () => this._updateRecurringDisplay());
    $ratio.value = Math.round(this.state.recurringRatio * 100);
    this._updateRecurringDisplay();

    // Botões da Composição da Receita (Salvar/Usar padrão)
    document.getElementById('btn-recurring-save')?.addEventListener('click', () => {
      if (saveRecurringRatio(this.state.recurringRatio)) {
        toast(`✓ ${Math.round(this.state.recurringRatio*100)}% recorrente salvo como padrão`, { type: 'success' });
      } else {
        toast('Não foi possível salvar (localStorage indisponível)', { type: 'error' });
      }
    });
    document.getElementById('btn-recurring-reset')?.addEventListener('click', () => {
      const saved = loadRecurringRatio();
      if (saved !== null) {
        this._setRecurringRatio(saved);
        toast(`Restaurado para ${Math.round(saved*100)}% (seu padrão salvo)`, { type: 'info' });
      } else {
        // Sem padrão salvo — volta para default do setor
        const preset = this._effectivePresetCurrent(this.state.sector);
        this._setRecurringRatio(preset.defaultRecurringRatio);
        toast(`Restaurado para ${Math.round(preset.defaultRecurringRatio*100)}% (padrão do setor ${preset.label})`, { type: 'info' });
      }
    });

    // Toggles do passo financeiro
    document.querySelectorAll('[data-period]').forEach(btn => {
      btn.addEventListener('click', () => this._setPeriod(btn.dataset.period));
    });
    document.querySelectorAll('[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => this._setFinanceMode(btn.dataset.mode));
    });

    // Renderiza componentes do passo financeiro (modo simples por padrão)
    this._renderComponents();
    this._recomputeFinancials();

    document.getElementById('investment').addEventListener('input', () => this._syncState());
    document.getElementById('assets').addEventListener('input', () => this._syncState());
  }

  _initNav() {
    this.$btnBack.addEventListener('click', () => this.back());
    this.$btnNext.addEventListener('click', () => this.next());
  }

  _syncState() {
    this.state.age = document.getElementById('age').value;
    this.state.investment = parseCurrency(document.getElementById('investment'));
    this.state.assets = parseCurrency(document.getElementById('assets'));
    // founder, companyMoment, trademark — gerenciados pelos handlers de pill
    // revenue, ebitda, components — gerenciados por _onRevenueChange / _recomputeFinancials
  }

  /** Helper: atualiza o slider de % recorrente programaticamente */
  _setRecurringRatio(ratio) {
    const pct = Math.round(Math.min(1, Math.max(0, ratio)) * 100);
    const $slider = document.getElementById('recurring-ratio');
    if ($slider) $slider.value = pct;
    this._updateRecurringDisplay();
  }

  _updateRecurringDisplay() {
    const pct = parseInt(document.getElementById('recurring-ratio').value, 10);
    const ratio = pct / 100;
    document.getElementById('recurring-display').textContent = `${pct}%`;
    const preset = this._effectivePresetCurrent(this.state.sector);
    document.getElementById('multiple-revenue').textContent = `${revenueMultipleFor(ratio, preset).toFixed(2)}×`;
    document.getElementById('multiple-ebitda').textContent = `${ebitdaMultipleFor(ratio, preset).toFixed(2)}×`;
    this.state.recurringRatio = ratio;

    // Se sliders de múltiplo estão em modo auto (sem override), sincroniza
    const syncSlider = (sliderId, displayId, value) => {
      const $s = document.getElementById(sliderId);
      const $d = document.getElementById(displayId);
      if ($s && document.activeElement !== $s) $s.value = value;
      if ($d) $d.textContent = `${value.toFixed(2)}×`;
    };
    if (this.state.manualMultiples?.revenue == null) {
      syncSlider('ft-mrev-slider', 'ft-mrev-display', revenueMultipleFor(ratio, preset));
    }
    if (this.state.manualMultiples?.ebitda == null) {
      syncSlider('ft-meb-slider', 'ft-meb-display', ebitdaMultipleFor(ratio, preset));
    }
  }

  _renderSectorGrid() {
    const $grid = document.getElementById('sector-grid');
    if (!$grid) return;
    $grid.innerHTML = Object.entries(SECTOR_PRESETS).map(([key, preset]) => {
      const isCustom = key === 'custom';
      const metaHtml = isCustom
        ? '<span title="Defina suas próprias faixas">Defina suas faixas</span>'
        : `<span title="Múltiplo EBITDA">EBITDA ${preset.ebitdaMultiple.min}–${preset.ebitdaMultiple.max}×</span>
           <span title="Margem saudável">Margem ${preset.healthyMargin.min}–${preset.healthyMargin.max}%</span>`;
      return `
        <button type="button" class="sector-card${key === this.state.sector ? ' active' : ''}" data-sector="${key}">
          <div class="sector-label">
            ${preset.label}
            ${preset.tooltip ? `<span class="tooltip" data-tip="${preset.tooltip}"></span>` : ''}
          </div>
          <div class="sector-desc">${preset.description}</div>
          <div class="sector-meta">${metaHtml}</div>
        </button>
      `;
    }).join('');

    $grid.querySelectorAll('.sector-card').forEach(btn => {
      btn.addEventListener('click', (e) => {
        // Click no ícone de tooltip não deve mudar o setor
        if (e.target.closest('.tooltip')) return;
        this._selectSector(btn.dataset.sector);
      });
    });
    this._initCustomPresetInputs();
    this._updateCustomPanelVisibility();
    this._updateSectorInfo();
  }

  _selectSector(key) {
    this.state.sector = key;
    const preset = this._effectivePresetCurrent(key);
    document.querySelectorAll('.sector-card').forEach(b =>
      b.classList.toggle('active', b.dataset.sector === key));
    document.getElementById('recurring-ratio').value = Math.round(preset.defaultRecurringRatio * 100);
    this._updateRecurringDisplay();
    this._updateCustomPanelVisibility();
    this._updateSectorInfo();
  }

  _effectivePresetCurrent(key) {
    if (key === 'custom' && this.state.customPreset) {
      const base = getSectorPreset('custom');
      const c = this.state.customPreset;
      return {
        ...base,
        ebitdaMultiple:  { ...base.ebitdaMultiple,  ...(c.ebitdaMultiple  || {}) },
        revenueMultiple: { ...base.revenueMultiple, ...(c.revenueMultiple || {}) },
        healthyMargin:   { ...base.healthyMargin,   ...(c.healthyMargin   || {}) },
        expectedGrowth:  typeof c.expectedGrowth === 'number' ? c.expectedGrowth : base.expectedGrowth,
      };
    }
    return getSectorPreset(key);
  }

  _updateCustomPanelVisibility() {
    const $panel = document.getElementById('custom-preset-panel');
    if (!$panel) return;
    if (this.state.sector === 'custom') {
      $panel.classList.remove('hidden');
      this._populateCustomInputs();
    } else {
      $panel.classList.add('hidden');
    }
  }

  _populateCustomInputs() {
    const base = getSectorPreset('custom');
    const c = this.state.customPreset || {};
    const v = (path, fallback) => {
      const segs = path.split('.');
      let ref = c;
      for (const s of segs) { ref = ref?.[s]; if (ref == null) return fallback; }
      return ref;
    };
    const set = (id, val) => {
      const el = document.getElementById(id);
      // Não sobrescreve se o usuário estiver editando esse input no momento
      if (el && document.activeElement !== el) el.value = val;
    };
    set('custom-eb-min',     v('ebitdaMultiple.min',  base.ebitdaMultiple.min));
    set('custom-eb-max',     v('ebitdaMultiple.max',  base.ebitdaMultiple.max));
    set('custom-rev-min',    v('revenueMultiple.min', base.revenueMultiple.min));
    set('custom-rev-max',    v('revenueMultiple.max', base.revenueMultiple.max));
    set('custom-margin-min', v('healthyMargin.min',   base.healthyMargin.min));
    set('custom-margin-max', v('healthyMargin.max',   base.healthyMargin.max));
    set('custom-growth',     ((typeof c.expectedGrowth === 'number' ? c.expectedGrowth : base.expectedGrowth) * 100).toFixed(1));
  }

  _initCustomPresetInputs() {
    const ids = ['custom-eb-min','custom-eb-max','custom-rev-min','custom-rev-max',
                 'custom-margin-min','custom-margin-max','custom-growth'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (!el || el.dataset.bound) return;
      el.dataset.bound = '1';
      el.addEventListener('input', () => this._syncCustomPreset());
    });

    const $save = document.getElementById('btn-custom-save');
    if ($save && !$save.dataset.bound) {
      $save.dataset.bound = '1';
      $save.addEventListener('click', () => {
        this._syncCustomPreset();
        if (saveCustomPreset(this.state.customPreset)) {
          toast('✓ Faixas personalizadas salvas como padrão', { type: 'success' });
        } else {
          toast('Não foi possível salvar (localStorage indisponível)', { type: 'error' });
        }
      });
    }

    const $reset = document.getElementById('btn-custom-reset');
    if ($reset && !$reset.dataset.bound) {
      $reset.dataset.bound = '1';
      $reset.addEventListener('click', () => {
        clearCustomPreset();
        this.state.customPreset = null;
        const base = getSectorPreset('custom');
        // Restaura inputs aos defaults do sistema
        document.getElementById('custom-eb-min').value     = base.ebitdaMultiple.min;
        document.getElementById('custom-eb-max').value     = base.ebitdaMultiple.max;
        document.getElementById('custom-rev-min').value    = base.revenueMultiple.min;
        document.getElementById('custom-rev-max').value    = base.revenueMultiple.max;
        document.getElementById('custom-margin-min').value = base.healthyMargin.min;
        document.getElementById('custom-margin-max').value = base.healthyMargin.max;
        document.getElementById('custom-growth').value     = (base.expectedGrowth * 100).toFixed(1);
        this._updateRecurringDisplay();
        this._updateSectorInfo();
        toast('Faixas restauradas ao padrão do sistema', { type: 'info' });
      });
    }
  }

  _syncCustomPreset() {
    const num = (id) => {
      const v = parseFloat(document.getElementById(id)?.value);
      return Number.isFinite(v) ? v : null;
    };
    const ebMin = num('custom-eb-min');
    const ebMax = num('custom-eb-max');
    const revMin = num('custom-rev-min');
    const revMax = num('custom-rev-max');
    const mgMin = num('custom-margin-min');
    const mgMax = num('custom-margin-max');
    const growth = num('custom-growth');

    this.state.customPreset = {
      ebitdaMultiple:  { ...(ebMin !== null && { min: ebMin }), ...(ebMax !== null && { max: ebMax }) },
      revenueMultiple: { ...(revMin !== null && { min: revMin }), ...(revMax !== null && { max: revMax }) },
      healthyMargin:   { ...(mgMin !== null && { min: mgMin }),  ...(mgMax !== null && { max: mgMax }) },
      ...(growth !== null && { expectedGrowth: growth / 100 }),
    };
    this._updateRecurringDisplay();
    this._updateSectorInfo();
  }

  _updateSectorInfo() {
    const $info = document.getElementById('sector-info');
    if (!$info) return;
    const preset = this._effectivePresetCurrent(this.state.sector);
    $info.innerHTML = `
      <strong class="text-slate-300">${preset.label}:</strong>
      Múltiplo de receita ${preset.revenueMultiple.min}–${preset.revenueMultiple.max}× ·
      Múltiplo EBITDA ${preset.ebitdaMultiple.min}–${preset.ebitdaMultiple.max}× ·
      Crescimento esperado ${(preset.expectedGrowth*100).toFixed(0)}% a.a.
    `;
    // Re-renderiza ajustes finos: ranges dos múltiplos podem ter mudado
    this._renderFineTuneCard();
  }

  /**
   * Resolve valores efetivos para os sliders de ajuste fino.
   * Manual override > momento da empresa > preset do setor > default global.
   */
  _effectiveWacc() {
    return typeof this.state.wacc === 'number' ? this.state.wacc : DEFAULT_PARAMS.wacc;
  }
  _effectiveGrowth() {
    if (typeof this.state.growth === 'number') return this.state.growth;
    if (this.state.companyMoment && COMPANY_MOMENTS[this.state.companyMoment]) {
      return COMPANY_MOMENTS[this.state.companyMoment].growth;
    }
    const preset = this._effectivePresetCurrent(this.state.sector);
    return preset.expectedGrowth;
  }
  _effectiveRevMult() {
    const preset = this._effectivePresetCurrent(this.state.sector);
    return revenueMultipleFor(this.state.recurringRatio, preset, this.state.manualMultiples?.revenue);
  }
  _effectiveEbMult() {
    const preset = this._effectivePresetCurrent(this.state.sector);
    return ebitdaMultipleFor(this.state.recurringRatio, preset, this.state.manualMultiples?.ebitda);
  }

  _renderFineTuneCard() {
    const $container = document.getElementById('fine-tune-container');
    if (!$container) return;
    const preset = this._effectivePresetCurrent(this.state.sector);
    const revRange = preset.revenueMultiple;
    const ebRange = preset.ebitdaMultiple;
    const wacc = this._effectiveWacc();
    const growth = this._effectiveGrowth();
    const revMult = this._effectiveRevMult();
    const ebMult = this._effectiveEbMult();

    // Preserva foco para não interromper digitação
    const focusedId = document.activeElement?.id;

    $container.innerHTML = `
      <div class="p-5 rounded-xl border border-white/10 bg-white/[0.02]">
        <div class="flex items-center justify-between gap-3 mb-1 flex-wrap">
          <label class="block text-sm font-medium text-slate-300">
            Ajustes finos
            <span class="tooltip" data-tip="Refine WACC, crescimento e múltiplos antes de ver o resultado. Os defaults vêm do setor e do momento da empresa.">ⓘ</span>
          </label>
          <div class="flex gap-2">
            <button type="button" id="btn-fine-save" class="custom-action-btn custom-action-primary">
              💾 Salvar Dados
            </button>
            <button type="button" id="btn-fine-reset" class="custom-action-btn">
              ↻ Restaurar Padrão
            </button>
          </div>
        </div>
        <p class="text-xs text-slate-500 mb-4">Estes valores entram diretamente no DCF e nos múltiplos. Você pode reabrir esta etapa quando quiser.</p>

        <div class="grid sm:grid-cols-2 gap-x-6 gap-y-5">
          <div>
            <div class="flex justify-between text-xs mb-2">
              <span class="text-slate-400">
                Taxa de desconto (WACC)
                <span class="tooltip" data-tip="Custo Médio Ponderado de Capital. Para negócios digitais brasileiros, 18%–25% é a faixa usual — quanto mais risco, maior o WACC. Usado no DCF para trazer fluxos futuros a valor presente."></span>
              </span>
              <span id="ft-wacc-display" class="font-mono text-cyan-400">${(wacc*100).toFixed(1)}%</span>
            </div>
            <input type="range" id="ft-wacc-slider" min="15" max="30" step="0.5" value="${wacc*100}" class="slider w-full">
            <div class="flex justify-between text-[10px] text-slate-600 mt-1"><span>15%</span><span>30%</span></div>
          </div>
          <div>
            <div class="flex justify-between text-xs mb-2">
              <span class="text-slate-400">
                Crescimento anual EBITDA
                <span class="tooltip" data-tip="Taxa anual projetada para o EBITDA dos próximos 5 anos no DCF. Default vem do Momento da Empresa (passo 2): Crescendo Muito = 25%, Moderadamente = 15%, Estagnada = 3%, Dificuldades = -5%."></span>
              </span>
              <span id="ft-growth-display" class="font-mono text-violet-400">${(growth*100).toFixed(1)}%</span>
            </div>
            <input type="range" id="ft-growth-slider" min="-10" max="40" step="0.5" value="${growth*100}" class="slider w-full">
            <div class="flex justify-between text-[10px] text-slate-600 mt-1"><span>-10%</span><span>40%</span></div>
          </div>
          <div>
            <div class="flex justify-between text-xs mb-2">
              <span class="text-slate-400">
                Múltiplo de Receita
                <span class="tooltip" data-tip="Faturamento bruto × este fator. Ponto de partida: vem do setor escolhido e da % recorrente. Útil quando a empresa ainda não tem lucro consolidado."></span>
              </span>
              <span id="ft-mrev-display" class="font-mono text-cyan-400">${revMult.toFixed(2)}×</span>
            </div>
            <input type="range" id="ft-mrev-slider" min="${revRange.min}" max="${revRange.max}" step="0.05" value="${revMult}" class="slider w-full">
            <div class="flex justify-between text-[10px] text-slate-600 mt-1">
              <span>${revRange.min}×</span><span>${revRange.max}×</span>
            </div>
          </div>
          <div>
            <div class="flex justify-between text-xs mb-2">
              <span class="text-slate-400">
                Múltiplo de EBITDA
                <span class="tooltip" data-tip="EBITDA × fator setorial. É o múltiplo mais usado em transações reais de Fusões e Aquisições (M&A). Para EdTech Subscription: 4×–8×. Para SaaS B2B: 5×–12×. +0.5× se empresa tem mais de 3 anos."></span>
              </span>
              <span id="ft-meb-display" class="font-mono text-violet-400">${ebMult.toFixed(2)}×</span>
            </div>
            <input type="range" id="ft-meb-slider" min="${ebRange.min}" max="${ebRange.max}" step="0.05" value="${ebMult}" class="slider w-full">
            <div class="flex justify-between text-[10px] text-slate-600 mt-1">
              <span>${ebRange.min}×</span><span>${ebRange.max}×</span>
            </div>
          </div>
        </div>
      </div>
    `;

    this._bindFineTuneHandlers();
    if (focusedId) document.getElementById(focusedId)?.focus();
  }

  _bindFineTuneHandlers() {
    const sliders = {
      'ft-wacc-slider':   { display: 'ft-wacc-display',   suffix: '%', set: v => this.state.wacc = v/100 },
      'ft-growth-slider': { display: 'ft-growth-display', suffix: '%', set: v => this.state.growth = v/100 },
      'ft-mrev-slider':   { display: 'ft-mrev-display',   suffix: '×', set: v => this.state.manualMultiples = { ...this.state.manualMultiples, revenue: v } },
      'ft-meb-slider':    { display: 'ft-meb-display',    suffix: '×', set: v => this.state.manualMultiples = { ...this.state.manualMultiples, ebitda: v } },
    };
    Object.entries(sliders).forEach(([id, { display, suffix, set }]) => {
      const $s = document.getElementById(id);
      const $d = document.getElementById(display);
      if (!$s || !$d) return;
      $s.addEventListener('input', () => {
        const v = parseFloat($s.value);
        set(v);
        $d.textContent = suffix === '%' ? `${v.toFixed(1)}%` : `${v.toFixed(2)}×`;
      });
    });

    document.getElementById('btn-fine-save')?.addEventListener('click', () => {
      const payload = {
        wacc: this.state.wacc,
        growth: this.state.growth,
        manualMultiples: this.state.manualMultiples,
      };
      if (saveFineTune(payload)) {
        toast('✓ Ajustes finos salvos como padrão', { type: 'success' });
      } else {
        toast('Não foi possível salvar (localStorage indisponível)', { type: 'error' });
      }
    });

    document.getElementById('btn-fine-reset')?.addEventListener('click', () => {
      const saved = loadFineTune();
      if (saved) {
        this.state.wacc = typeof saved.wacc === 'number' ? saved.wacc : null;
        this.state.growth = typeof saved.growth === 'number' ? saved.growth : null;
        this.state.manualMultiples = saved.manualMultiples || { revenue: null, ebitda: null };
        this._renderFineTuneCard();
        toast('Ajustes finos restaurados ao seu padrão salvo', { type: 'info' });
      } else {
        this.state.wacc = null;
        this.state.growth = null;
        this.state.manualMultiples = { revenue: null, ebitda: null };
        this._renderFineTuneCard();
        toast('Ajustes finos restaurados ao padrão do setor', { type: 'info' });
      }
    });
  }

  /**
   * Lê faturamento do input, anualiza se necessário e dispara recálculo.
   */
  _onRevenueChange() {
    const raw = parseCurrency(document.getElementById('revenue'));
    this.state.revenue = this.state.period === 'monthly' ? raw * 12 : raw;
    this._recomputeFinancials();
  }

  _setPeriod(period) {
    if (this.state.period === period) return;
    this.state.period = period;
    document.querySelectorAll('[data-period]').forEach(b =>
      b.classList.toggle('active', b.dataset.period === period));
    const label = period === 'monthly' ? 'mensal' : 'anual';
    document.getElementById('revenue-period-label').textContent = label;
    document.getElementById('period-label-revenue').textContent = label;
    this._onRevenueChange();
  }

  _setFinanceMode(mode) {
    if (this.state.financeMode === mode) return;
    this.state.financeMode = mode;
    this.state.components = { ...FINANCIAL_DEFAULTS[mode] };
    document.querySelectorAll('[data-mode]').forEach(b =>
      b.classList.toggle('active', b.dataset.mode === mode));
    this._renderComponents();
    this._recomputeFinancials();
  }

  /**
   * Renderiza os sliders/inputs de componentes (Imposto, Custo, etc.)
   * conforme o modo (simples ou avançado) selecionado.
   */
  _renderComponents() {
    const $grid = document.getElementById('components-grid');
    const mode = this.state.financeMode;
    const keys = Object.keys(FINANCIAL_DEFAULTS[mode]);

    $grid.innerHTML = keys.map(key => {
      const meta = COMPONENT_META[key];
      const pct = (this.state.components[key] ?? 0) * 100;
      return `
        <div class="component-row" data-key="${key}">
          <div class="row-head">
            <label for="slider-${key}">
              ${meta.label}
              <span class="tooltip" data-tip="${meta.tip}">ⓘ</span>
            </label>
            <span class="pct-pill" id="pill-${key}">${pct.toFixed(1)}%</span>
          </div>
          <div class="row-controls">
            <input type="range" id="slider-${key}" class="slider" min="0" max="${meta.max}" step="0.5" value="${pct}">
            <div class="money-input">
              <span class="prefix-r">R$</span>
              <input type="text" id="money-${key}" inputmode="numeric" value="0">
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Bind dos eventos
    keys.forEach(key => {
      const $slider = document.getElementById(`slider-${key}`);
      const $money = document.getElementById(`money-${key}`);
      $slider.addEventListener('input', () => this._onSliderChange(key, parseFloat($slider.value)));
      $money.addEventListener('input', () => this._onMoneyChange(key, $money.value));
      $money.addEventListener('blur', () => this._formatMoneyInput(key));
    });
  }

  _onSliderChange(key, pct) {
    this.state.components[key] = pct / 100;
    this._recomputeFinancials();
  }

  _onMoneyChange(key, rawValue) {
    const num = parseFloat(String(rawValue).replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.')) || 0;
    const periodMultiplier = this.state.period === 'monthly' ? 12 : 1;
    const annualRev = this.state.revenue; // já anualizado
    if (annualRev <= 0) return;
    // Valor digitado é no período exibido; anualiza para calcular %
    const annualValue = num * periodMultiplier;
    const pct = Math.min(1, annualValue / annualRev);
    this.state.components[key] = pct;
    document.getElementById(`slider-${key}`).value = (pct * 100).toFixed(1);
    this._recomputeFinancials({ skipMoneyUpdate: key });
  }

  _formatMoneyInput(key) {
    const annualRev = this.state.revenue;
    const annualValue = annualRev * (this.state.components[key] ?? 0);
    const displayValue = this.state.period === 'monthly' ? annualValue / 12 : annualValue;
    document.getElementById(`money-${key}`).value = Math.round(displayValue).toLocaleString('pt-BR');
  }

  /**
   * Recalcula EBITDA, lucro e atualiza pills/labels/inputs em R$.
   */
  _recomputeFinancials({ skipMoneyUpdate = null } = {}) {
    const { revenue, components, financeMode } = this.state;
    const fin = computeFinancials(revenue, components, financeMode);
    this.state.ebitda = fin.ebitda;
    this.state.netIncome = fin.netIncome;

    // Atualiza pills (% display) e money inputs
    const periodMult = this.state.period === 'monthly' ? 1/12 : 1;
    Object.keys(components).forEach(key => {
      const pct = components[key] * 100;
      const pill = document.getElementById(`pill-${key}`);
      if (pill) pill.textContent = `${pct.toFixed(1)}%`;
      if (key !== skipMoneyUpdate) {
        const $money = document.getElementById(`money-${key}`);
        if ($money && document.activeElement !== $money) {
          const annualValue = revenue * (components[key] ?? 0);
          const display = annualValue * periodMult;
          $money.value = Math.round(display).toLocaleString('pt-BR');
        }
      }
    });

    // Resumo
    const displayMult = this.state.period === 'monthly' ? 1/12 : 1;
    const revDisplay = revenue * displayMult;
    document.getElementById('summary-revenue').textContent = formatBRL(revDisplay);
    document.getElementById('summary-ebitda').textContent = formatBRL(fin.ebitda * displayMult);
    document.getElementById('summary-net').textContent = formatBRL(fin.netIncome * displayMult);

    // Margem EBITDA (sempre baseada no anual)
    const margin = calcMargin(revenue, fin.ebitda);
    const marginEl = document.getElementById('summary-ebitda-margin');
    if (marginEl) {
      const color = margin.tier === 'low' ? 'text-orange-400' : margin.tier === 'healthy' ? 'text-emerald-400' : 'text-emerald-300';
      marginEl.className = `text-xs mt-0.5 ${color}`;
      marginEl.textContent = `margem ${formatPercent(margin.value)} · ${margin.label}`;
    }

    // Validação: soma de custos+despesas > 100%
    const errEl = document.getElementById('ebitda-error');
    const operacionais = financeMode === 'simple'
      ? (components.custoDespesas ?? 0)
      : (components.custos ?? 0) + (components.despesas ?? 0);
    if (operacionais > 1) {
      errEl?.classList.remove('hidden');
    } else {
      errEl?.classList.add('hidden');
    }
  }

  _validateCurrent() {
    // Financeiro agora é o passo 3
    if (this.current === 3) {
      const { components, financeMode, revenue } = this.state;
      const operacionais = financeMode === 'simple'
        ? (components.custoDespesas ?? 0)
        : (components.custos ?? 0) + (components.despesas ?? 0);
      const errEl = document.getElementById('ebitda-error');
      if (revenue > 0 && operacionais > 1) {
        errEl?.classList.remove('hidden');
        return false;
      }
      errEl?.classList.add('hidden');
    }
    return true;
  }

  _render() {
    this.$panels.forEach(p => {
      const step = parseInt(p.dataset.step, 10);
      const isActive = step === this.current;
      p.classList.toggle('hidden', !isActive);
      if (isActive) {
        p.style.opacity = '';
        p.style.transform = '';
      }
    });
    const pct = (this.current / this.total) * 100;
    this.$progressBar.style.width = `${pct}%`;
    if (this.$progressPct) this.$progressPct.textContent = Math.round(pct);

    // Sidebar checklist
    this.$sidebarSteps.forEach(item => {
      const target = parseInt(item.dataset.stepTarget, 10);
      item.classList.remove('active', 'done', 'locked');
      const $icon = item.querySelector('.icon');
      if (target < this.current) {
        item.classList.add('done');
        if ($icon) $icon.textContent = '✓';
      } else if (target === this.current) {
        item.classList.add('active');
        if ($icon) $icon.textContent = '●';
      } else {
        item.classList.add('locked');
        if ($icon) $icon.textContent = '○';
      }
    });

    this.$btnBack.disabled = this.current === 1;
    this.$btnBack.classList.toggle('hidden', this.current === this.total);

    if (this.current === this.total) {
      this.$btnNext.textContent = '↻ Nova simulação';
    } else if (this.current === this.total - 1) {
      this.$btnNext.textContent = 'Calcular valuation ✨';
    } else {
      this.$btnNext.textContent = 'Avançar →';
    }

    // Anima entrada com GSAP, garantindo que termine em opacity:1 (clearProps)
    const $active = document.querySelector(`.step-panel[data-step="${this.current}"]`);
    if (window.gsap && $active) {
      gsap.killTweensOf($active);
      gsap.fromTo($active,
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out', clearProps: 'opacity,transform' }
      );
    }
  }

  next() {
    if (this.current === this.total) {
      this.reset();
      return;
    }
    if (!this._validateCurrent()) return;
    this._syncState();
    if (this.current < this.total - 1) {
      this.current++;
      this._render();
    } else if (this.current === this.total - 1) {
      // Último passo antes do resultado → calcula e renderiza
      this.current = this.total;
      this._render();
      this.onComplete?.(this.state);
    }
  }

  back() {
    if (this.current > 1) {
      this.current--;
      this._render();
    }
  }

  reset() {
    this.current = 1;
    this._render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /** Carrega estado externamente (de URL ou cenário salvo) */
  loadState(state) {
    Object.assign(this.state, state);

    // Compat: traduz 'model' antigo (subscription/oneshot) para recurringRatio
    let ratio = state.recurringRatio;
    if (typeof ratio !== 'number') ratio = state.model === 'oneshot' ? 0 : 1;
    this.state.recurringRatio = ratio;
    document.getElementById('recurring-ratio').value = Math.round(ratio * 100);
    this._updateRecurringDisplay();

    // Pill buttons: founder, companyMoment, trademark
    const setActivePill = (group, value) => {
      const $g = document.querySelector(`.pill-grid[data-group="${group}"]`);
      if (!$g) return;
      $g.querySelectorAll('.pill-btn').forEach(b => b.classList.toggle('active', b.dataset.value === value));
    };
    // Compat: traduz 'high'/'low' antigos para escala 5-níveis
    let founderValue = state.founder;
    if (founderValue === 'high') founderValue = 'high_';
    if (founderValue === 'low') founderValue = 'none';
    this.state.founder = founderValue || 'medium';
    setActivePill('founder', this.state.founder);

    // Nome da empresa
    this.state.companyName = state.companyName || '';
    const $name = document.getElementById('company-name');
    if ($name) $name.value = this.state.companyName;

    // Setor + customPreset + ajustes finos
    this.state.sector = state.sector || DEFAULT_SECTOR;
    this.state.customPreset = state.customPreset || null;
    this.state.manualMultiples = state.manualMultiples || { revenue: null, ebitda: null };
    this.state.wacc = typeof state.wacc === 'number' ? state.wacc : null;
    this.state.growth = typeof state.growth === 'number' ? state.growth : null;
    this._renderSectorGrid();

    this.state.companyMoment = state.companyMoment || 'growing_fast';
    setActivePill('companyMoment', this.state.companyMoment);

    this.state.trademark = state.trademark === true;
    setActivePill('trademark', this.state.trademark ? 'yes' : 'no');

    document.getElementById('age').value = state.age || '1to3';

    // Período e modo financeiro
    this._setPeriod(state.period || 'annual');
    if (state.financeMode) this._setFinanceMode(state.financeMode);

    // Componentes (se vieram, sobrescreve defaults)
    if (state.components) {
      this.state.components = { ...this.state.components, ...state.components };
      this._renderComponents();
    }

    // Restaurar valores formatados
    const setMasked = (id, val) => {
      const el = document.getElementById(id);
      if (val && val > 0) {
        el.value = new Intl.NumberFormat('pt-BR', {
          minimumFractionDigits: 2, maximumFractionDigits: 2
        }).format(val);
      } else {
        el.value = '';
      }
    };
    // Faturamento mostrado conforme período
    const revDisplay = this.state.period === 'monthly' ? (state.revenue || 0) / 12 : (state.revenue || 0);
    setMasked('revenue', revDisplay);
    setMasked('investment', state.investment);
    setMasked('assets', state.assets);

    this._recomputeFinancials();
  }
}
