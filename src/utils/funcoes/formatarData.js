function formatarData(date) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}
module.exports = formatarData;