import { Contract, Installment } from '../models/dashboard.models';

export type ScheduleLabel =
  | 'مقدم'
  | 'قسط دوري'
  | 'دفعة'
  | 'دفعة 5%'
  | 'دفعة 10%'
  | 'جراج'
  | 'قسط أخير';

const DOWN_PAYMENT_LABEL: ScheduleLabel = 'مقدم';

export function downPaymentLabel(): ScheduleLabel {
  return DOWN_PAYMENT_LABEL;
}

export function assignScheduleLabels(contracts: Contract[]): void {
  for (const contract of contracts) {
    for (const installment of contract.installments ?? []) {
      // Preserve explicit garage lines created during Excel enrichment.
      if (installment.scheduleLabel === 'جراج') continue;
      installment.scheduleLabel = classifyInstallment(contract, installment);
    }
  }
}

export function scheduleBadgeClass(label: string | null | undefined): string {
  switch (label) {
    case 'مقدم':
      return 'bg-slate-100 text-slate-700';
    case 'قسط دوري':
      return 'bg-indigo-50 text-indigo-700';
    case 'دفعة 5%':
    case 'دفعة 10%':
    case 'دفعة':
      return 'bg-amber-50 text-amber-800';
    case 'جراج':
      return 'bg-violet-100 text-violet-800';
    case 'قسط أخير':
      return 'bg-sky-50 text-sky-800';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

export function isGarageLabel(label: string | null | undefined): boolean {
  return label === 'جراج';
}

export function isApartmentScheduleLabel(label: string | null | undefined): boolean {
  return !isGarageLabel(label) && label !== 'مقدم';
}

function classifyInstallment(contract: Contract, installment: Installment): ScheduleLabel {
  const amounts = (contract.installments ?? []).map((item) => item.amount);
  if (!amounts.length) return 'قسط دوري';

  const freq = new Map<number, number>();
  for (const amount of amounts) {
    const key = roundedAmount(amount);
    freq.set(key, (freq.get(key) ?? 0) + 1);
  }

  const minRepeats = Math.max(2, Math.ceil(amounts.length * 0.15));
  const repeats = freq.get(roundedAmount(installment.amount)) ?? 1;
  const lastDue = lastDueDate(contract.installments);
  const price = contract.unitPrice;
  const garage = contract.garagePrice ?? 0;

  if (contract.garageOnly) return 'جراج';

  if (near(installment.amount, price * 0.05)) return 'دفعة 5%';
  if (near(installment.amount, price * 0.1)) return 'دفعة 10%';

  // Only the first installment that matches garage price is tagged جراج
  // (later same amounts are usually annual extras, not extra garages).
  if (garage > 0 && near(installment.amount, garage)) {
    const firstGarage = (contract.installments ?? []).find((item) => near(item.amount, garage));
    if (firstGarage && firstGarage === installment) return 'جراج';
  }

  if (repeats >= minRepeats) return 'قسط دوري';
  if (installment.dueDate && installment.dueDate === lastDue && repeats === 1) return 'قسط أخير';
  return 'دفعة';
}

function lastDueDate(installments: Installment[]): string | null {
  const dates = installments.map((item) => item.dueDate).filter((value): value is string => !!value);
  if (!dates.length) return null;
  return [...dates].sort((a, b) => a.localeCompare(b)).at(-1) ?? null;
}

function near(amount: number, target: number): boolean {
  if (!Number.isFinite(amount) || !Number.isFinite(target) || target === 0) return false;
  return Math.abs(amount - target) <= Math.max(50, Math.abs(target) * 0.005);
}

function roundedAmount(amount: number): number {
  return Math.round(amount * 100) / 100;
}
