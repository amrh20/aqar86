import { Contract, GarageAccount, Installment } from '../models/dashboard.models';
import { isGarageLabel } from './schedule-labels';

export function buildGarageAccounts(contracts: Contract[]): GarageAccount[] {
  const accounts: GarageAccount[] = [];

  for (const contract of contracts) {
    const garagePrice = contract.garagePrice ?? 0;
    const garageInstallments = (contract.installments ?? []).filter((item) => isGarageLabel(item.scheduleLabel));

    if (garagePrice <= 0 && garageInstallments.length === 0) continue;

    const price = garagePrice > 0 ? garagePrice : round2(garageInstallments.reduce((sum, i) => sum + i.amount, 0));
    const paidFromLines = round2(garageInstallments.reduce((sum, i) => sum + i.paidAmount, 0));
    const remainingFromLines = round2(garageInstallments.reduce((sum, i) => sum + i.remainingAmount, 0));

    let mode: GarageAccount['mode'] = 'scheduled';
    let paidAmount = paidFromLines;
    let remainingAmount = remainingFromLines;
    let installments: Installment[] = garageInstallments;

    if (garageInstallments.length === 0 && price > 0) {
      // Garage value is financed inside apartment installments — no separate lines.
      mode = 'blended';
      paidAmount = 0;
      remainingAmount = price;
      installments = [];
    } else if (garageInstallments.length > 0 && remainingFromLines + paidFromLines + 50 < price) {
      mode = 'partial';
      remainingAmount = round2(Math.max(remainingFromLines, price - paidFromLines));
    } else if (garageInstallments.some((i) => !i.dueDate && i.remainingAmount > 0)) {
      mode = 'partial';
    }

    const open = installments.filter((i) => i.remainingAmount > 0);
    const datedOpen = open.filter((i) => !!i.dueDate);
    const nextDueDate =
      [...datedOpen].sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))[0]?.dueDate ?? null;

    accounts.push({
      id: `GARAGE_${contract.unitNumber || contract.clientCode || contract.clientName}`,
      clientName: contract.clientName,
      clientCode: contract.clientCode,
      unitNumber: contract.unitNumber,
      garageOnly: !!contract.garageOnly || contract.unitPrice <= 0,
      garagePrice: price,
      paidAmount,
      remainingAmount,
      partnerRemainingShare: round2(remainingAmount * 0.07),
      remainingMonths: open.length,
      nextDueDate,
      mode,
      installments,
    });
  }

  return accounts.sort((a, b) => a.clientName.localeCompare(b.clientName, 'ar'));
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
