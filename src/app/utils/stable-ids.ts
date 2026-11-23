import { Contract } from '../models/dashboard.models';
import { assignScheduleLabels } from './schedule-labels';

export function assignStableIds(contracts: Contract[]): void {
  const seen = new Map<string, number>();
  for (const contract of contracts) {
    contract.downPaymentId = `DP_${contract.unitNumber}`;
    for (const installment of contract.installments) {
      const due = installment.dueDate ?? 'none';
      const base = `INST_${contract.unitNumber}_${due}_${installment.amount}`;
      const index = seen.get(base) ?? 0;
      seen.set(base, index + 1);
      installment.id = index === 0 ? base : `${base}_${index}`;
    }
  }
  assignScheduleLabels(contracts);
}
