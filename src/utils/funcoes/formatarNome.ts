export default function formatarNome(nome: string | null | undefined): string {
  if (!nome) return '';
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '';
  if (partes.length === 1) return partes[0];
  const primeiro = partes[0];
  const ultimo = partes[partes.length - 1];
  const inicial = ultimo.charAt(0).toUpperCase();
  return inicial ? `${primeiro} ${inicial}.` : primeiro;
}
