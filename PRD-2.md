# PRD: Calculadora de Valuation com Gráficos e Análise de Margem (Abordagem Multimetodologia)

## 1. Visão Geral do Produto
O objetivo deste produto é fornecer uma ferramenta web estática (HTML, CSS, JS) avançada para estimar o valor de mercado (*valuation*) de um negócio digital de EAD/Infoprodutos. A calculadora utiliza a abordagem de multimetodologia cruzando **5 métodos de cálculo** consolidados por média ponderada, exibe um **gráfico comparativo visual** e calcula a **margem de lucro** operacional indicando a saúde do negócio.

## 2. Escopo Técnico e Diretrizes de Privacidade
*   **Tecnologias:** HTML5, CSS3 (Tailwind CSS via CDN) e JavaScript Vanilla (ES6+).
*   **Gráficos:** Construídos de forma nativa via CSS/HTML estrutural (barras dinâmicas ou blocos proporcionais) para manter o arquivo leve e sem dependências de bibliotecas externas (como Chart.js).
*   **Privacidade Total:** Execução 100% no navegador (*client-side*). Sem backend, sem banco de dados, sem envio ou salvamento de informações.

---

## 3. Requisitos de Interface e Formulário (Passo a Passo)

A interface deve ser dividida em um formulário sequencial de 4 passos com barra de progresso.

### Passo 1: Perfil e Matriz de Riscos
*   **Modelo de Receita (Radio):**
    *   [ ] Assinatura Recorrência / Clube de Membros (SaaS) -> *(Aumenta múltiplos)*
    *   [ ] Vendas Avulsas / Modelo de Lançamento -> *(Mantém múltiplos no piso)*
*   **Dependência da Imagem do Fundador (Radio):**
    *   [ ] Alta (A marca é o nome do criador/professor) -> *(Aplica penalidade de risco de 20% no final)*
    *   [ ] Baixa (Catálogo corporativo com múltiplos professores/autores) -> *(Sem penalidade)*
*   **Tempo de Mercado / Idade da Empresa (Select):**
    *   ( ) Menos de 1 ano
    *   ( ) De 1 a 3 anos
    *   ( ) Mais de 3 anos

### Passo 2: Dados Financeiros Atualizados (Últimos 12 meses)
Inputs numéricos com formatação dinâmica em tempo real para Moeda Brasileira (R$).
*   **Faturamento Bruto Anual (R$):** Receita total gerada.
*   **EBITDA / Lucro Operacional Anual (R$):** Lucro antes de impostos, juros e depreciação. *(Validar para não ser maior que o faturamento).*

### Passo 3: Dados Patrimoniais e Investimento
Inputs numéricos em R$.
*   **Investimento Inicial Total (R$):** Todo o capital colocado no negócio desde a fundação.
*   **Ativos Líquidos Atuais (R$):** Valor atual de equipamentos físicos + saldos bancários + recebíveis, subtraídos os passivos (dívidas).

---

## 4. Lógica de Cálculo e Métricas Adicionais

### A. Análise da Margem EBITDA (Nova Funcionalidade)
O sistema deve calcular dinamicamente a Margem EBITDA da empresa:
*   `Margem_EBITDA = (EBITDA_Anual / Faturamento_Anual) * 100`
*   **Regra de Feedback Visual do Mercado EAD:**
    *   *Margem < 15%:* Exibir selo **"Margem Baixa"** (Cor amarela/laranja) com o texto: "Sua eficiência operacional está abaixo da média do mercado digital. Foco em otimizar custos de tráfego/infraestrutura."
    *   *Margem entre 15% e 40%:* Exibir selo **"Margem Saudável"** (Cor verde) com o texto: "Sua margem está alinhada com a média de mercado para infoprodutos sustentáveis."
    *   *Margem > 40%:* Exibir selo **"Margem Alta / Alta Eficiência"** (Cor esmeralda/azul de destaque) com o texto: "Excelente eficiência operacional. Negócios digitais com essa margem atraem prêmios em rodadas de investimento."

### B. Os 5 Métodos de Valuation
1.  **Múltiplo de Faturamento Bruto:** `Valuation_1 = Faturamento_Anual * (Modelo_Assinatura ? 2.0 : 1.5)`
2.  **Múltiplo de EBITDA:** `Valuation_2 = EBITDA_Anual * ((Modelo_Assinatura ? 6.5 : 5.0) + (Mais_De_3_Anos ? 0.5 : 0))` *(Se EBITDA <= 0, Valuation_2 = 0)*
3.  **Fluxo de Caixa Descontado (FCD - 5 Anos):** Taxa de desconto (WACC) = `22%`, Crescimento Anual = `12%`. Projeta o EBITDA em cascata por 5 anos trazendo a valor presente via loop JS.
4.  **Valor Patrimonial Líquido:** `Valuation_4 = Ativos_Líquidos_Atuais`
5.  **Custo de Reposição:** `Valuation_5 = Investimento_Inicial_Total * 1.20`

### C. Consolidação (Média Ponderada)
*   Pesos: M1 = `30%`, M2 = `35%`, M3 = `25%`, M4 = `5%`, M5 = `5%`.
*   `Valuation_Bruto = (M1*0.30) + (M2*0.35) + (M3*0.25) + (M4*0.05) + (M5*0.05)`
*   Se Dependência Fundador = "Alta", `Valuation_Final = Valuation_Bruto * 0.80` (Desconto de 20%).

---

## 5. Requisitos de UI/UX e Exibição dos Resultados (Passo 4)

A tela de resultados deve ser um dashboard completo contendo:
1.  **Destaque Principal:** Valor do **Valuation Final Consolidado** com tipografia grande e destaque visual.
2.  **Card de Análise de Margem:** Exibição do valor percentual da Margem EBITDA acompanhado do selo e texto de feedback corretos.
3.  **Gráfico Comparativo Visual (Novo Requisito):**
    *   Um gráfico de barras horizontais construído nativamente com Tailwind (`div` com larguras dinâmicas em `%`).
    *   A barra deve comparar visualmente os valores dos 5 métodos para que o usuário entenda qual método infla ou reduz o valor do seu negócio.
    *   A maior barra representa o método de maior valor (100% de largura da div pai) e as outras se ajustam proporcionalmente.
4.  **Alerta de Risco:** Tarja vermelha/laranja caso a dependência do fundador reduza o valor do negócio.
5.  **Ação:** Botão para "Reiniciar Nova Simulação".
