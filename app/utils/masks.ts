export function maskCPF(value: string) {
  const v = value.replace(/\D/g, '').slice(0, 11);
  return v.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

export function maskCNPJ(value: string) {
  const v = value.replace(/\D/g, '').slice(0, 14);
  return v
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

export function maskTelefone(value: string) {
  const v = value.replace(/\D/g, '').slice(0, 11);
  if (v.length <= 10) return v.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').trim();
  return v.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').trim();
}

export function maskCEP(value: string) {
  const v = value.replace(/\D/g, '').slice(0, 8);
  return v.replace(/(\d{5})(\d{0,3})/, '$1-$2').trim();
}

export function maskMoney(value: string) {
  // Remove tudo que não é dígito
  let v = value.replace(/\D/g, '');
  if (!v) return '';
  // Converte para centavos
  const cents = parseInt(v, 10);
  const formatted = (cents / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return 'R$ ' + formatted;
}

export function unmaskMoney(value: string): number {
  const v = value.replace(/[^\d,]/g, '').replace(',', '.');
  return parseFloat(v) || 0;
}
