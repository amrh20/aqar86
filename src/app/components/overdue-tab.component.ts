import { Component, computed, inject } from '@angular/core';
import { MonthInstallmentRow } from '../models/dashboard.models';
import { DashboardStore } from '../services/dashboard-store.service';
import { VaultStateService } from '../services/vault-state.service';
import { formatDate, formatMoney } from '../utils/format';
import { groupPaymentRows, partKindLabel, PaymentGroup } from '../utils/payment-groups';
import { scheduleBadgeClass } from '../utils/schedule-labels';

interface OverdueRow extends MonthInstallmentRow {
  monthLabel: string;
  monthKey: string;
  remainingShare: number;
}

interface OverdueGroup extends PaymentGroup {
  monthLabel: string;
  monthKey: string;
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

    @if (!groups().length) {
      <p class="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        مفيش بنود متأخرة حالياً.
      </p>
    } @else {
      <div class="overflow-hidden rounded-2xl border border-rose-200 bg-white shadow-sm">
        <div class="divide-y divide-slate-100 md:hidden">
          @for (group of groups(); track group.key) {
            <div class="p-4">
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-medium text-slate-900">{{ group.clientName }}</span>
                <span class="text-xs text-slate-500">شقة {{ group.unitNumber }}</span>
                @if (group.hasGarage && group.hasApartment) {
                  <span class="rounded bg-violet-50 px-1.5 py-0.5 text-xs text-violet-700">شقة + جراج</span>
                }
              </div>
              <p class="mt-1 text-xs text-slate-500">{{ group.monthLabel }} · {{ date(group.dueDate) }}</p>
              <p class="mt-1 text-sm font-semibold text-slate-900">{{ money(group.totalRemaining) }}</p>
              @if (group.parts.length > 1) {
                <div class="mt-1 space-y-0.5 text-xs text-slate-600">
                  @for (part of group.parts; track part.id) {
                    <p>{{ kindLabel(part.scheduleLabel) }}: {{ money(part.remainingAmount) }}</p>
                  }
                </div>
              }
              <p class="mt-0.5 text-xs text-slate-600">نسبتك: {{ money(group.totalPartnerShare) }}</p>
              <div class="mt-2 space-y-2">
                @for (part of group.parts; track part.id) {
                  <div class="flex items-center gap-2">
                    <input
                      type="checkbox"
                      class="accent-slate-900"
                      [checked]="vault.isChecked(part.id)"
                      [disabled]="vault.lifecycle(part.id) === 'settled'"
                      (click)="$event.preventDefault(); vault.toggle(part.id)"
                    />
                    <span class="text-xs text-slate-600">{{ kindLabel(part.scheduleLabel) }}</span>
                    <span class="rounded-full bg-rose-50 px-2 py-0.5 text-xs text-rose-700">متأخر</span>
                  </div>
                }
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
              @for (group of groups(); track group.key) {
                <tr class="border-t border-slate-100 align-top">
                  <td class="px-4 py-3">
                    <div class="flex flex-col gap-2">
                      @for (part of group.parts; track part.id) {
                        <input
                          type="checkbox"
                          class="accent-slate-900"
                          [checked]="vault.isChecked(part.id)"
                          [disabled]="vault.lifecycle(part.id) === 'settled'"
                          (click)="$event.preventDefault(); vault.toggle(part.id)"
                        />
                      }
                    </div>
                  </td>
                  <td class="px-4 py-3 text-slate-700">{{ group.monthLabel }}</td>
                  <td class="px-4 py-3">
                    @if (group.parts.length === 1) {
                      <span class="rounded-full px-2 py-0.5 text-xs" [class]="badge(group.parts[0].scheduleLabel)">{{ group.parts[0].scheduleLabel }}</span>
                    } @else {
                      <div class="space-y-1">
                        <span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">إجمالي مستحق</span>
                        @for (part of group.parts; track part.id) {
                          <div class="text-xs text-slate-500">{{ kindLabel(part.scheduleLabel) }}</div>
                        }
                      </div>
                    }
                  </td>
                  <td class="px-4 py-3">{{ group.clientName }}</td>
                  <td class="px-4 py-3">{{ group.unitNumber }}</td>
                  <td class="px-4 py-3">{{ date(group.dueDate) }}</td>
                  <td class="px-4 py-3 font-medium text-slate-900">
                    <div>{{ money(group.totalRemaining) }}</div>
                    @if (group.parts.length > 1) {
                      <div class="mt-1 space-y-0.5 text-xs font-normal text-slate-500">
                        @for (part of group.parts; track part.id) {
                          <div>{{ kindLabel(part.scheduleLabel) }}: {{ money(part.remainingAmount) }}</div>
                        }
                      </div>
                    }
                  </td>
                  <td class="px-4 py-3 font-medium text-slate-900">{{ money(group.totalPartnerShare) }}</td>
                  <td class="px-4 py-3">
                    <span class="rounded-full bg-rose-50 px-2 py-0.5 text-xs text-rose-700">متأخر</span>
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
  readonly kindLabel = partKindLabel;

  readonly rows = computed<OverdueRow[]>(() => {
    const list: OverdueRow[] = [];
    for (const month of this.store.months()) {
      if (month.tone !== 'overdue') continue;
      for (const row of month.rows) {
        if (row.kind !== 'installment' || row.remainingAmount <= 0) continue;
        if (this.vault.lifecycle(row.id) !== 'unpaid') continue;
        list.push({
          ...row,
          monthKey: month.key,
          monthLabel: month.label,
          remainingShare: Math.round(row.remainingAmount * 0.07 * 100) / 100,
          partnerShare: Math.round(row.remainingAmount * 0.07 * 100) / 100,
        });
      }
    }
    return list.sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
  });

  readonly groups = computed<OverdueGroup[]>(() => {
    const byMonth = new Map<string, { label: string; rows: OverdueRow[] }>();
    for (const row of this.rows()) {
      const bucket = byMonth.get(row.monthKey) ?? { label: row.monthLabel, rows: [] };
      bucket.rows.push(row);
      byMonth.set(row.monthKey, bucket);
    }
    const result: OverdueGroup[] = [];
    for (const [monthKey, bucket] of byMonth) {
      for (const group of groupPaymentRows(bucket.rows)) {
        result.push({
          ...group,
          monthKey,
          monthLabel: bucket.label,
          totalPartnerShare: Math.round(group.totalRemaining * 0.07 * 100) / 100,
          parts: group.parts.map((part) => ({
            ...part,
            partnerShare: Math.round(part.remainingAmount * 0.07 * 100) / 100,
          })),
        });
      }
    }
    return result.sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
  });

  readonly totals = computed(() => {
    const rows = this.rows();
    return {
      amount: Math.round(rows.reduce((sum, row) => sum + row.remainingAmount, 0) * 100) / 100,
      share: Math.round(rows.reduce((sum, row) => sum + row.remainingShare, 0) * 100) / 100,
    };
  });
}
