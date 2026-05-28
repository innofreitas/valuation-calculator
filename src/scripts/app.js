// ============================================
// App entrypoint — orquestra tudo
// ============================================

import { Wizard } from './wizard.js';
import { Dashboard } from './dashboard.js';
import { saveScenario } from './storage.js';
import { initThemeButton } from './theme.js';
import {
  initTooltips,
  initModalCloseHandlers,
  openModal,
  closeModal,
  renderScenarios,
  toast,
} from './ui-helpers.js';
import { exportPDF, buildShareURL, readShareURL } from './export-pdf.js';

// Dashboard
const dashboard = new Dashboard({
  container: document.getElementById('results-container'),
  onSave: (inputs, params, calc) => {
    const today = new Date().toLocaleDateString('pt-BR');
    const suggested = inputs.companyName
      ? `${inputs.companyName} — ${today}`
      : `Cenário ${today}`;
    const name = prompt('Nome para este cenário:', suggested);
    if (!name) return;
    saveScenario({ inputs, params, calc, name });
    toast(`✓ Cenário "${name}" salvo`, { type: 'success' });
  },
  onShare: (inputs, params) => {
    const url = buildShareURL(inputs, params);
    navigator.clipboard.writeText(url).then(
      () => toast('✓ Link copiado para a área de transferência', { type: 'success' }),
      () => toast('Falha ao copiar — selecione manualmente na barra de URL', { type: 'error' })
    );
    // Atualiza URL atual
    window.history.replaceState(null, '', url);
  },
  onExport: async (calc) => {
    try {
      toast('Gerando PDF...', { type: 'info', duration: 1500 });
      await exportPDF(calc);
    } catch (err) {
      console.error(err);
      toast('Erro ao gerar PDF', { type: 'error' });
    }
  },
});

// Wizard
const wizard = new Wizard({
  onComplete: (state) => {
    dashboard.render(state);
  },
});
window.wizardInstance = wizard;

// Tooltips e tema
initTooltips();
initModalCloseHandlers();
initThemeButton();

document.getElementById('btn-scenarios').addEventListener('click', () => {
  renderScenarios({
    onLoad: (scenario) => {
      closeModal('modal-scenarios');
      // Compat: cenários antigos guardavam wacc/growth em scenario.params
      const inputs = { ...scenario.inputs };
      if (scenario.params) {
        if (typeof scenario.params.wacc === 'number' && typeof inputs.wacc !== 'number') inputs.wacc = scenario.params.wacc;
        if (typeof scenario.params.growth === 'number' && typeof inputs.growth !== 'number') inputs.growth = scenario.params.growth;
      }
      wizard.loadState(inputs);
      wizard.current = wizard.total;
      wizard._render();
      dashboard.render(inputs);
      toast(`Cenário "${scenario.name}" carregado`, { type: 'success' });
    },
    onDelete: () => toast('Cenário excluído', { type: 'info' }),
  });
  openModal('modal-scenarios');
});

// Share URL — carrega estado se presente
const shared = readShareURL();
if (shared) {
  // Compat com URLs antigas: _w/_g viram state.wacc/state.growth
  if (typeof shared._w === 'number') shared.wacc = shared._w;
  if (typeof shared._g === 'number') shared.growth = shared._g;
  delete shared._w;
  delete shared._g;

  wizard.loadState(shared);
  wizard.current = wizard.total;
  wizard._render();
  dashboard.render(shared);
  toast('Simulação carregada via link compartilhado', { type: 'info' });
}

// Hint dinâmico no input de revenue ao digitar (anualizado)
const revenueInput = document.getElementById('revenue');
const revenueHint = document.getElementById('revenue-hint');
revenueInput.addEventListener('input', () => {
  const raw = (revenueInput.value.replace(/\D/g, '') | 0) / 100;
  const annual = wizard.state.period === 'monthly' ? raw * 12 : raw;
  if (annual >= 1_000_000) {
    revenueHint.textContent = `Equivalente a ~R$ ${(annual/1_000_000).toFixed(2)}M anualizado`;
  } else if (annual >= 100_000) {
    revenueHint.textContent = `Equivalente a ~R$ ${(annual/1_000).toFixed(0)}K anualizado`;
  } else {
    revenueHint.textContent = '';
  }
});

// Anima entrada inicial
if (window.gsap) {
  gsap.from('#hero', { y: -20, opacity: 0, duration: 0.7, ease: 'power2.out' });
  gsap.from('#wizard', { y: 30, opacity: 0, duration: 0.7, delay: 0.15, ease: 'power2.out' });
}
