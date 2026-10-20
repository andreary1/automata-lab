# Automata Lab
## Atenção: Esse projeto foi criado com o intuito de facilitar o conteúdo da cadeira "Aspectos Teóricos da Computação"

Laboratório interativo para criar, editar, simular e estudar autômatos, com base teórica em
**Sipser, *Introdução à Teoria da Computação*** (trad. bras.). Interface em português do Brasil.
Funciona inteiramente no navegador: sem login, sem backend, sem IA nos algoritmos.

**Estado atual: Etapas 1 a 4 concluídas** (editor + AFD/AFN com ε + simulação + persistência;
AFN → AFD, minimização, ER ↔ AF, operações regulares e equivalência com contraexemplo;
autômatos com pilha com simulação não determinística em largura; máquinas de Turing
determinísticas de uma fita com fita, cabeçote e limite de passos).
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
    regular/            Etapa 2: subconjuntos, minimização, ER (parser próprio), ER → AFN,
                        AF → ER (AFNG), operações, equivalência; limites e cancelamento
    pda/                Etapa 3: modelo de AP, validação, simulação em largura, lote, exemplos
    tm/                 Etapa 4: modelo de MT, validação, execução com registro compacto, lote, exemplos
    graph.ts            interface comum de modelos desenhados como grafo
    machine.ts          tipo Machine (AF | AP | MT) e despacho por tipo
    persistence/        esquema JSON versionado, validação de importação, localStorage
    examples.ts         exemplos didáticos (alguns reproduzem máquinas do livro)
  state/                estado da aplicação (Zustand), desfazer/refazer, salvamento automático,
                        execução do lote em Web Worker
  workers/              Web Workers do lote, dos algoritmos da Etapa 2 e das simulações de AP e MT
  ui/                   componentes React: canvas SVG, painéis, diálogos, exportação
```

## Uso rápido

- **V / S / T**: ferramentas Selecionar, Estado, Transição. Arraste de um estado a outro para
  criar uma transição (ou clique na origem e depois no destino; o mesmo estado cria um laço).
- Clique numa transição para marcar os símbolos (caixas de seleção, sem sintaxe para digitar).
- Painel direito: propriedades, validação com instruções de correção, tabela δ e definição formal.
- Painel inferior: simulação passo a passo (com histórico de configurações) e teste em lote.
## Autômatos Finitos
<table>
  <tr>
    <td><img width="683" height="299" alt="image" src="https://github.com/user-attachments/assets/5b04d1aa-a72b-4e2e-ad7e-3b217cb63adc" /></td>
    <td><img width="683" height="299" alt="image" src="https://github.com/user-attachments/assets/e3c53bc4-6a96-45df-bb41-f04dfb1c65fe" /></td>
  </tr>
</table> 
- "Linguagens regulares" (barra superior): AFN → AFD, minimizar, ER → AFN, AF → ER, operações e
  equivalência. Os resultados abrem como projetos novos. Sintaxe de ER em `docs/DECISOES.md`.

## Autômato com Pilha
<img width="1366" height="597" alt="image" src="https://github.com/user-attachments/assets/b44dadcf-c26c-4dba-80af-1cce5ae1ee1d" />
- AP: em "Projetos → Novo AP" ou nos exemplos. Clique numa seta para editar as transições por
  campos (lê, desempilha, empilha). A simulação mostra o caminho de aceitação com a pilha ou todos
  os ramos da busca em largura.
  
## Máquina de Turing
<img width="1366" height="597" alt="image" src="https://github.com/user-attachments/assets/71b82093-c12d-4b82-8c47-9e1718f03566" />
- Ctrl+Z / Ctrl+Shift+Z desfazem/refazem; Delete exclui; F ajusta à tela; `?` abre a ajuda.
- MT: em "Projetos → Nova MT" ou nos exemplos. Defina q_aceita (e, se quiser, q_rejeita) no painel
  do estado; clique numa seta para editar lê / escreve / move. A simulação mostra a fita com o
  cabeçote e as configurações u q v; o limite de passos fica na aba Teste em lote.

## Salvamento
O salvamento é **local** (localStorage deste navegador). Não é sincronização em nuvem; exporte em
JSON para guardar uma cópia.
