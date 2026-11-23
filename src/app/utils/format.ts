const money = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatMoney(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  const formatted = money.format(Number.isFinite(n) ? n : 0);
  return `${formatted} ج.م`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function monthKey(iso: string | null): string {
  if (!iso) return 'unknown';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'unknown';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(key: string): string {
  if (key === 'unknown') return 'بدون تاريخ';
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, (m || 1) - 1, 1);
  return new Intl.DateTimeFormat('ar-EG', { month: 'long', year: 'numeric' }).format(d);
}

export function currentMonthKey(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function toDateInputValue(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function dateInputToIso(value: string): string {
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return new Date().toISOString();
  return new Date(y, m - 1, d).toISOString();
}
