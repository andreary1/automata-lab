# Progresso

## Etapa 1 — Editor e autômatos finitos ✅ (19/10/2026)

### Funcionando (verificado)
- Editor SVG: criar/mover/renomear/excluir estados; estado inicial (seta) e de aceitação (círculo
  duplo); criar transições por arrasto ou clique-clique; laços; arestas opostas curvas; desvio de
  estados no caminho; seleção múltipla (Shift); zoom (roda/botões), deslocamento, ajustar à tela,
  organizar automaticamente (desfazível); desfazer/refazer; atalhos de teclado.
- Edição de transição por caixas de seleção dos símbolos de Σ + ε, com indicação de conflito em AFD.
- Alfabeto: adicionar (validado), renomear e remover (com confirmação se em uso).
- Validação com severidade, explicação e "como resolver"; ações rápidas (completar com poço,
  mudar para AFN, adicionar símbolo a Σ).
- Tabela δ e definição formal sincronizadas com o diagrama.
- Simulação AFD/AFN com ε: executar, pausar, avançar, voltar, interromper, reiniciar, velocidade;
  histórico de configurações clicável; destaque de estados ativos e transições usadas (cor +
  traço + marcador); explicação por passo e motivo final.
- Teste em lote em Web Worker, com esperado/obtido, passos, limite configurável e cancelamento.
- Projetos múltiplos (novo, abrir, duplicar, excluir), salvamento automático local, importar/exportar
  JSON versionado, exportar SVG/PNG; temas claro/escuro; layout responsivo.
- 9 exemplos (4 reproduzem máquinas do livro).

### Verificações executadas
- `npm test`: 43 testes (palavra vazia, símbolos fora de Σ, ciclos ε, inalcançáveis, ausentes e
  conflitantes, completar com poço preserva a linguagem, aceitação/rejeição dos exemplos,
  limites e cancelamento, importação/exportação sem perda, armazenamento).
- `npm run build`: sem erros de tipo.
- Fluxo no navegador (Playwright/Chromium, roteiro em sessão de desenvolvimento): AFD do zero,
  poço, desfazer/refazer, conflito → AFN, N₁ passo a passo, entrada inválida, lote, recarregar
  página, exportar/importar JSON, importação inválida recusada, SVG/PNG, tema escuro, tablet e
  celular sem rolagem horizontal; sem erros de console.

### Limitações conhecidas
- Enumeração de cadeias nos testes é complementar e não prova equivalência (será feita por
  métodos exatos na Etapa 2).
- Sem seleção por retângulo; seleção múltipla é por Shift+clique.
- Em celular, o uso é básico: painéis laterais viram gavetas sobrepostas.
- Testes automatizados de interface não fazem parte do `npm test` (o roteiro de navegador foi
  executado manualmente nesta sessão).

## Próximas etapas
1. **Etapa 2 — Linguagens regulares**: ler "Fecho sob as operações regulares" (p. 60) e §1.3 (a partir da p. 65)
   antes. AFN → AFD (mostrar subconjuntos), minimização, ER → AFN, AF → ER, operações com Σ
   explícito, equivalência com contraexemplo.
2. **Etapa 3 — AP** (§2.2, p. 114+). 3. **Etapa 4 — MT** (§3.1, p. 143+).
