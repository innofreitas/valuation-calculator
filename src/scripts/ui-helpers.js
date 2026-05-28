// ============================================
// Tooltips flutuantes, modais, toasts
// ============================================

import { listScenarios, deleteScenario } from './storage.js';
import { formatBRL, formatPercent } from './utils.js';

/** Tooltips delegados — qualquer .tooltip[data-tip] */
export function initTooltips() {
  const floater = document.getElementById('tooltip-floater');
  document.addEventListener('mouseover', (e) => {
    const el = e.target.closest('.tooltip[data-tip]');
    if (!el) return;
    floater.textContent = el.dataset.tip;
    floater.classList.remove('hidden');
    positionTooltip(el, floater);
  });
  document.addEventListener('mouseout', (e) => {
    if (e.target.closest('.tooltip[data-tip]')) {
      floater.classList.add('hidden');
    }
  });
  // touch: tap-to-show
  document.addEventListener('click', (e) => {
    const el = e.target.closest('.tooltip[data-tip]');
    if (!el) {
      floater.classList.add('hidden');
      return;
    }
    floater.textContent = el.dataset.tip;
    floater.classList.remove('hidden');
    positionTooltip(el, floater);
  });
}

function positionTooltip(target, floater) {
  const r = target.getBoundingClientRect();
  const fr = floater.getBoundingClientRect();
  let top = r.bottom + 8;
  let left = r.left + r.width / 2 - fr.width / 2;
  if (left < 8) left = 8;
  if (left + fr.width > window.innerWidth - 8) left = window.innerWidth - fr.width - 8;
  if (top + fr.height > window.innerHeight - 8) top = r.top - fr.height - 8;
  floater.style.top = `${top}px`;
  floater.style.left = `${left}px`;
}

/** Genérico para mostrar/esconder modal */
export function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
export function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
  document.body.style.overflow = '';
}

export function initModalCloseHandlers() {
  const close = (m) => {
    m.classList.add('hidden');
    // Só destrava o scroll se NENHUM outro modal continuar aberto
    if (!document.querySelector('.modal:not(.hidden)')) {
      document.body.style.overflow = '';
    }
  };
  document.querySelectorAll('.modal').forEach(m => {
    m.querySelector('.modal-backdrop').addEventListener('click', () => close(m));
    m.querySelector('.modal-close').addEventListener('click', () => close(m));
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden'));
      document.body.style.overflow = '';
    }
  });
}

/** Cenários modal */
export function renderScenarios({ onLoad, onDelete }) {
  const $list = document.getElementById('scenarios-list');
  const scenarios = listScenarios();

  if (scenarios.length === 0) {
    $list.innerHTML = `
      <div class="text-center py-10 text-slate-500 text-sm">
        Nenhum cenário salvo ainda.<br>
        Calcule um valuation e clique em <strong>"Salvar cenário"</strong>.
      </div>
    `;
    return;
  }

  $list.innerHTML = scenarios.map(s => {
    const tierColor = s.summary.tier === 'low' ? 'text-orange-400' : s.summary.tier === 'healthy' ? 'text-emerald-400' : 'text-emerald-300';
    const date = new Date(s.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    return `
      <div class="p-4 rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/20 transition">
        <div class="flex items-start justify-between gap-3 mb-2">
          <div>
            <div class="font-semibold">${s.name}</div>
            <div class="text-xs text-slate-500">${date}</div>
          </div>
          <button data-action="delete" data-id="${s.id}" class="text-slate-500 hover:text-rose-400 transition" title="Excluir">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg>
          </button>
        </div>
        <div class="grid grid-cols-2 gap-3 text-sm mb-3">
          <div>
            <div class="text-xs text-slate-500">Faixa de valuation</div>
            <div class="font-display font-bold text-base">${formatBRL(s.summary.low ?? s.summary.final, { compact: true })} – ${formatBRL(s.summary.high ?? s.summary.final, { compact: true })}</div>
            <div class="text-xs text-slate-500 mt-0.5">Centro: ${formatBRL(s.summary.final, { compact: true })}</div>
          </div>
          <div>
            <div class="text-xs text-slate-500">Margem EBITDA</div>
            <div class="font-display font-bold text-lg ${tierColor}">${formatPercent(s.summary.margin)}</div>
          </div>
        </div>
        <button data-action="load" data-id="${s.id}" class="w-full px-3 py-2 rounded-lg text-xs font-medium bg-brand-500/10 border border-brand-500/30 text-brand-300 hover:bg-brand-500/20 transition">
          Carregar este cenário
        </button>
      </div>
    `;
  }).join('');

  $list.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      deleteScenario(id);
      renderScenarios({ onLoad, onDelete });
      onDelete?.(id);
    });
  });
  $list.querySelectorAll('[data-action="load"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const scenario = listScenarios().find(s => s.id === id);
      onLoad?.(scenario);
    });
  });
}

/** Toast leve */
export function toast(message, { type = 'info', duration = 3000 } = {}) {
  const div = document.createElement('div');
  const color = type === 'success' ? 'border-emerald-500/40 text-emerald-300'
              : type === 'error'   ? 'border-rose-500/40 text-rose-300'
              :                      'border-brand-500/40 text-brand-300';
  div.className = `fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl bg-ink-900/95 backdrop-blur-md border ${color} text-sm shadow-2xl`;
  div.style.opacity = '0';
  div.style.transform = 'translateY(10px)';
  div.style.transition = 'all 0.3s ease';
  div.textContent = message;
  document.body.appendChild(div);
  requestAnimationFrame(() => {
    div.style.opacity = '1';
    div.style.transform = 'translateY(0)';
  });
  setTimeout(() => {
    div.style.opacity = '0';
    div.style.transform = 'translateY(10px)';
    setTimeout(() => div.remove(), 300);
  }, duration);
}
