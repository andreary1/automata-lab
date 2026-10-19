# Automata Lab

Laboratório interativo para criar, editar, simular e estudar autômatos, com base teórica em
**Sipser, *Introdução à Teoria da Computação*** (trad. bras.). Interface em português do Brasil.
Funciona inteiramente no navegador: sem login, sem backend, sem IA nos algoritmos.

**Estado atual: Etapa 1 concluída** (editor + AFD/AFN com ε + simulação + persistência).
Veja [`docs/PROGRESSO.md`](docs/PROGRESSO.md) para o que existe e o que vem a seguir, e
[`docs/DECISOES.md`](docs/DECISOES.md) para as convenções teóricas e técnicas.

## Executar

Requer Node 18+ (testado com Node 22).

```bash
npm install
npm run dev          # servidor de desenvolvimento (http://localhost:5173)
npm test             # testes do núcleo matemático e da persistência (Vitest)
npm run build        # verificação de tipos + build em dist/
npm run build:single # build num único index.html autocontido em dist-single/
npm run preview      # serve o build de dist/
```

## Estrutura

```
src/
  core/                 núcleo matemático — sem React, testável isoladamente
    fa/model.ts         representação única da máquina (5-upla; ids estáveis)
    fa/symbols.ts       regras de símbolos e divisão da entrada em símbolos
    fa/delta.ts         δ derivada das arestas, fecho-ε, alcançabilidade
    fa/validate.ts      validação contra Def. 1.5 (AFD) e Def. 1.37 (AFN)
    fa/simulate.ts      simulação com traço passo a passo e explicações
    fa/batch.ts         teste em lote com limite de passos e cancelamento
    fa/edit.ts          operações puras de edição (inclui completar com poço)
    fa/table.ts         tabela de transições derivada
    fa/layout.ts        organização automática (algoritmo complementar)
    persistence/        esquema JSON versionado, validação de importação, localStorage
    examples.ts         exemplos didáticos (alguns reproduzem máquinas do livro)
  state/                estado da aplicação (Zustand), desfazer/refazer, salvamento automático,
                        execução do lote em Web Worker
  workers/              Web Worker do teste em lote
  ui/                   componentes React: canvas SVG, painéis, diálogos, exportação
```

## Uso rápido

- **V / S / T**: ferramentas Selecionar, Estado, Transição. Arraste de um estado a outro para
  criar uma transição (ou clique na origem e depois no destino; o mesmo estado cria um laço).
- Clique numa transição para marcar os símbolos (caixas de seleção, sem sintaxe para digitar).
- Painel direito: propriedades, validação com instruções de correção, tabela δ e definição formal.
- Painel inferior: simulação passo a passo (com histórico de configurações) e teste em lote.
- Ctrl+Z / Ctrl+Shift+Z desfazem/refazem; Delete exclui; F ajusta à tela; `?` abre a ajuda.

O salvamento é **local** (localStorage deste navegador). Não é sincronização em nuvem; exporte em
JSON para guardar uma cópia.
