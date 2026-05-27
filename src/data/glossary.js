// Glossário de termos financeiros para o usuário leigo
export const GLOSSARY = [
  {
    term: 'Valuation',
    def: 'Valor estimado de mercado de uma empresa. Resultado da consolidação ponderada dos 5 métodos.',
  },
  {
    term: 'EBITDA',
    def: 'Lucro Antes de Juros, Impostos, Depreciação e Amortização. Reflete a geração de caixa puramente operacional, sem distorções contábeis ou fiscais.',
  },
  {
    term: 'Margem EBITDA',
    def: 'EBITDA dividido pelo faturamento, em %. Mede eficiência operacional. Para EAD/SaaS, acima de 15% já é considerado saudável.',
  },
  {
    term: 'DCF (Fluxo de Caixa Descontado)',
    def: 'Projeta os lucros futuros da empresa (aqui, 5 anos) e os "traz a valor presente" usando uma taxa de desconto (WACC). É o método mais usado em M&A.',
  },
  {
    term: 'WACC',
    def: 'Custo Médio Ponderado de Capital. Para negócios digitais brasileiros, 18%–25% é a faixa usual — quanto mais risco, maior o WACC.',
  },
  {
    term: 'Múltiplo de Faturamento',
    def: 'Avaliação rápida: receita × um fator entre 1.5x (100% avulso) e 2.0x (100% assinatura). Negócios híbridos recebem múltiplo interpolado conforme o % de receita recorrente.',
  },
  {
    term: 'Múltiplo de EBITDA',
    def: 'EBITDA × fator setorial entre 5.0x e 6.5x (interpolado pela composição recorrente vs. avulsa). +0.5 se a empresa tem mais de 3 anos. É o múltiplo "rei" em transações reais.',
  },
  {
    term: 'Composição da receita',
    def: 'Fração da receita que vem de assinaturas/recorrência (MRR) versus vendas avulsas/lançamentos. Receita recorrente vale mais — previsibilidade reduz risco e aumenta os múltiplos.',
  },
  {
    term: 'Valor Patrimonial Líquido (NAV)',
    def: 'Soma dos ativos (caixa, equipamentos, recebíveis) menos as dívidas. É o "valor de liquidação" — piso teórico do negócio.',
  },
  {
    term: 'Custo de Reposição',
    def: 'Quanto custaria recriar o negócio do zero hoje. Aqui usamos 1.2× o investimento inicial como aproximação.',
  },
  {
    term: 'Dependência do fundador',
    def: 'Quando a marca está colada à pessoa do dono (ex: "curso do João"), o negócio vale menos — risco alto se o fundador sair. Aplicamos desconto escalonado (0% a 25%) conforme o nível.',
  },
  {
    term: 'EdTech Subscription',
    def: 'Plataforma de EAD com modelo de assinatura/mensalidade. Faixa típica: múltiplo EBITDA 4–8×, margem saudável 25–45%, crescimento esperado 20% a.a.',
  },
  {
    term: 'SaaS B2B',
    def: 'Software corporativo com receita recorrente. Múltiplos mais altos pela previsibilidade (5–12× EBITDA, até 8× receita).',
  },
  {
    term: 'Setor / Preset',
    def: 'Cada setor tem faixas típicas de múltiplos e margem extraídas de benchmarks de M&A. Servem como ponto de partida — você pode ajustar manualmente no dashboard ("Ajustes finos").',
  },
];

// Benchmarks setoriais (dados públicos aproximados — atualizar conforme necessário)
export const BENCHMARKS = {
  ead: {
    label: 'EAD / Cursos online',
    revenueMultiple: { min: 1.2, median: 1.8, max: 2.5 },
    ebitdaMultiple: { min: 4.0, median: 5.5, max: 7.5 },
    healthyMargin: { min: 15, max: 40 },
  },
  saas: {
    label: 'SaaS B2B',
    revenueMultiple: { min: 2.0, median: 4.0, max: 8.0 },
    ebitdaMultiple: { min: 6.0, median: 8.5, max: 12.0 },
    healthyMargin: { min: 20, max: 45 },
  },
};
