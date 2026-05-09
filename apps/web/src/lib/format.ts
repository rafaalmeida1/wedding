export function formatBRL(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

export function formatDateTime(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d);
}
