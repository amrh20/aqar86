import { Component, computed, effect, inject, signal } from '@angular/core';
import { LifecycleFilter } from '../models/dashboard.models';
import { DashboardStore } from '../services/dashboard-store.service';
import { VaultStateService } from '../services/vault-state.service';
import { formatDate, formatMoney } from '../utils/format';

@Component({
  selector: 'app-cashflow-tab',
  standalone: true,
  template: `
    <div class="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
      <div class="pill-scroll flex gap-2 overflow-x-auto pb-0.5 sm:flex-wrap sm:overflow-visible sm:gap-2.5">
        @for (option of filters; track option.id) {
          <button
            type="button"
            class="shrink-0 snap-start rounded-full px-4 py-2.5 text-sm sm:px-3.5 sm:py-1.5 sm:text-xs"
            [class.bg-slate-900]="filter() === option.id"
            [class.text-white]="filter() === option.id"
            [class.bg-white]="filter() !== option.id"
            [class.border]="filter() !== option.id"
            [class.border-slate-200]="filter() !== option.id"
            (click)="filter.set(option.id)"
          >{{ option.label }}</button>
        }
      </div>

      <div class="pill-scroll flex items-center gap-2 overflow-x-auto pb-0.5 sm:flex-wrap sm:overflow-visible sm:gap-2.5">
        <span class="shrink-0 text-xs text-slate-500">السنة:</span>
        <button
          type="button"
          class="shrink-0 snap-start rounded-full px-4 py-2.5 text-sm sm:px-3.5 sm:py-1.5 sm:text-xs"
          [class.bg-slate-900]="yearFilter() === 'all'"
          [class.text-white]="yearFilter() === 'all'"
          [class.bg-white]="yearFilter() !== 'all'"
          [class.border]="yearFilter() !== 'all'"
          [class.border-slate-200]="yearFilter() !== 'all'"
          (click)="yearFilter.set('all')"
        >الكل</button>
        @for (year of availableYears(); track year) {
          <button
            type="button"
            class="shrink-0 snap-start rounded-full px-4 py-2.5 text-sm sm:px-3.5 sm:py-1.5 sm:text-xs"
            [class.bg-slate-900]="yearFilter() === year"
            [class.text-white]="yearFilter() === year"
            [class.bg-white]="yearFilter() !== year"
            [class.border]="yearFilter() !== year"
            [class.border-slate-200]="yearFilter() !== year"
            (click)="yearFilter.set(year)"
          >{{ year }}</button>
        }
      </div>
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
                          <span class="rounded bg-white px-1.5 py-0.5 text-xs text-slate-600">{{ row.kind === 'downPayment' ? 'مقدم' : 'قسط' }}</span>
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
                        <td class="py-2">{{ row.kind === 'downPayment' ? 'مقدم' : 'قسط' }}</td>
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
  readonly yearFilter = signal<number | 'all'>(new Date().getFullYear());
  readonly money = formatMoney;
  readonly date = formatDate;
  readonly filters: { id: LifecycleFilter; label: string }[] = [
    { id: 'all', label: 'الكل' },
    { id: 'unpaid', label: 'غير مسدد' },
    { id: 'vault', label: 'في الخزنة' },
    { id: 'settled', label: 'تم الاستلام' },
  ];

  readonly availableYears = computed(() => {
    const years = new Set<number>();
    for (const month of this.store.months()) {
      if (month.key === 'unknown') continue;
      const year = Number(month.key.slice(0, 4));
      if (Number.isFinite(year)) years.add(year);
    }
    return [...years].sort((a, b) => a - b);
  });

  readonly visibleMonths = computed(() => {
    const filter = this.filter();
    const year = this.yearFilter();
    return this.store.months()
      .filter((month) => year === 'all' || month.key.startsWith(`${year}-`))
      .map((month) => {
        const rows = month.rows.filter((row) => filter === 'all' || this.vault.lifecycle(row.id) === filter);
        return { ...month, rows };
      })
      .filter((month) => month.rows.length > 0);
  });

  constructor() {
    effect(() => {
      const years = this.availableYears();
      if (!years.length) return;

      const current = this.yearFilter();
      if (current === 'all' || years.includes(current)) return;

      const thisYear = new Date().getFullYear();
      if (years.includes(thisYear)) {
        this.yearFilter.set(thisYear);
        return;
      }

      const firstUnpaidYear = this.store.months().find((month) => month.dueCount > 0 && month.key !== 'unknown');
      if (firstUnpaidYear) {
        this.yearFilter.set(Number(firstUnpaidYear.key.slice(0, 4)));
        return;
      }

      this.yearFilter.set(years[0]);
    });
  }

  toggle(key: string): void {
    this.openKey.update((current) => (current === key ? null : key));
  }
}