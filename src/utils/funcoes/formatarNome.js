function formatarNome(nome) {
    if (!nome) return '';
    const partes = nome.trim().split(/\s+/);
    if (partes.length === 1) return partes[0]; // ex: "Ayrton"
    const primeiro = partes[0];
    const ultimo = partes[partes.length - 1];
    return `${primeiro} ${ultimo.charAt(0).toUpperCase()}.`;
}
module.exports = formatarNome;