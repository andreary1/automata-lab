import { useEffect, useId, useRef, useState } from 'react';

export const HELP: Record<string, { title: string; body: string }> = {
  epsilon: {
    title: 'ε (palavra vazia)',
    body: 'ε é a cadeia de comprimento zero. Numa transição de AFN, ε significa que a máquina pode mudar de estado sem ler símbolo algum. ε não é símbolo de Σ. Não confunda com ∅, o conjunto vazio: a linguagem ∅ não contém nenhuma cadeia, nem ε; já {ε} contém exatamente uma.',
  },
  sink: {
    title: 'Estado poço',
    body: 'Um estado de não aceitação do qual não se sai: todos os símbolos levam a ele mesmo. Completar um AFD com um poço torna δ total (como exige a Def. 1.5) sem mudar a linguagem. O app só faz isso quando você pede.',
  },
  nondeterminism: {
    title: 'Não determinismo',
    body: 'Num AFN, de um estado pode haver zero, uma ou várias transições para o mesmo símbolo, além de transições ε. A máquina segue todas as possibilidades "em paralelo"; ela aceita se ALGUM ramo terminar em um estado de aceitação depois de consumir toda a entrada. O simulador mostra o conjunto de estados ativos de todos os ramos.',
  },
  configuration: {
    title: 'Configuração',
    body: 'Uma "fotografia" da computação: em autômatos finitos, o estado (ou conjunto de estados ativos, num AFN) e a posição na entrada. O histórico lista as configurações; clique numa delas para voltar a ela.',
  },
  closure: {
    title: 'Fecho-ε, E(R)',
    body: 'Conjunto de estados alcançáveis a partir de R seguindo zero ou mais transições ε (inclui o próprio R). O simulador aplica o fecho no início e depois de cada símbolo lido. Ciclos de ε são tratados sem repetição infinita.',
  },
  pdaConfig: {
    title: 'Configuração de um AP',
    body: 'É o trio (estado, posição na entrada, conteúdo da pilha). Dois ramos no mesmo estado mas com pilhas diferentes são configurações diferentes. A pilha é escrita com o topo à esquerda, como no livro (s = at, com a no topo). A simulação explora as configurações em largura: todo ramo avança um passo antes de qualquer ramo avançar dois.',
  },
  pdaAcceptance: {
    title: 'Aceitação em AP',
    body: 'Padrão do Sipser: aceita se algum ramo consegue ler TODA a entrada e estar num estado de aceitação (a pilha pode ter qualquer conteúdo). Passar por F no meio da entrada não basta. O modo "pilha vazia" é uma convenção alternativa, oferecida separadamente: aceita se algum ramo lê toda a entrada com a pilha vazia. Rejeitar exige explorar todas as configurações alcançáveis; se um limite for atingido antes, o resultado é inconclusivo.',
  },
  tmTape: {
    title: 'Fita e cabeçote da MT',
    body: 'Convenção do Sipser (p. 146): a entrada ocupa as células mais à esquerda; o resto da fita (infinita só para a direita) contém brancos ⊔; o cabeçote começa na primeira célula. Se a máquina tentar mover para a esquerda na primeira célula, o cabeçote fica onde está. O app cria células novas à direita conforme o cabeçote avança, por isso não há limite de fita além do limite de passos.',
  },
  tmHalt: {
    title: 'Parar, aceitar, rejeitar, laço',
    body: 'A MT para assim que entra em q_aceita ou q_rejeita. Pares (estado, símbolo) sem transição levam a q_rejeita (convenção do livro, p. 152). Se nunca entrar em um deles, ela não para (laço). O app só afirma "não para" quando uma configuração inteira se repete, o que é uma prova para máquinas determinísticas. Quando o limite de passos acaba, o resultado é "inconclusiva": não existe algoritmo geral que decida se uma MT aceita uma entrada (Teorema 4.11) e o app não tenta decidir parada.',
  },
  tmConfig: {
    title: 'Configuração de uma MT',
    body: 'Escrita como u q v (p. 147–148): u é o conteúdo à esquerda do cabeçote, q o estado e v o conteúdo a partir do cabeçote (o cabeçote está sobre o primeiro símbolo de v). Brancos à direita do último símbolo não branco são omitidos; quando o cabeçote está além do fim, v = ⊔.',
  },
  tokens: {
    title: 'Como a entrada é dividida',
    body: 'Se todos os símbolos de Σ têm um caractere, a cadeia é lida caractere a caractere (espaços são ignorados). Se algum símbolo tem vários caracteres, separe os símbolos por espaço: "1 0 RESET 2". Campo vazio (ou só "ε") = palavra vazia.',
  },
};

export function HelpTip({ topic }: { topic: keyof typeof HELP | string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  const h = HELP[topic];
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);
  if (!h) return null;
  return (
    <span className="helptip" ref={ref}>
      <button
        type="button"
        className="helptip-btn"
        aria-label={`Ajuda: ${h.title}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(!open);
        }}
      >
        ?
      </button>
      {open && (
        <span className="helptip-pop" id={id} role="note">
          <strong>{h.title}</strong>
          <span>{h.body}</span>
        </span>
      )}
    </span>
  );
}
