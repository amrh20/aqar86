import { Component, computed, effect, inject, signal } from '@angular/core';
import { LifecycleFilter } from '../models/dashboard.models';
import { DashboardStore } from '../services/dashboard-store.service';
import { VaultStateService } from '../services/vault-state.service';
import { formatDate, formatMoney } from '../utils/format';
import { scheduleBadgeClass } from '../utils/schedule-labels';

@Component({
  selector: 'app-cashflow-tab',
  standalone: true,
  template: `
    <div class="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-2.5">
      <div class="inline-flex gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-white p-1">
        @for (option of filters; track option.id) {
          <button
            type="button"
            class="shrink-0 rounded-md px-3 py-1.5 text-xs transition-colors"
            [class]="filter() === option.id
              ? 'bg-slate-900 font-medium text-white'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'"
            (click)="filter.set(option.id)"
          >{{ option.label }}</button>
        }
      </div>

      <label class="inline-flex items-center gap-2">
        <span class="text-xs font-medium text-slate-600">السنة:</span>
        <select
          class="min-w-[130px] cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
          [value]="selectedYear()"
          (change)="onYearChange($event)"
        >
          <option value="all" [selected]="selectedYear() === 'all'">كل السنوات</option>
          @for (y of availableYears(); track y) {
            <option [value]="y" [selected]="selectedYear() === y">{{ y }}</option>
          }
        </select>
      </label>
    </div>

    <div class="space-y-3">
      @if (!visibleMonths().length) {
        <p class="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          لا توجد بنود في هذا التصنيف.
        </p>
      }
      @for (month of visibleMonths(); track month.key) {
        <article
          class="overflow-hidden rounded-2xl border bg-white shadow-sm"
          [class.border-rose-200]="month.tone === 'overdue'"
          [class.border-indigo-200]="month.tone === 'current'"
          [class.border-emerald-200]="month.tone === 'complete'"
          [class.border-slate-200]="month.tone === 'upcoming' || month.tone === 'unknown'"
        >
          <button type="button" class="flex w-full flex-col gap-3 px-4 py-4 text-right sm:flex-row sm:items-center sm:gap-4 sm:px-5" (click)="toggle(month.key)">
            <div class="flex min-w-0 flex-1 items-start justify-between gap-2 sm:block">
              <div>
                <div class="flex flex-wrap items-center gap-2">
                  <h3 class="text-base font-semibold text-slate-900">{{ month.label }}</h3>
                  @if (month.tone === 'overdue') {
                    <span class="rounded-full bg-rose-50 px-2 py-0.5 text-xs text-rose-700">متأخر</span>
                  }
                  @if (month.tone === 'complete') {
                    <span class="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">مكتمل</span>
                  }
                  @if (month.tone === 'current') {
                    <span class="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">الشهر الحالي</span>
                  }
                </div>
                <p class="mt-1 text-xs text-slate-500">{{ month.rows.length }} بند · متبقي {{ month.dueCount }} قسط</p>
              </div>
              <span class="shrink-0 text-lg text-slate-400 sm:hidden">{{ openKey() === month.key ? '−' : '+' }}</span>
            </div>
            <div class="grid w-full grid-cols-2 gap-3 border-t border-slate-100 pt-3 sm:flex sm:w-auto sm:gap-4 sm:border-0 sm:pt-0">
              <div>
                <p class="text-xs text-slate-400">إجمالي الأقساط المتبقية</p>
                <p class="text-sm font-medium text-slate-800">{{ money(month.dueAmount) }}</p>
              </div>
              <div>
                <p class="text-xs text-slate-400">7% المتبقي</p>
                <p class="text-sm font-semibold text-slate-900">{{ money(month.dueShare) }}</p>
              </div>
            </div>
            <span class="hidden shrink-0 text-slate-400 sm:inline">{{ openKey() === month.key ? '−' : '+' }}</span>
          </button>
          @if (openKey() === month.key) {
            <div class="border-t border-slate-100 px-3 py-3 sm:px-5">
              <div class="space-y-2 md:hidden">
                @for (row of month.rows; track row.id) {
                  <div class="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
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
                        <p class="mt-1 text-xs text-slate-500">{{ date(row.dueDate) }} · {{ money(row.amount) }}</p>
                        <p class="mt-1 text-sm font-medium text-slate-900">نسبتك: {{ money(row.partnerShare) }}</p>
                        <div class="mt-2">
                          @if (vault.lifecycle(row.id) === 'settled') {
                            <span class="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">تم الاستلام {{ date(vault.settledDate(row.id)) }}</span>
                          } @else if (vault.lifecycle(row.id) === 'vault') {
                            <span class="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800">في الخزنة</span>
                          } @else {
                            <span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">غير مسدد</span>
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                }
                <div class="mt-2 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <span class="text-xs font-medium text-slate-600">مجموع الشهر</span>
                  <div class="text-left">
                    <p class="text-sm font-semibold text-slate-900">{{ money(month.totalAmount) }}</p>
                    <p class="text-xs text-slate-500">نسبتك: {{ money(month.partnerShare) }}</p>
                  </div>
                </div>
              </div>
              <div class="hidden overflow-x-auto md:block">
                <table class="w-full min-w-[720px] text-sm">
                  <thead class="text-xs text-slate-400">
                    <tr>
                      <th class="py-2 font-medium">تم الدفع</th>
                      <th class="py-2 font-medium">البند</th>
                      <th class="py-2 font-medium">العميل</th>
                      <th class="py-2 font-medium">الشقة</th>
                      <th class="py-2 font-medium">التاريخ</th>
                      <th class="py-2 font-medium">المبلغ</th>
                      <th class="py-2 font-medium">نسبتك 7%</th>
                      <th class="py-2 font-medium">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of month.rows; track row.id) {
                      <tr class="border-t border-slate-50">
                        <td class="py-2">
                          <input
                            type="checkbox"
                            class="accent-slate-900"
                            [checked]="vault.isChecked(row.id)"
                            [disabled]="vault.lifecycle(row.id) === 'settled'"
                            (change)="vault.toggle(row.id)"
                          />
                        </td>
                        <td class="py-2">
                          <span class="rounded-full px-2 py-0.5 text-xs" [class]="badge(row.scheduleLabel)">{{ row.scheduleLabel }}</span>
                        </td>
                        <td class="py-2">{{ row.clientName }}</td>
                        <td class="py-2">{{ row.unitNumber }}</td>
                        <td class="py-2">{{ date(row.dueDate) }}</td>
                        <td class="py-2">{{ money(row.amount) }}</td>
                        <td class="py-2 font-medium">{{ money(row.partnerShare) }}</td>
                        <td class="py-2">
                          @if (vault.lifecycle(row.id) === 'settled') {
                            <span class="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">تم الاستلام {{ date(vault.settledDate(row.id)) }}</span>
                          } @else if (vault.lifecycle(row.id) === 'vault') {
                            <span class="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800">في الخزنة</span>
                          } @else {
                            <span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">غير مسدد</span>
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                  <tfoot>
                    <tr class="border-t-2 border-slate-200 bg-slate-50/80">
                      <td class="py-2.5 font-semibold text-slate-700" colspan="5">مجموع الشهر</td>
                      <td class="py-2.5 font-semibold text-slate-900">{{ money(month.totalAmount) }}</td>
                      <td class="py-2.5 font-semibold text-slate-900">{{ money(month.partnerShare) }}</td>
                      <td class="py-2.5"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          }
        </article>
      }
    </div>
  `,
})
export class CashflowTabComponent {
  readonly store = inject(DashboardStore);
  readonly vault = inject(VaultStateService);
  readonly openKey = signal<string | null>(null);
  readonly filter = signal<LifecycleFilter>('all');
  readonly selectedYear = signal<string>(String(new Date().getFullYear()));
  readonly money = formatMoney;
  readonly date = formatDate;
  readonly badge = scheduleBadgeClass;
  readonly filters: { id: LifecycleFilter; label: string }[] = [
    { id: 'all', label: 'الكل' },
    { id: 'unpaid', label: 'غير مسدد' },
    { id: 'vault', label: 'في الخزنة' },
    { id: 'settled', label: 'تم الاستلام' },
  ];

  readonly availableYears = computed(() => {
    const years = new Set<string>();
    for (const month of this.store.months()) {
      if (month.key === 'unknown') continue;
      const year = month.key.slice(0, 4);
      if (/^\d{4}$/.test(year)) years.add(year);
    }
    return [...years].sort((a, b) => a.localeCompare(b));
  });

  readonly visibleMonths = computed(() => {
    const filter = this.filter();
    const year = this.selectedYear();
    return this.store.months()
      .filter((month) => year === 'all' || month.key.startsWith(`${year}-`))
      .map((month) => {
        const rows = month.rows.filter((row) => filter === 'all' || this.vault.lifecycle(row.id) === filter);
        const totalAmount = Math.round(rows.reduce((sum, row) => sum + row.amount, 0) * 100) / 100;
        const partnerShare = Math.round(rows.reduce((sum, row) => sum + row.partnerShare, 0) * 100) / 100;
        return { ...month, rows, totalAmount, partnerShare };
      })
      .filter((month) => month.rows.length > 0);
  });

  constructor() {
    effect(() => {
      const years = this.availableYears();
      if (!years.length) return;

      const current = this.selectedYear();
      if (current === 'all' || years.includes(current)) return;

      const thisYear = String(new Date().getFullYear());
      if (years.includes(thisYear)) {
        this.selectedYear.set(thisYear);
        return;
      }

      const firstUnpaidYear = this.store.months().find((month) => month.dueCount > 0 && month.key !== 'unknown');
      if (firstUnpaidYear) {
        this.selectedYear.set(firstUnpaidYear.key.slice(0, 4));
        return;
      }

      this.selectedYear.set(years[0]);
    });
  }

  onYearChange(event: Event): void {
    this.selectedYear.set((event.target as HTMLSelectElement).value);
  }

  toggle(key: string): void {
    this.openKey.update((current) => (current === key ? null : key));
  }
}