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
  renderGlossary,
  renderScenarios,
  toast,
} from './ui-helpers.js';
import { exportPDF, buildShareURL, readShareURL } from './export-pdf.js';

// Dashboard
const dashboard = new Dashboard({
  container: document.getElementById('results-container'),
  onSave: (inputs, params, calc) => {
    const name = prompt('Nome para este cenário:', `Cenário ${new Date().toLocaleDateString('pt-BR')}`);
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

// Modais e tema
initTooltips();
initModalCloseHandlers();
initThemeButton();
renderGlossary();

document.getElementById('btn-glossary').addEventListener('click', () => openModal('modal-glossary'));
document.getElementById('btn-scenarios').addEventListener('click', () => {
  renderScenarios({
    onLoad: (scenario) => {
      closeModal('modal-scenarios');
      wizard.loadState(scenario.inputs);
      // Pula direto para resultados
      wizard.current = 4;
      wizard._render();
      dashboard.render(scenario.inputs);
      // Restaura params (WACC/growth do cenário)
      if (scenario.params) {
        dashboard.params = { ...dashboard.params, ...scenario.params };
        dashboard._recalc();
        dashboard._mount();
        dashboard._initChart();
      }
      toast(`Cenário "${scenario.name}" carregado`, { type: 'success' });
    },
    onDelete: () => toast('Cenário excluído', { type: 'info' }),
  });
  openModal('modal-scenarios');
});

// Share URL — carrega estado se presente
const shared = readShareURL();
if (shared) {
  const params = {};
  if (typeof shared._w === 'number') params.wacc = shared._w;
  if (typeof shared._g === 'number') params.growth = shared._g;
  delete shared._w;
  delete shared._g;

  wizard.loadState(shared);
  wizard.current = 4;
  wizard._render();
  dashboard.render(shared);
  if (Object.keys(params).length > 0) {
    dashboard.params = { ...dashboard.params, ...params };
    dashboard._recalc();
    dashboard._mount();
    dashboard._initChart();
  }
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
