# Calculadora de Valuation — EAD & SaaS

Webapp estático para estimar o valor de mercado (*valuation*) de negócios digitais usando 5 metodologias consagradas com média ponderada. Tudo roda no navegador — nenhum dado sai do dispositivo do usuário.

**Stack:** HTML5 + Tailwind CSS (CDN) + JavaScript vanilla (ES Modules) + Chart.js + jsPDF + GSAP.

---

## Funcionalidades

- **Wizard de 4 passos** com sidebar checklist navegável
- **5 metodologias** de valuation consolidadas por média ponderada:
  - Múltiplo de Faturamento (peso 30%)
  - Múltiplo de EBITDA (peso 35%)
  - Fluxo de Caixa Descontado (DCF, 5 anos — peso 25%)
  - Valor Patrimonial Líquido (NAV — peso 5%)
  - Custo de Reposição (peso 5%)
- **6 presets de setor** com faixas de múltiplos calibradas (EdTech Subscription, EAD Híbrido, Infoproduto, SaaS B2B, Marketplace, Personalizado)
- **Resultado como faixa adaptativa** (ex: "Entre R$ 1,54M e R$ 2,04M") — banda larga quando os métodos divergem, estreita quando concordam
- **EBITDA calculado** dos componentes (faturamento + sliders %), em modo simples (2 sliders) ou avançado (6 sliders)
- **Toggle Mensal/Anual** nos inputs financeiros — anualizado internamente
- **Ajustes finos** no dashboard: WACC (15–30%), crescimento (-10% a 40%), múltiplo de receita e múltiplo de EBITDA — todos ajustáveis manualmente dentro da faixa do setor
- **Análise de margem EBITDA** com classificação contextual ao setor (faixa saudável varia por preset)
- **5 níveis de dependência dos sócios** (penalidade escalonada 0% a 25%)
- **5 estados de momento da empresa** (define growth do DCF de -5% a +25%)
- **Marca registrada** com bônus de +5%
- **Tema dark/light** com persistência em localStorage
- **Salvar cenários** em localStorage (até 12)
- **Compartilhar via URL** (estado encodado em base64 no hash)
- **Exportar PDF** com relatório completo (jsPDF)
- **Glossário** integrado com 13 termos financeiros
- **Tooltips contextuais** em todos os termos técnicos
- **Privacidade total:** zero requisições de rede para dados (apenas CDNs públicos)

---

## Como rodar localmente

ES Modules exigem servidor HTTP (não funciona via `file://`).

```bash
# opção 1: Python
python3 -m http.server 8765

# opção 2: Node
npx serve .

# opção 3: PHP
php -S localhost:8765
```

Acesse `http://localhost:8765/`.

---

## Estrutura do projeto

```
.
├── index.html                       # Entry point — Tailwind CDN + libs externas
├── PRD-1.md                         # PRD original (visão enterprise)
├── PRD-2.md                         # PRD detalhado (metodologia 5-em-1)
├── README.md                        # Este arquivo
└── src/
    ├── styles/
    │   └── main.css                 # Variáveis CSS, glassmorphism, dark/light
    ├── data/
    │   └── glossary.js              # Glossário + benchmarks legados
    └── scripts/
        ├── app.js                   # Orquestração
        ├── valuation.js             # Engine puro (5 métodos + presets de setor)
        ├── wizard.js                # Wizard 4 passos, máscara BRL, validação
        ├── dashboard.js             # Resultados, Chart.js, sliders manuais
        ├── storage.js               # localStorage (cenários)
        ├── theme.js                 # Toggle dark/light
        ├── ui-helpers.js            # Modais, tooltips, toasts
        ├── export-pdf.js            # Gera PDF + monta share URL
        └── utils.js                 # Format BRL, máscara, encode/decode base64
```

---

## Como funciona o cálculo

### Engine (`src/scripts/valuation.js`)

Funções puras, sem dependência de DOM:

```
fullCalculation(inputs, params) → { methods, consolidated, range, margin }
```

1. **`calcAllMethods(inputs, params)`** — calcula os 5 métodos individualmente
2. **`consolidate(methods, inputs, params)`** — média ponderada + penalidade do fundador + bônus de marca registrada
3. **`calcRange(methods, consolidated)`** — banda adaptativa (10–30%) baseada no coeficiente de variação dos métodos principais
4. **`calcMargin(revenue, ebitda, sector)`** — classifica margem EBITDA usando faixas do preset

### Múltiplos interpolados por setor

Cada preset define `revenueMultiple: { min, default, max }` e `ebitdaMultiple: { min, default, max }`. O múltiplo aplicado interpola linearmente conforme o `% de receita recorrente`:

```
multiplier = min + (max - min) × recurringRatio
```

Override manual (sliders no dashboard) tem precedência sobre o interpolado.

### DCF (5 anos)

EBITDA projetado crescendo a `params.growth` por 5 anos, descontado a `params.wacc`. Cresc. e WACC são ajustáveis pelos sliders.

### Penalidade do fundador (escala 1–5)

| Nível | Penalidade |
|---|---|
| Nenhuma Dependência | 0% |
| Pouco Dependente | 5% |
| Médio Dependente | 10% |
| Muito Dependente | 17% |
| Totalmente Dependente | 25% |

### Presets de setor

| Setor | Múlt. EBITDA | Múlt. Receita | Margem saudável | Cresc. esperado |
|---|---|---|---|---|
| EdTech Subscription | 4–8× | 1.5–3× | 25–45% | 20% |
| EAD Híbrido | 4–7.5× | 1.3–2.5× | 20–40% | 15% |
| Infoproduto | 3–7× | 1–2.5× | 15–35% | 10% |
| SaaS B2B | 5–12× | 2–8× | 20–45% | 25% |
| Marketplace | 5–10× | 1.5–5× | 10–30% | 20% |
| Personalizado | 2–15× | 0.5–10× | 10–50% | 12% |

---

## Personalização

### Adicionar um novo setor

Em `src/scripts/valuation.js`, dentro de `SECTOR_PRESETS`:

```js
meu_setor: {
  label: '🏭 Meu Setor',
  description: 'Descrição curta',
  ebitdaMultiple: { min: 3, default: 5, max: 8 },
  revenueMultiple: { min: 1, default: 2, max: 4 },
  healthyMargin: { min: 15, max: 35 },
  expectedGrowth: 0.15,
  defaultRecurringRatio: 0.5,
}
```

O setor aparece automaticamente no seletor do passo 1.

### Ajustar pesos da consolidação

Em `DEFAULT_PARAMS.weights`:

```js
weights: {
  revenue: 0.30,      // Múltiplo de faturamento
  ebitda: 0.35,       // Múltiplo de EBITDA
  dcf: 0.25,          // Fluxo de caixa descontado
  nav: 0.05,          // Valor patrimonial
  replacement: 0.05,  // Custo de reposição
}
```

Soma deve ser `1.0`.

### Trocar paleta de cores

Variáveis CSS em `src/styles/main.css`, blocos `:root` (dark) e `html.light`.

---

## Deploy

### GitHub Pages (recomendado)

```bash
git init -b main
git add .
git commit -m "Versão inicial"
gh repo create valuation-calculator --public --source=. --push
```

No GitHub: **Settings → Pages → Source: main / root**. Em ~1 min: `https://SEU_USUARIO.github.io/valuation-calculator/`.

### Netlify / Vercel / Cloudflare Pages

Conecte o repositório — não há build step. Aponte para o diretório raiz.

---

## Notas técnicas

- **Tailwind via CDN (Play CDN)** — não há build/PostCSS. Algumas classes customizadas (`bg-brand-500`) dependem de `tailwind.config` ser lido em runtime; cores críticas usam CSS puro como fallback.
- **ES Modules** — exigem servir via HTTP(S). Não abra `index.html` direto pelo navegador.
- **Suporte de browsers:** Chrome/Edge 105+, Firefox 121+, Safari 15.4+ (usa `:has()` em CSS).
- **Sem build, sem package.json** — dá pra ir do `git clone` ao deploy em segundos.

---

## Roadmap (ideias futuras)

- Comparador lado a lado de cenários salvos
- Importar dados de planilha (CSV)
- Modo "consultor" com white-label (logo do usuário no PDF)
- Análise temporal (rodar a cada trimestre e comparar evolução)
- Integração com APIs de comparáveis públicas (Crunchbase, etc.)

---

## Licença

Educacional. Não substitui análise profissional de Fusões e Aquisições (M&A) — para decisões reais de venda, captação ou fusão, consulte um analista financeiro qualificado.
