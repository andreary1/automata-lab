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

## Próximas etapas
1. **Etapa 3 — Autômatos com pilha**: ler §2.2 (Def. 2.13, definição formal de computação, exemplos)
   antes; conferir o deslocamento de páginas do PDF. Editor de transições (lê, desempilha, empilha),
   visualização da pilha, simulação não determinística em largura, aceitação por estado final como
   padrão do livro (pilha vazia como modo separado), exemplo {aⁿbⁿ | n ≥ 0}.
2. **Etapa 4 — MT** (§3.1, p. 143+).
