const quotes = [
  "Comece o dia com foco: uma venda de cada vez.",
  "Disciplina é a ponte entre metas e conquistas.",
  "Cada não te aproxima do próximo sim.",
  "Grandes resultados nascem de pequenos hábitos diários.",
  "Persistência transforma esforço em recompensa.",
  "Quem faz acontece, todo dia.",
  "Sua próxima venda está a uma ligação de distância.",
  "Metas se cumprem por quem não desiste no meio do caminho.",
  "Consistência vale mais que intensidade.",
  "Vá além do combinado. É lá que mora o bônus.",
  "Trabalhe hoje pela vitória de amanhã.",
  "Não conte os dias, faça os dias contarem.",
  "Excelência é hábito, não sorte.",
  "Confiança se constrói com prática, não com desejo.",
  "Comprometimento é o preço da meta batida.",
];

export function quoteOfTheDay(date = new Date()): string {
  const day = Math.floor(date.getTime() / 86_400_000);
  return quotes[day % quotes.length]!;
}