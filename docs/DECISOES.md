# Decisões teóricas e técnicas

Três categorias, sempre separadas:
**[Livro]** definição/resultado verificado no PDF; **[Complementar]** algoritmo que não vem do
livro; **[App]** convenção escolhida pelo aplicativo.

## Fontes consultadas no livro (Etapa 1)

O PDF fornecido é digitalizado (sem camada de texto); as páginas foram lidas visualmente.
**Mapa de páginas:** página do livro + 16 = página do PDF até a p. 54 do livro; o PDF tem uma
página em branco inserida (PDF 71), então a partir da p. 55 do livro o deslocamento é +17.

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

Sumário (para as próximas etapas): Expressões regulares §1.3 (p. 65), operações regulares
p. 44 e 60, AP §2.2 (p. 114), MT §3.1 (p. 143), decidibilidade cap. 4 (p. 173).
Essas seções **ainda não foram lidas**; ler antes das Etapas 2–4.

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
  (A conversão AFN → AFD por subconjuntos é da Etapa 2.)

## Símbolos e entrada

- **[App]** Símbolo: texto não vazio, sem espaços e sem vírgula; ε, ∅ e `eps` são reservados.
- **[App]** Se todos os símbolos de Σ têm 1 caractere, a entrada é lida caractere a caractere
  (espaços ignorados). Se algum tem vários caracteres (ex.: RESET, como ⟨RESET⟩ do Exemplo 1.13),
  a entrada **deve** ter símbolos separados por espaço. Não há divisão "gulosa".
- **[App]** Palavra vazia: campo vazio, ou exatamente `ε`. Em lote, a linha `ε` também vale.
- Símbolo fora de Σ → resultado **Máquina ou entrada inválida**, com a posição.

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
  `schemaVersion` (=1), validação estrutural completa na importação; importar sempre cria
  projetos novos.
- Exportação SVG/PNG serializa o mesmo SVG do canvas (sem segunda implementação de desenho).

## Pontos de extensão previstos

- `RunStatus` e `STATUS_LABEL` já cobrem os seis resultados para AP e MT.
- `schema.ts` tem `migrate()` para novas versões de esquema; `machine.kind` será ampliado
  (`'pda'`, `'tm'`) com modelos próprios em `core/pda/`, `core/tm/`.
- O canvas recebe rótulos via `edgeLabel()`; AP e MT precisarão de rótulos estruturados
  (leitura, desempilha, empilha / lê, escreve, move) editados em campos próprios.
