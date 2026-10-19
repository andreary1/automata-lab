# Decisões teóricas e técnicas

Três categorias, sempre separadas:
**[Livro]** definição/resultado verificado no PDF; **[Complementar]** algoritmo que não vem do
livro; **[App]** convenção escolhida pelo aplicativo.

## Fontes consultadas no livro

O PDF fornecido é digitalizado (sem camada de texto); as páginas foram lidas visualmente.
**Mapa de páginas (o deslocamento muda ao longo do PDF; sempre confira o número impresso):**
página do livro + 16 até a p. 54; +17 da p. 55 em diante no capítulo 1 (o PDF 71 é uma página em
branco inserida); no capítulo 2 volta a ser +16 (p. 115 = PDF 131); no capítulo 4 o deslocamento
observado é +14 (p. 176–177 = PDF 190–191).

### Etapa 1

| Assunto | Referência | Página do livro (PDF) |
|---|---|---|
| Definição de autômato finito (AFD) | Definição 1.5 | 36 (52) |
| M₁ e sua descrição formal | Figura 1.6 | 36–37 (52–53) |
| Exemplos M₂–M₅, símbolo ⟨RESET⟩ | Exemplos 1.7–1.13, Fig. 1.14 | 37–40 (53–56) |
| Definição formal de computação (AFD) | — | 41 (57) |
| Cadeia de M₅ do Exemplo 1.17 | Exemplo 1.17 | 41 (57) |
| Não determinismo, N₁ | Figura 1.27 | 48–49 (64–65) |
| Árvore de computação de N₁ em 010110 | Figuras 1.28–1.29 | 50 (66) |
| N₄ | Exemplo 1.35, Figura 1.36 | 54 (70) |
| Definição de AFN | Definição 1.37 | 55 (72) |
| Definição formal de computação (AFN) | — | 55–56 (72–73) |
| AFN → AFD e fecho E(R) | Teorema 1.39 (prova) | 56–57 (73–74) |

### Etapa 2

| Assunto | Referência | Página do livro (PDF) |
|---|---|---|
| Operações regulares ∪, ∘, * | Definição 1.23 | 45 (61) |
| União pelo produto; interseção (F = F₁ × F₂) | Teorema 1.25 e nota 3 | 46–47 (62–63) |
| AFN → AFD em N₄ (resultado usado como teste) | Exemplo 1.41, Figuras 1.43–1.44 | 58–60 (75–77) |
| União, concatenação e estrela por AFN | Teoremas 1.45, 1.47, 1.49 | 60–64 (77–81) |
| Definição de expressão regular; precedência; R⁺, Σ | Definição 1.52 e p. 65–67 | 65–67 (82–84) |
| Identidades e exemplos de linguagens | Exemplo 1.53 | 67–68 (84–85) |
| ER → AFN (casos 1–6) | Lema 1.55 | 68–69 (85–86) |
| (ab ∪ a)* gera 8 estados | Exemplo 1.56, Figura 1.57 | 70 (87) |
| AFNG, formato especial, CONVERT | Definição 1.64, Lema 1.60, Afirmativa 1.65 | 72–76 (89–93) |
| AF → ER de 2 e 3 estados | Exemplos 1.66 e 1.68, Figuras 1.67 e 1.69 | 76–78 (93–95) |
| Vacuidade e equivalência de AFDs | Teoremas 4.4 e 4.5 | 176–177 (190–191) |

### Etapa 3

| Assunto | Referência | Página do livro (PDF) |
|---|---|---|
| Pilha, ideia do AP para {0ⁿ1ⁿ} | §2.2 | 115 (131) |
| Definição de AP; Σε, Γε | Definição 2.13 | 116 (132) |
| Definição formal de computação (s₀ = ε, s = at, aceitação em F) | — | 116–117 (132–133) |
| AP M₁ para {0ⁿ1ⁿ}; diagramas "a, b → c"; $ como marcador de fundo | Exemplo 2.14, Figura 2.15 | 117–118 (133–134) |
| AP para aⁱbʲcᵏ com i = j ou i = k | Exemplo 2.16, Figura 2.17 | 118–119 (134–135) |
| AP para wwᴿ | Exemplo 2.18, Figura 2.19 | 119 (135) |
| Abreviação (r, u) ∈ δ(q, a, s): empilhar cadeia, u₁ no topo | Prova do Lema 2.21, Figura 2.23 | 121–122 (137–138) |

Ainda não lida: MT §3.1 (p. 143+). Ler antes da Etapa 4, conferindo o deslocamento de páginas.

## Autômatos finitos

- **[Livro]** AFD = (Q, Σ, δ, q0, F), δ: Q × Σ → Q (Def. 1.5). F = ∅ é permitido e reconhece ∅.
- **[Livro]** AFN = (Q, Σ, δ, q0, F), δ: Q × Σε → P(Q), Σε = Σ ∪ {ε} (Def. 1.37).
- **[Livro]** AFN aceita w se w = y1…ym com yi ∈ Σε e existe r0…rm com r0 = q0,
  r(i+1) ∈ δ(ri, y(i+1)), rm ∈ F (p. 55).
- **[Livro]** E(R) = estados alcançáveis a partir de R por 0 ou mais setas ε, incluindo R (p. 57).
- **[Complementar]** Simulação por conjunto de estados ativos: A0 = E({q0}),
  A(i+1) = E(∪ δ(r, a)). Aceita sse An ∩ F ≠ ∅. É a mesma construção da prova do Teorema 1.39
  aplicada "sob demanda"; equivale à definição de aceitação acima. Fecho calculado por busca em
  largura com conjunto de visitados (ciclos ε terminam).
- **[App]** Armazenamento como arestas do diagrama: no máximo uma aresta por par (origem, destino),
  com um conjunto de símbolos e um indicador ε. δ, tabela e definição formal são derivados.
- **[App]** Estados têm `id` estável; o nome é só rótulo. Nomes duplicados ou vazios são erro.
- **[App] AFD incompleto.** A Def. 1.5 exige δ total. O editor permite rascunho incompleto: a
  validação mostra **aviso** listando os pares ausentes e oferece "Completar com estado poço"
  (só por ação do usuário). Na simulação, δ ausente equivale a um **poço implícito** (a cadeia é
  rejeitada), e a explicação diz isso explicitamente. Conflitos (2+ destinos) e ε em AFD são
  **erros** e bloqueiam a simulação.
- **[App]** Mudar o tipo AFD ↔ AFN não altera estados nem transições; só as regras de validação.
  Para converter de fato, use "Linguagens regulares → AFN → AFD".

## Símbolos e entrada

- **[App]** Símbolo: texto não vazio, sem espaços e sem vírgula; ε, ∅ e `eps` são reservados.
  Símbolos que coincidem com operadores de ER (ex.: `(`, `*`, `|`) são aceitos em Σ, mas numa ER
  devem ser escritos entre `< >`.
- **[App]** Se todos os símbolos de Σ têm 1 caractere, a entrada é lida caractere a caractere
  (espaços ignorados). Se algum tem vários caracteres (ex.: RESET, como ⟨RESET⟩ do Exemplo 1.13),
  a entrada **deve** ter símbolos separados por espaço. Não há divisão "gulosa".
- **[App]** Palavra vazia: campo vazio, ou exatamente `ε`. Em lote, a linha `ε` também vale.
- Símbolo fora de Σ → resultado **Máquina ou entrada inválida**, com a posição.

## Linguagens regulares (Etapa 2)

Todos os algoritmos estão em `src/core/regular/`, sem React, e rodam num Web Worker cancelável
com limite de estados (padrão 5000). Os resultados **sempre** abrem como projeto novo.

### Expressões regulares — sintaxe **[App]**, semântica **[Livro, Def. 1.52]**

| Escrita | Significado |
|---|---|
| `a`, `0` | símbolo de Σ com um caractere |
| `<RESET>`, `<+>` | símbolo com vários caracteres ou que coincide com um operador |
| `ε` | a palavra vazia (linguagem {ε}) |
| `∅` ou `{}` | a linguagem vazia |
| `R ∪ S` ou `R \| S` | união |
| `RS` ou `R ∘ S` | concatenação |
| `R*` | estrela |
| `R⁺` ou `R^+` | abreviação do livro: RR* |
| `Σ` | abreviação do livro: (a₁ ∪ … ∪ aₖ) para o Σ informado |
| `( R )` | agrupamento |

- Precedência (p. 66): estrela > concatenação > união; todas associam à esquerda.
- `+` sozinho é **recusado**: em alguns livros é união, no Sipser é R⁺. A mensagem explica.
- Não há atalho `eps` para ε: se Σ tiver as letras e, p, s, ficaria ambíguo.
- Σ é explícito (campo próprio, pré-preenchido com o do projeto) ou inferido dos símbolos usados.
  Símbolo fora de Σ é erro com posição.
- **Não** se usa o mecanismo de regex do JavaScript em nenhum algoritmo. (Os testes usam regex de JS
  apenas como oráculo de amostragem, marcado como complementar.)

### Conversões e operações

- **[Livro]** AFN → AFD: Teorema 1.39. **[App]** só os subconjuntos **alcançáveis** a partir de
  E({q0}) são gerados (como na Fig. 1.44); o total 2^k é informado. ∅ aparece quando alcançado e
  torna o AFD completo. Cada estado é rotulado pelo subconjunto que representa.
- **[Complementar]** Minimização: remoção de inalcançáveis + refinamento de partição de Moore a
  partir de {F, Q − F}; as rodadas são exibidas. AFN é determinizado e AFD incompleto é completado
  com poço antes (avisado). O resultado é o AFD completo mínimo (Myhill–Nerode).
- **[Livro]** ER → AFN: Lema 1.55 literal, sem simplificações (por isso (ab ∪ a)* tem 8 estados,
  como no Exemplo 1.56). Estados renumerados q0, q1, … em ordem de busca em largura.
- **[Livro]** AF → ER: AFNG (Lema 1.60). **[Complementar]** aplicado também a AFN (um AFN com os dois
  estados novos já é um AFNG no formato especial). **[App]** ordem de remoção: heurística (menor
  entrada × saída) ou ordem dos estados; simplificações que preservam a linguagem são opcionais
  (R ∪ ∅ = R, R ∪ R = R, ε ∪ R* = R*, Rε = εR = R, R∅ = ∅R = ∅, ∅* = ε, ε* = ε, (R*)* = R*).
  **Toda ER produzida é verificada** convertendo-a de volta (Lema 1.55) e testando equivalência exata.
- **[Livro]** ∪, ∘, * por AFN (Teoremas 1.45, 1.47, 1.49); ∩ pelo produto (Teorema 1.25, nota 3).
  **[Complementar]** A − B pelo produto com F = F₁ × (Q₂ − F₂).
- **Σ explícito.** Operações binárias usam Σ = Σ₁ ∪ Σ₂ (sugestão do livro na prova do Teorema
  1.25). O complemento pede Σ (deve conter o alfabeto da máquina) e é relativo a Σ*.
- **Complemento nunca inverte F de um AFN**: determiniza, completa sobre Σ (símbolos novos vão
  ao poço) e só então troca F por Q − F. Um teste confirma que a inversão ingênua dá outra linguagem.
- **[Livro]** Equivalência: Teorema 4.5 (diferença simétrica vazia) + Teorema 4.4 (vacuidade por
  alcançabilidade). **[Complementar]** implementação por busca em largura no produto dos AFDs
  completos: é exata (examina todos os pares alcançáveis) e devolve um contraexemplo de
  comprimento **mínimo**, dizendo quem o aceita. Testes com cadeias são só complementares.
- **[App]** Nomes gerados: estados das operações ∪/∘ recebem prefixo "A." e "B."; produto usa pares
  "(p, q)". Ao abrir, há a opção de renomear para q0, q1, … (a correspondência vai para a descrição).
- **[App]** Limites: estados de qualquer máquina produzida (configurável), pares do produto
  (20 × o limite) e tamanho das ER intermediárias (200 mil caracteres). Exceder dá
  **inconclusivo**, nunca um resultado parcial.

## Autômatos com pilha (Etapa 3)

Núcleo em `src/core/pda/`, sem React. Simulação em Web Worker cancelável.

- **[Livro]** AP = (Q, Σ, Γ, δ, q0, F), δ: Q × Σε × Γε → P(Q × Γε) (Def. 2.13).
- **[Livro]** Computação (p. 116–117): começa em q0 com a pilha **vazia** (s₀ = ε); um passo de
  (q, i, at) usa (r, b) ∈ δ(q, w_{i+1}, a) e vai a (r, i′, bt), lendo um símbolo ou ε, desempilhando
  a (ou ε) e empilhando b (ou ε). **Aceita** se existe uma computação que lê toda a entrada e termina
  em F. Passar por F antes do fim não basta (há teste e exemplo).
- **[Livro]** O livro não tem teste de pilha vazia nem de fim de entrada; usa o marcador $ (p. 118).
  Os exemplos seguem isso.
- **[App]** Pilha escrita como cadeia com o **topo à esquerda** (como "at" no livro), e desenhada
  na vertical com o topo em cima.
- **[App]** Empilhar mais de um símbolo é permitido como a **abreviação da Figura 2.23**:
  (r, u₁…uₗ) ∈ δ(q, a, s) empilha uₗ primeiro e u₁ por último, então **u₁ fica no topo**. A validação
  marca essas transições com uma informação (não é erro).
- **[App]** Edição por campos: "Lê" (ε ou símbolo de Σ), "Desempilha" (ε ou símbolo de Γ),
  "Empilha" (cadeia de Γ, vazio = ε; com símbolos de vários caracteres, separe por espaço). Cada seta
  guarda várias transições, exibidas uma por linha no rótulo.
- **[App] Modo de aceitação.** Padrão: estado final (livro). Modo separado: **pilha vazia**, com
  pilha inicial opcional (ex.: Z). No modo pilha vazia F é ignorado (aviso) e, com pilha inicial
  vazia, ε é sempre aceita (aviso).
- **[Complementar] Busca em largura nas configurações** (estado, posição, pilha): estratégia justa,
  todo ramo avança um passo antes de qualquer outro avançar dois. Estados iguais com pilhas
  diferentes são configurações diferentes. Configurações idênticas já vistas não são reexploradas
  (mesmo futuro), o que garante término quando o conjunto alcançável é finito.
- **Resultados:** aceita assim que um ramo aceita (a BFS dá um caminho de aceitação de menor
  número de passos); **rejeita somente** se todas as configurações alcançáveis foram exploradas e
  nenhum ramo foi cortado; caso contrário **inconclusiva** (limite de passos/profundidade, de
  configurações ou de altura da pilha). Um limite nunca é tratado como prova de execução infinita.
- **[App]** Limites por projeto (esquema v2): passos (profundidade), configurações (padrão 50 000)
  e altura da pilha (padrão 500), editáveis na aba Teste em lote.
- **[App]** Interface da simulação: o veredito aparece assim que a busca termina; depois é possível
  percorrer o **caminho de aceitação** (com a explicação de cada transição e a pilha) ou **todos os
  ramos** de cada passo da busca. No diagrama, o número no estado indica quantas configurações estão
  nele. "Passos" no lote = profundidade alcançada (no aceite, comprimento do caminho).
- **[App]** As ferramentas de Linguagens regulares só aceitam autômatos finitos; com um AP aberto,
  o painel explica isso e permite usar outros projetos ou ERs.

## Resultados

Aceita · Rejeitada · Execução em andamento · Interrompida pelo usuário · Inconclusiva (limite de
recursos) · Máquina ou entrada inválida. Atingir o limite de passos produz **inconclusiva**,
nunca rejeição. Lote cancelado marca as cadeias restantes como interrompidas.

## Técnicas

- React 18.3 + TypeScript 5.8 + Vite 6; Zustand 5 para estado; Vitest 3 para testes.
- Editor de grafo próprio em SVG (sem biblioteca): controle total sobre laços, arestas opostas
  curvas, desvio de estados no caminho, estado inicial e círculo duplo.
- Desfazer/refazer por snapshots imutáveis da máquina (limite 200); arrastar gera uma única entrada.
- Lote executa em Web Worker (embutido no bundle); cancelar = `terminate()`. Se o navegador não
  permitir workers, roda na thread principal em fatias, também cancelável.
- Persistência: `localStorage`, uma chave por projeto + índice; JSON com `format` e
  `schemaVersion` (2 desde a Etapa 3; arquivos v1 continuam sendo aceitos), validação estrutural
  completa na importação; importar sempre cria projetos novos. Versões antigas do app recusam
  arquivos v2 com mensagem clara em vez de lê-los errado.
- Modelos desenhados como grafo compartilham `GraphMachine` (`src/core/graph.ts`); edição, layout e
  geometria são genéricos. `src/core/machine.ts` reúne o tipo `Machine` (AF | AP) e o despacho
  (validação, rótulos, alfabeto de entrada).
- Exportação SVG/PNG serializa o mesmo SVG do canvas (sem segunda implementação de desenho).

## Pontos de extensão previstos

- `RunStatus` e `STATUS_LABEL` cobrem os seis resultados, usados por AF e AP; a MT usará os mesmos.
- Para a MT: acrescentar `'tm'` ao tipo `Machine`, um `parseTM` em `schema.ts` (subindo
  `SCHEMA_VERSION`), rótulos em `edgeLabelLines`, painéis próprios (como `PDAPanels.tsx`) e uma vista
  de fita (como `PDASimulation.tsx`).
- Extensões futuras previstas no prompt: GLC ↔ AP (Lema 2.21 já está lido), MT multifita e não
  determinística.
