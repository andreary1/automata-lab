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

## Etapa 2 — Linguagens regulares ✅ (19/10/2026)

### Funcionando (verificado)
- Botão "Linguagens regulares" na barra superior, com seis ferramentas: AFN → AFD (tabela dos
  subconjuntos), Minimizar (rodadas da partição), ER → AFN (leitura ao vivo e erros com posição),
  AF → ER (passos de eliminação, verificação exata automática, cópia), Operações (∪, ∩, −, ∘, *,
  complemento com Σ explícito) e Equivalência (prova ou contraexemplo mínimo, com "Simular no
  projeto atual").
- Operandos: projeto atual, outro projeto salvo ou expressão regular.
- Cálculo em Web Worker com limite de estados configurável e botão Cancelar.
- Resultados abrem como projeto novo; conversões copiam os testes do lote (mesma linguagem);
  opção de renomear estados.
- Nomes longos de estado (subconjuntos) usam fonte menor no canvas e aparecem completos na dica.

### Verificações executadas
- `npm test`: 80 testes (43 da Etapa 1 + 37 novos). Destaques: AFN → AFD de N₄ igual à Figura 1.44;
  (ab ∪ a)* com 8 estados (Exemplo 1.56); AF → ER do Exemplo 1.66 = a*b(a ∪ b)*; ER do Exemplo 1.68
  equivalente à do livro; identidades do Exemplo 1.53 por equivalência exata; toda conversão de todos
  os exemplos verificada por equivalência exata; contraexemplos mínimos; limites e cancelamento.
  Teste de mutação manual: trocar a estrela pela construção ingênua faz um teste falhar.
- `npm run build`: sem erros de tipo.
- Navegador (Playwright/Chromium): as seis ferramentas, abrir resultados como projeto, erro de
  sintaxe ao vivo, contraexemplo simulado no projeto, limite atingido (inconclusivo), cancelamento,
  layout no celular; o roteiro da Etapa 1 continua passando; sem erros de console.

### Limitações conhecidas
- AF → ER pode gerar expressões longas (inerente ao método); não há simplificação algébrica além
  das identidades listadas em DECISOES.md.
- Não há visualização animada passo a passo das construções no canvas; os passos aparecem como
  tabela/lista no painel.
- Nomes de estado do produto podem ficar longos; use a opção de renomear.

## Etapa 3 — Autômatos com pilha ✅ (19/10/2026)

### Funcionando (verificado)
- Novo tipo de projeto **AP** (Projetos → Novo AP, ou exemplos). Editor de transições com campos
  próprios (lê / desempilha / empilha, com validação contra Σ e Γ), várias transições por seta,
  rótulos "a, b → c" em várias linhas no diagrama.
- Painel "Máquina" do AP: Σ, Γ (renomear/remover com confirmação), modo de aceitação (estado final
  do livro ou pilha vazia, separado), pilha inicial.
- Tabela de transições e definição formal (6-upla) do AP.
- Simulação em Web Worker (cancelável): veredito imediato; caminho de aceitação passo a passo com a
  pilha desenhada e a explicação de cada transição; vista de todos os ramos de cada passo da busca;
  contagem de configurações por estado no diagrama.
- Teste em lote para AP com limites de profundidade, configurações e altura da pilha.
- Exemplos: aⁿbⁿ (Ex. 2.14), aⁱbʲcᵏ (Ex. 2.16), wwᴿ (Ex. 2.18), parênteses balanceados (pilha
  vazia) e "ramo infinito" (mostra o resultado inconclusivo).
- Esquema JSON v2 (AP + limites), compatível com arquivos v1.
- Correção também para AF: mudar a cadeia de entrada agora invalida a simulação anterior (antes,
  Executar podia mostrar o resultado da cadeia anterior).

### Verificações executadas
- `npm test`: 99 testes (80 anteriores + 19 novos). Destaques: linguagens dos Exemplos 2.14, 2.16 e
  2.18 conferidas em todas as cadeias até tamanho 7–10 (amostragem complementar); não aceitar por
  passar em F antes do fim; pilha inicial vazia; mesmas configurações com pilhas diferentes; ordem
  da pilha da Figura 2.23; modo pilha vazia separado; ramo infinito inconclusivo (três limites);
  rejeição só com exploração completa; cancelamento; validação; ida e volta JSON v2 e importação v1.
- `npm run build`: sem erros de tipo.
- Navegador (Playwright/Chromium): exemplos, caminho de aceitação e ramos, rejeições, inconclusivo,
  interromper busca longa, pilha vazia, lote, tabela e definição formal, AP criado do zero com
  edição por campos e erro de Γ, exportar/importar/recarregar, aviso no painel de linguagens
  regulares, tema escuro e celular; roteiros das Etapas 1 e 2 continuam passando; sem erros de console.

### Limitações conhecidas
- Conversões GLC ↔ AP ainda não existem (extensão futura prevista).
- A vista "todos os ramos" lista até 80 configurações por passo (o total é informado).
- Com limites muito altos, a busca pode consumir bastante memória (os traços guardam as
  configurações para a navegação); por isso os limites são configuráveis.

## Refinamento de interação (princípios da Apple) ✅ (19/10/2026)
- Câmera com mola interrompível, inércia ao soltar, arraste 1:1 com grade ao soltar, "Organizar"
  animado, diálogos/avisos com entrada e saída simétricas, materiais translúcidos, tipografia em rem,
  e respeito a reduzir movimento, transparência reduzida e alto contraste (detalhes em DECISOES.md).
- Verificado no navegador com medições: quadros intermediários nas animações, parada exata ao
  interromper, inércia que continua e para, posição sem grade durante o arraste e com grade após
  soltar, desfazer em uma etapa, diálogo ainda visível ao sair e removido depois, escala ao
  pressionar, `backdrop-filter` ativo; com "reduzir movimento", tudo instantâneo. Roteiros das
  Etapas 1–3 continuam passando; 99 testes; sem erros de console.

## Próximas etapas
1. **Etapa 4 — Máquinas de Turing**: ler §3.1 (Def. 3.3, configurações, exemplos 3.7–3.12),
   conferindo o deslocamento de páginas. MT determinística de uma fita, fita dinâmica, estados de
   aceitação e rejeição separados, convenção de fronteira da fita do livro, limite de passos
   (inconclusivo ≠ rejeição), sem prometer decidir parada/equivalência.
