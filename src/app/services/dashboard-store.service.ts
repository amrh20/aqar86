import { Injectable, computed, signal } from '@angular/core';
import {
  Contract,
  DashboardTotals,
  MonthBucket,
  MonthInstallmentRow,
  ParsedWorkbook,
} from '../models/dashboard.models';
import { currentMonthKey, monthKey, monthLabel } from '../utils/format';
import { downPaymentLabel } from '../utils/schedule-labels';
import { assignStableIds } from '../utils/stable-ids';
import { writeLocalUpdatedAt } from './state-meta';

const STORAGE_KEY = 'piece86.dashboard.v1';

@Injectable({ providedIn: 'root' })
export class DashboardStore {
  readonly data = signal<ParsedWorkbook | null>(this.read());
  readonly error = signal<string | null>(null);
  readonly parsing = signal(false);

  readonly contracts = computed(() => this.data()?.contracts ?? []);
  readonly withdrawals = computed(() => this.data()?.withdrawals ?? []);

  readonly totals = computed<DashboardTotals>(() => {
    const contracts = this.contracts();
    const nowKey = currentMonthKey();
    let earnedDown = 0;
    let earnedInstallments = 0;
    let future = 0;
    let currentMonthShare = 0;
    let currentMonthCount = 0;

    for (const contract of contracts) {
      earnedDown += contract.partnerDownPaymentShare;
      for (const installment of contract.installments) {
        earnedInstallments += installment.partnerPaidShare;
        future += installment.partnerRemainingShare;
        if (installment.remainingAmount > 0 && monthKey(installment.dueDate) === nowKey) {
          currentMonthShare += installment.partnerRemainingShare;
          currentMonthCount += 1;
        }
      }
    }

    const totalEarnedToDate = round2(earnedDown + earnedInstallments);
    const totalWithdrawn = this.data()?.totalWithdrawn ?? 0;
    return {
      totalEarnedToDate,
      totalFutureShare: round2(future),
      totalWithdrawn,
      netBalance: round2(totalEarnedToDate - totalWithdrawn),
      currentMonthShare: round2(currentMonthShare),
      currentMonthCount,
      soldUnits: contracts.length,
    };
  });

  readonly months = computed<MonthBucket[]>(() => {
    const map = new Map<string, MonthInstallmentRow[]>();
    const push = (key: string, row: MonthInstallmentRow) => {
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    };

    for (const contract of this.contracts()) {
      push(monthKey(contract.contractDate), {
        id: contract.downPaymentId,
        kind: 'downPayment',
        clientName: contract.clientName,
        unitNumber: contract.unitNumber,
        dueDate: contract.contractDate,
        amount: contract.downPayment,
        remainingAmount: 0,
        partnerShare: contract.partnerDownPaymentShare,
        status: 'paid',
        scheduleLabel: downPaymentLabel(),
      });
      for (const installment of contract.installments) {
        push(monthKey(installment.dueDate), {
          id: installment.id,
          kind: 'installment',
          clientName: contract.clientName,
          unitNumber: contract.unitNumber,
          dueDate: installment.dueDate,
          amount: installment.amount,
          remainingAmount: installment.remainingAmount,
          partnerShare: round2(installment.amount * 0.07),
          status: installment.status,
          scheduleLabel: installment.scheduleLabel ?? 'قسط دوري',
        });
      }
    }

    const nowKey = currentMonthKey();
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, rows]) => {
        const due = rows.filter((row) => row.kind === 'installment' && row.remainingAmount > 0);
        const sorted = rows.sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
        const remainingCount = due.length;
        let tone: MonthBucket['tone'] = 'unknown';
        if (key !== 'unknown') {
          if (key === nowKey) tone = 'current';
          else if (key > nowKey) tone = 'upcoming';
          else if (remainingCount > 0) tone = 'overdue';
          else tone = 'complete';
        }
        return {
          key,
          label: monthLabel(key),
          tone,
          count: sorted.length,
          totalAmount: round2(sorted.reduce((sum, row) => sum + row.amount, 0)),
          partnerShare: round2(sorted.reduce((sum, row) => sum + row.partnerShare, 0)),
          dueCount: remainingCount,
          dueAmount: round2(due.reduce((sum, row) => sum + row.remainingAmount, 0)),
          dueShare: round2(due.reduce((sum, row) => sum + row.remainingAmount * 0.07, 0)),
          rows: sorted,
        };
      });
  });

  setData(data: ParsedWorkbook, updatedAt?: string): void {
    assignStableIds(data.contracts ?? []);
    this.data.set(data);
    this.error.set(null);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    writeLocalUpdatedAt(updatedAt ?? data.uploadedAt);
  }

  clear(): void {
    this.data.set(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  filterContracts(query: string): Contract[] {
    const q = query.trim();
    const all = this.contracts();
    if (!q) return all;
    return all.filter(
      (contract) => contract.clientName.includes(q) || contract.unitNumber.includes(q) || contract.clientCode.includes(q),
    );
  }

  private read(): ParsedWorkbook | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw) as ParsedWorkbook;
      assignStableIds(data.contracts ?? []);
      return data;
    } catch {
      return null;
    }
  }
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
