export default function formatarData(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}
