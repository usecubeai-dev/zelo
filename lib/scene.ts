/**
 * Roteiro da narrativa.
 * A timeline mestre tem duração normalizada de 100 unidades — cada constante
 * abaixo é o instante em que aquele beat acontece. Mexer aqui muda a direção
 * da cena inteira sem tocar em nenhum componente.
 */
export const BEAT = {
  /* 1. calma */
  calm: 0,
  copyOut: 6,

  /* 2. interrupções — os intervalos encurtam: 7 e depois 5 */
  charge1: 9,
  charge2: 16,
  charge3: 21,

  /* 3. caos — as chegadas se atropelam */
  whats: 25,
  sheet: 29,
  chaosPeak: 36,

  /* 4. o pico é curto: 6 beats entre a cena cheia e o congelamento */
  freeze: 40,

  /* 5. congelamento de 4 beats, e então o esvaziamento */
  retreat: 44,

  /* 6. o silêncio: a cena está vazia e a câmera parada desde o beat ~51 */
  phrase: 57,
  phraseOut: 66,

  /* ---------------- capítulo 2: do silêncio ao sistema ----------------
     A frase não sai de cena: ela perde importância e vira ambiente. */
  fraseRecua: 67,

  /* o primeiro verde da página inteira — um indicador, nada mais.
     Ele nasce exatamente onde a primeira cobrança vai assentar: o ponto não
     desaparece, ele vira o indicador daquela linha. */
  sinalVerde: 72,

  /* o caos volta da profundidade e se alinha: problema vira estrutura.
     A última linha assenta no beat ~85 e a estrutura fica formada, com os
     indicadores acesos, até a marca começar — um momento precisa existir
     inteiro antes do próximo começar. */
  sistema: 74,

  /* a marca nasce de dentro da estrutura */
  marca: 89,

  /* a travessia: a marca avança em direção à câmera enquanto a interface já
     existe atrás dela, pequena e distante. Oito beats de profundidade — não
     um cruzamento de opacidades. A DURAÇÃO dela (RITMO.travessia) é
     protegida; só a posição absoluta desceu junto com o resto do capítulo. */
  entra: 100,
  interfaceOn: 112,

  /* a cobrança muda de estado, sempre na mesma interface.
     A espera encolheu e a confirmação cresceu: é o oposto da distribuição
     anterior, em que o botão parado tinha mais tempo que o resultado. A
     compressão de densidade encurtou o dwell de todos os estados na mesma
     proporção — a confirmação continua durando mais que a espera. */
  criar: 113,
  criando: 115,
  criada: 120,
  autorizacao: 131,
  autorizado: 139,
  ativa: 149,

  /* onde o capítulo 2 termina. Os tweens dele referenciam ESTA constante e
     não `end` — assim estender a narrativa nunca estica o que já foi
     aprovado. */
  capituloDois: 157,

  /* ---------------- capítulo 3: o dinheiro ----------------
     A interface não é o produto: ela é o começo. O produto é o que acontece
     no dia 05, sozinho. A câmera faz o movimento inverso do capítulo 2 —
     recua e revela que a sala, a mesa e o profissional sempre estiveram lá. */
  abertura: 157,
  diaChega: 163,
  debito: 168,
  transito: 174,
  confirmado: 180,
  recebimento: 185,
  proxima: 191,

  /* a recorrência: cada volta é mais curta que a anterior. É o movimento,
     não o texto, que prova que isso continua sozinho. Só o PRIMEIRO ciclo
     foi comprimido (48 → 37 beats): os ciclos 2 e 3 mantêm 9 e 7 beats,
     e a curva decrescente que prova a automação continua intacta. */
  ciclo2: 194,
  ciclo3: 203,

  assenta: 210,

  /* onde o capítulo 3 termina. Mesma proteção do capítulo 2: os tweens dele
     apontam para esta constante, nunca para `end`. */
  capituloTres: 216,

  /* ---------------- capítulo 4: a atenção ----------------
     A câmera finalmente vai até o profissional. Ele cresce e continua sem
     fazer nada; o sistema segue funcionando fora do foco. A cobrança saiu
     da atenção dele — e é isso que a profundidade de campo diz. */
  atencao: 216,
  clientesVoltam: 228,
  pagos: 236,
  rotina: 242,
  assinatura: 252,

  /* ---------------- capítulo 5: a decisão ----------------
     A assinatura que já estava na cena sobe ao centro e a marca se remonta
     em volta dela. O botão que o visitante viu funcionar volta como ação. */
  marcaFinal: 261,
  cta: 268,
  silencio: 276,

  end: 286,
} as const;

/**
 * Duração de cada entrada, em beats. Não é enfeite: é o que transforma
 * "mais um card" em "mais uma interrupção". Quanto mais tarde o elemento
 * chega, mais seca é a entrada dele.
 */
export const RITMO = {
  mariana: 6,
  joao: 4.5,
  carlos: 3.5,
  mensagem: 3,
  lembrete: 2,
  planilha: 4.5,
  /* saídas */
  saidaPerto: 4,
  saidaMeio: 4,
  saidaLonge: 4,

  /* capítulo 2 */
  recuoDaFrase: 9,
  /* a convergência é curta e decidida: deriva lenta lê como "cards
     aparecendo", convergência rápida lê como "posto em ordem" */
  alinhamento: 4.5,
  marcaEntra: 5,
  /* PROTEGIDA: os oito beats de profundidade da travessia. Já foi testada
     mais curta e lia como corte, não como câmera atravessando. */
  travessia: 10,
  troca: 3.5,
  /* os painéis se cruzam sobrepostos — o palco nunca fica vazio */
  saidaEstado: 1.5,
  entradaEstado: 2,

  /* capítulo 3 — a viagem do dinheiro encurta a cada ciclo.
     Só `viagem1` foi comprimida: a ordem 6 > 4 > 2,6 preserva a prova
     visual de que cada volta custa menos que a anterior. */
  viagem1: 6,
  viagem2: 4,
  viagem3: 2.6,
  contagem: 5,

  /* capítulos 4 e 5 — tudo aqui é lento: a cena está desacelerando */
  aproximacao: 12,
  retornoCards: 7,
  foraDeFoco: 11,
  subidaMarca: 7,
  entradaCta: 6,
  apagar: 8,
} as const;

/**
 * Quantos pixels de scroll vale um beat. É esta constante — e não o
 * comprimento total — que define o ritmo: esticar a narrativa para contar um
 * capítulo novo não pode acelerar nem desacelerar o que já foi aprovado.
 */
export const PX_POR_BEAT = { desktop: 72, mobile: 52 };

/** Comprimento do trecho pinado, derivado do roteiro. */
export const SCROLL_LENGTH = {
  desktop: PX_POR_BEAT.desktop * BEAT.end,
  mobile: PX_POR_BEAT.mobile * BEAT.end,
};

/** As três cobranças que interrompem o profissional. */
export const CHARGES = [
  {
    id: "mariana",
    nome: "Mariana Souza",
    plano: "Plano mensal",
    valor: "R$ 350,00",
    periodo: "/ mês",
    status: "Vencendo hoje",
    tone: "urgent" as const,
  },
  {
    id: "joao",
    nome: "João Silva",
    plano: "Plano mensal",
    valor: "R$ 450,00",
    periodo: "/ mês",
    status: "Pendente",
    tone: "warn" as const,
  },
  {
    id: "carlos",
    nome: "Carlos Mendes",
    plano: "Plano mensal",
    valor: "R$ 600,00",
    periodo: "/ mês",
    status: "Lembrete necessário",
    tone: "warn" as const,
  },
];

/** Mensagens que o profissional teria que mandar. Fazem parte do ambiente. */
export const MESSAGES = [
  "Oi Mariana, passando para lembrar do pagamento…",
  "João, tudo bem? Sobre a mensalidade deste mês…",
  "Carlos, consegue confirmar o Pix de ontem?",
  "Bom dia! Segue a chave para o pagamento…",
];

/** Linhas da planilha improvisada. */
export const SHEET_ROWS = [
  ["Mariana Souza", "05/08", "Em aberto", "350,00"],
  ["João Silva", "05/08", "Pendente", "450,00"],
  ["Carlos Mendes", "03/08", "Cobrar", "600,00"],
  ["Ana Ribeiro", "10/08", "Pago", "280,00"],
];

/** A rolagem de datas do card da Mariana, na ordem em que o tempo passa. */
export const DATAS = [
  "05 SET",
  "Hoje",
  "05 OUT",
  "05 NOV",
  "05 DEZ",
  "05 JAN",
  "05 FEV",
];

/** A data que o comprovante mostra em cada ciclo. */
export const PAGO_EM = ["05 SET", "05 OUT", "05 NOV"];

/** O que o prestador tem recebido, acumulado, a cada ciclo. */
export const SALDO = [0, 350, 700, 1050, 1400, 1750];
