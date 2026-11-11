const soles = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });

export function formatSoles(cents: number) {
  return soles.format(cents / 100);
}

export function parseSoles(value: string): number | null {
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;

  const cents = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents : null;
}
