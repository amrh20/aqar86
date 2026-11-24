import { MonthInstallmentRow } from '../models/dashboard.models';
import { monthKey } from './format';
import { isGarageLabel } from './schedule-labels';

export interface PaymentPart {
  id: string;
  scheduleLabel: string;
  amount: number;
  remainingAmount: number;
  partnerShare: number;
  kind: MonthInstallmentRow['kind'];
  status: MonthInstallmentRow['status'];
  dueDate: string | null;
}

export interface PaymentGroup {
  key: string;
  clientName: string;
  unitNumber: string;
  dueDate: string | null;
  totalAmount: number;
  totalRemaining: number;
  totalPartnerShare: number;
  hasGarage: boolean;
  hasApartment: boolean;
  parts: PaymentPart[];
}

/** Group same client + unit rows that fall in the same calendar month. */
export function groupPaymentRows(rows: MonthInstallmentRow[]): PaymentGroup[] {
  const map = new Map<string, MonthInstallmentRow[]>();
  for (const row of rows) {
    const key = `${row.clientName}||${row.unitNumber}||${monthKey(row.dueDate)}`;
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }

  return [...map.entries()].map(([key, items]) => {
    const sorted = [...items].sort((a, b) => {
      const garageDiff = Number(isGarageLabel(b.scheduleLabel)) - Number(isGarageLabel(a.scheduleLabel));
      if (garageDiff !== 0) return garageDiff;
      return (a.dueDate ?? '').localeCompare(b.dueDate ?? '');
    });
    const parts: PaymentPart[] = sorted.map((row) => ({
      id: row.id,
      scheduleLabel: row.scheduleLabel,
      amount: row.amount,
      remainingAmount: row.remainingAmount,
      partnerShare: row.partnerShare,
      kind: row.kind,
      status: row.status,
      dueDate: row.dueDate,
    }));
    const hasGarage = parts.some((part) => isGarageLabel(part.scheduleLabel));
    const hasApartment = parts.some((part) => !isGarageLabel(part.scheduleLabel));
    return {
      key,
      clientName: sorted[0].clientName,
      unitNumber: sorted[0].unitNumber,
      dueDate: sorted.map((row) => row.dueDate).filter(Boolean).sort()[0] ?? null,
      totalAmount: round2(parts.reduce((sum, part) => sum + part.amount, 0)),
      totalRemaining: round2(parts.reduce((sum, part) => sum + part.remainingAmount, 0)),
      totalPartnerShare: round2(parts.reduce((sum, part) => sum + part.partnerShare, 0)),
      hasGarage,
      hasApartment,
      parts,
    };
  });
}

export function partKindLabel(label: string | null | undefined): string {
  if (isGarageLabel(label)) return 'جراج';
  if (label === 'مقدم') return 'مقدم';
  return 'شقة';
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
