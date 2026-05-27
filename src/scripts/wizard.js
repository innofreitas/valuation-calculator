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
} from './valuation.js';

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
  1: 'Perfil & Risco',
  2: 'Financeiro',
  3: 'Patrimônio',
  4: 'Resultados',
};

export class Wizard {
  constructor({ onComplete }) {
    this.current = 1;
    this.total = 4;
    this.onComplete = onComplete;
    this.state = {
      sector: DEFAULT_SECTOR,
      manualMultiples: { revenue: null, ebitda: null },
      recurringRatio: 1.0,
      founder: 'medium',
      companyMoment: 'growing_fast',
      trademark: false,
      employees: '',
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
        });
      });
    });

    document.getElementById('age').addEventListener('change', () => this._syncState());
    document.getElementById('employees').addEventListener('change', () => {
      this.state.employees = document.getElementById('employees').value;
    });

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

    // Seletor de setor
    this._renderSectorGrid();

    // Slider de % recorrente
    const $ratio = document.getElementById('recurring-ratio');
    $ratio.addEventListener('input', () => this._updateRecurringDisplay());
    this._updateRecurringDisplay();

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
    // founder, companyMoment, trademark, employees — gerenciados pelos handlers de pill/select
    // revenue, ebitda, components — gerenciados por _onRevenueChange / _recomputeFinancials
  }

  _updateRecurringDisplay() {
    const pct = parseInt(document.getElementById('recurring-ratio').value, 10);
    const ratio = pct / 100;
    document.getElementById('recurring-display').textContent = `${pct}%`;
    document.getElementById('multiple-revenue').textContent = `${revenueMultipleFor(ratio, this.state.sector).toFixed(2)}×`;
    document.getElementById('multiple-ebitda').textContent = `${ebitdaMultipleFor(ratio, this.state.sector).toFixed(2)}×`;
    this.state.recurringRatio = ratio;
  }

  _renderSectorGrid() {
    const $grid = document.getElementById('sector-grid');
    if (!$grid) return;
    $grid.innerHTML = Object.entries(SECTOR_PRESETS).map(([key, preset]) => `
      <button type="button" class="sector-card${key === this.state.sector ? ' active' : ''}" data-sector="${key}">
        <div class="sector-label">${preset.label}</div>
        <div class="sector-desc">${preset.description}</div>
        <div class="sector-meta">
          <span title="Múltiplo EBITDA">EBITDA ${preset.ebitdaMultiple.min}–${preset.ebitdaMultiple.max}×</span>
          <span title="Margem saudável">Margem ${preset.healthyMargin.min}–${preset.healthyMargin.max}%</span>
        </div>
      </button>
    `).join('');

    $grid.querySelectorAll('.sector-card').forEach(btn => {
      btn.addEventListener('click', () => this._selectSector(btn.dataset.sector));
    });
    this._updateSectorInfo();
  }

  _selectSector(key) {
    this.state.sector = key;
    // Sugere recurringRatio do preset, mas só se o usuário ainda não ajustou explicitamente
    const preset = getSectorPreset(key);
    document.querySelectorAll('.sector-card').forEach(b =>
      b.classList.toggle('active', b.dataset.sector === key));
    // Atualiza display interativo
    document.getElementById('recurring-ratio').value = Math.round(preset.defaultRecurringRatio * 100);
    this._updateRecurringDisplay();
    this._updateSectorInfo();
  }

  _updateSectorInfo() {
    const $info = document.getElementById('sector-info');
    if (!$info) return;
    const preset = getSectorPreset(this.state.sector);
    $info.innerHTML = `
      <strong class="text-slate-300">${preset.label}:</strong>
      Múltiplo de receita ${preset.revenueMultiple.min}–${preset.revenueMultiple.max}× ·
      Múltiplo EBITDA ${preset.ebitdaMultiple.min}–${preset.ebitdaMultiple.max}× ·
      Crescimento esperado ${(preset.expectedGrowth*100).toFixed(0)}% a.a.
    `;
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
    if (this.current === 2) {
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
    this.$btnBack.classList.toggle('hidden', this.current === 4);

    if (this.current === 4) {
      this.$btnNext.textContent = '↻ Nova simulação';
    } else if (this.current === 3) {
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
    if (this.current === 4) {
      this.reset();
      return;
    }
    if (!this._validateCurrent()) return;
    this._syncState();
    if (this.current < this.total - 1) {
      this.current++;
      this._render();
    } else if (this.current === 3) {
      this.current = 4;
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

    // Setor
    this.state.sector = state.sector || DEFAULT_SECTOR;
    this.state.manualMultiples = state.manualMultiples || { revenue: null, ebitda: null };
    this._renderSectorGrid();

    this.state.companyMoment = state.companyMoment || 'growing_fast';
    setActivePill('companyMoment', this.state.companyMoment);

    this.state.trademark = state.trademark === true;
    setActivePill('trademark', this.state.trademark ? 'yes' : 'no');

    this.state.employees = state.employees || '';
    document.getElementById('employees').value = this.state.employees;
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
