import { Component, computed, inject } from '@angular/core';
import { MonthInstallmentRow } from '../models/dashboard.models';
import { DashboardStore } from '../services/dashboard-store.service';
import { VaultStateService } from '../services/vault-state.service';
import { formatDate, formatMoney } from '../utils/format';
import { scheduleBadgeClass } from '../utils/schedule-labels';

interface OverdueRow extends MonthInstallmentRow {
  monthLabel: string;
  monthKey: string;
  remainingShare: number;
}

@Component({
  selector: 'app-overdue-tab',
  standalone: true,
  template: `
    <div class="mb-5 grid gap-3 sm:grid-cols-3 mt-5">
      <div class="rounded-xl border border-rose-200 bg-rose-50/60 px-4 py-3">
        <p class="text-xs text-rose-700">عدد البنود المتأخرة</p>
        <p class="mt-1 text-xl font-semibold text-rose-950">{{ rows().length }}</p>
      </div>
      <div class="rounded-xl border border-slate-200 bg-white px-4 py-3">
        <p class="text-xs text-slate-500">إجمالي المتبقي</p>
        <p class="mt-1 text-xl font-semibold text-slate-900">{{ money(totals().amount) }}</p>
      </div>
      <div class="rounded-xl border border-slate-200 bg-white px-4 py-3">
        <p class="text-xs text-slate-500">نسبتك 7% المتبقية</p>
        <p class="mt-1 text-xl font-semibold text-slate-900">{{ money(totals().share) }}</p>
      </div>
    </div>

    @if (!rows().length) {
      <p class="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        مفيش بنود متأخرة حالياً.
      </p>
    } @else {
      <div class="overflow-hidden rounded-2xl border border-rose-200 bg-white shadow-sm">
        <div class="divide-y divide-slate-100 md:hidden">
          @for (row of rows(); track row.id) {
            <div class="p-4">
              <div class="flex items-start gap-3">
                <input
                  type="checkbox"
                  class="mt-0.5 accent-slate-900"
                  [checked]="vault.isChecked(row.id)"
                  [disabled]="vault.lifecycle(row.id) === 'settled'"
                  (change)="vault.toggle(row.id)"
                />
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="font-medium text-slate-900">{{ row.clientName }}</span>
                    <span class="text-xs text-slate-500">شقة {{ row.unitNumber }}</span>
                    <span class="rounded px-1.5 py-0.5 text-xs" [class]="badge(row.scheduleLabel)">{{ row.scheduleLabel }}</span>
                  </div>
                  <p class="mt-1 text-xs text-slate-500">{{ row.monthLabel }} · {{ date(row.dueDate) }}</p>
                  <p class="mt-1 text-sm font-medium text-slate-900">{{ money(row.remainingAmount) }}</p>
                  <p class="mt-0.5 text-xs text-slate-600">نسبتك: {{ money(row.remainingShare) }}</p>
                  <div class="mt-2">
                    @if (vault.lifecycle(row.id) === 'settled') {
                      <span class="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">تم الاستلام {{ date(vault.settledDate(row.id)) }}</span>
                    } @else if (vault.lifecycle(row.id) === 'vault') {
                      <span class="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800">في الخزنة</span>
                    } @else {
                      <span class="rounded-full bg-rose-50 px-2 py-0.5 text-xs text-rose-700">متأخر</span>
                    }
                  </div>
                </div>
              </div>
            </div>
          }
        </div>

        <div class="hidden overflow-x-auto md:block">
          <table class="w-full min-w-[780px] text-sm">
            <thead class="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th class="px-4 py-3 font-medium">تم الدفع</th>
                <th class="px-4 py-3 font-medium">الشهر</th>
                <th class="px-4 py-3 font-medium">البند</th>
                <th class="px-4 py-3 font-medium">العميل</th>
                <th class="px-4 py-3 font-medium">الشقة</th>
                <th class="px-4 py-3 font-medium">التاريخ</th>
                <th class="px-4 py-3 font-medium">المتبقي</th>
                <th class="px-4 py-3 font-medium">نسبتك 7%</th>
                <th class="px-4 py-3 font-medium">الحالة</th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.id) {
                <tr class="border-t border-slate-100">
                  <td class="px-4 py-3">
                    <input
                      type="checkbox"
                      class="accent-slate-900"
                      [checked]="vault.isChecked(row.id)"
                      [disabled]="vault.lifecycle(row.id) === 'settled'"
                      (change)="vault.toggle(row.id)"
                    />
                  </td>
                  <td class="px-4 py-3 text-slate-700">{{ row.monthLabel }}</td>
                  <td class="px-4 py-3">
                    <span class="rounded-full px-2 py-0.5 text-xs" [class]="badge(row.scheduleLabel)">{{ row.scheduleLabel }}</span>
                  </td>
                  <td class="px-4 py-3">{{ row.clientName }}</td>
                  <td class="px-4 py-3">{{ row.unitNumber }}</td>
                  <td class="px-4 py-3">{{ date(row.dueDate) }}</td>
                  <td class="px-4 py-3 font-medium text-slate-900">{{ money(row.remainingAmount) }}</td>
                  <td class="px-4 py-3 font-medium text-slate-900">{{ money(row.remainingShare) }}</td>
                  <td class="px-4 py-3">
                    @if (vault.lifecycle(row.id) === 'settled') {
                      <span class="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">تم الاستلام {{ date(vault.settledDate(row.id)) }}</span>
                    } @else if (vault.lifecycle(row.id) === 'vault') {
                      <span class="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800">في الخزنة</span>
                    } @else {
                      <span class="rounded-full bg-rose-50 px-2 py-0.5 text-xs text-rose-700">متأخر</span>
                    }
                  </td>
                </tr>
              }
            </tbody>
            <tfoot>
              <tr class="border-t-2 border-rose-200 bg-rose-50/50">
                <td class="px-4 py-3 font-semibold text-rose-900" colspan="6">المجموع</td>
                <td class="px-4 py-3 font-semibold text-rose-950">{{ money(totals().amount) }}</td>
                <td class="px-4 py-3 font-semibold text-rose-950">{{ money(totals().share) }}</td>
                <td class="px-4 py-3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    }
  `,
})
export class OverdueTabComponent {
  readonly store = inject(DashboardStore);
  readonly vault = inject(VaultStateService);
  readonly money = formatMoney;
  readonly date = formatDate;
  readonly badge = scheduleBadgeClass;

  readonly rows = computed<OverdueRow[]>(() => {
    const list: OverdueRow[] = [];
    for (const month of this.store.months()) {
      if (month.tone !== 'overdue') continue;
      for (const row of month.rows) {
        if (row.kind !== 'installment' || row.remainingAmount <= 0) continue;
        list.push({
          ...row,
          monthKey: month.key,
          monthLabel: month.label,
          remainingShare: Math.round(row.remainingAmount * 0.07 * 100) / 100,
        });
      }
    }
    return list.sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
  });

  readonly totals = computed(() => {
    const rows = this.rows();
    return {
      amount: Math.round(rows.reduce((sum, row) => sum + row.remainingAmount, 0) * 100) / 100,
      share: Math.round(rows.reduce((sum, row) => sum + row.remainingShare, 0) * 100) / 100,
    };
  });
}
