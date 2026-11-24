import { Component, computed, inject, signal } from '@angular/core';
import { GarageAccount } from '../models/dashboard.models';
import { DashboardStore } from '../services/dashboard-store.service';
import { VaultStateService } from '../services/vault-state.service';
import { formatDate, formatMoney } from '../utils/format';
import { scheduleBadgeClass } from '../utils/schedule-labels';

@Component({
  selector: 'app-garages-tab',
  standalone: true,
  template: `
    <div class="mb-5 grid gap-3 sm:grid-cols-3 mt-5">
      <div class="rounded-xl border border-violet-200 bg-violet-50/60 px-4 py-3">
        <p class="text-xs text-violet-700">عدد الجراجات</p>
        <p class="mt-1 text-xl font-semibold text-violet-950">{{ accounts().length }}</p>
      </div>
      <div class="rounded-xl border border-slate-200 bg-white px-4 py-3">
        <p class="text-xs text-slate-500">إجمالي المتبقي</p>
        <p class="mt-1 text-xl font-semibold text-slate-900">{{ money(totals().remaining) }}</p>
      </div>
      <div class="rounded-xl border border-slate-200 bg-white px-4 py-3">
        <p class="text-xs text-slate-500">نسبتك 7% المتبقية</p>
        <p class="mt-1 text-xl font-semibold text-slate-900">{{ money(totals().share) }}</p>
      </div>
    </div>

    @if (!accounts().length) {
      <p class="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        مفيش جراجات مسجّلة حالياً.
      </p>
    } @else {
      <div class="space-y-3">
        @for (account of accounts(); track account.id) {
          <article class="overflow-hidden rounded-2xl border border-violet-200/80 bg-white shadow-sm">
            <button
              type="button"
              class="flex w-full flex-col gap-3 px-4 py-4 text-right sm:flex-row sm:items-center sm:gap-4 sm:px-5"
              (click)="toggle(account.id)"
            >
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <h3 class="text-base font-semibold text-slate-900">{{ account.clientName }}</h3>
                  @if (account.garageOnly) {
                    <span class="rounded-full bg-violet-50 px-2 py-0.5 text-xs text-violet-700">جراج فقط</span>
                  } @else {
                    <span class="text-xs text-slate-500">شقة {{ account.unitNumber }}</span>
                  }
                  <span class="rounded-full px-2 py-0.5 text-xs" [class]="modeClass(account)">{{ modeLabel(account) }}</span>
                </div>
                <p class="mt-1 text-xs text-slate-500">
                  ثمن الجراج {{ money(account.garagePrice) }}
                  · متبقي {{ account.remainingMonths }} بند
                  @if (account.nextDueDate) {
                    · أقرب استحقاق {{ date(account.nextDueDate) }}
                  }
                </p>
              </div>
              <div class="grid w-full grid-cols-2 gap-3 border-t border-slate-100 pt-3 sm:flex sm:w-auto sm:gap-4 sm:border-0 sm:pt-0">
                <div>
                  <p class="text-xs text-slate-400">المتبقي</p>
                  <p class="text-sm font-medium text-slate-800">{{ money(account.remainingAmount) }}</p>
                </div>
                <div>
                  <p class="text-xs text-slate-400">7% المتبقي</p>
                  <p class="text-sm font-semibold text-slate-900">{{ money(account.partnerRemainingShare) }}</p>
                </div>
              </div>
              <span class="hidden shrink-0 text-slate-400 sm:inline">{{ openId() === account.id ? '−' : '+' }}</span>
            </button>

            @if (openId() === account.id) {
              <div class="border-t border-slate-100 px-3 py-3 sm:px-5">
                <div class="mb-3 grid grid-cols-2 gap-2 text-xs text-slate-600 sm:grid-cols-4">
                  <div class="rounded-lg bg-slate-50 px-3 py-2">المدفوع: <span class="font-medium text-slate-900">{{ money(account.paidAmount) }}</span></div>
                  <div class="rounded-lg bg-slate-50 px-3 py-2">المتبقي: <span class="font-medium text-slate-900">{{ money(account.remainingAmount) }}</span></div>
                  <div class="rounded-lg bg-slate-50 px-3 py-2">بنود متبقية: <span class="font-medium text-slate-900">{{ account.remainingMonths }}</span></div>
                  <div class="rounded-lg bg-slate-50 px-3 py-2">الوحدة: <span class="font-medium text-slate-900">{{ account.garageOnly ? 'جراج منفصل' : account.unitNumber }}</span></div>
                </div>

                @if (account.mode === 'blended') {
                  <p class="rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-900">
                    قيمة الجراج مدمجة داخل أقساط الشقة — مفيش سطور جراج منفصلة في الإكسل.
                  </p>
                } @else if (!account.installments.length) {
                  <p class="text-sm text-slate-500">لا توجد أقساط جراج مسجّلة.</p>
                } @else {
                  <div class="space-y-2 md:hidden">
                    @for (item of account.installments; track item.id) {
                      <div class="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                        <div class="flex items-start gap-3">
                          <input
                            type="checkbox"
                            class="mt-0.5 accent-slate-900"
                            [checked]="vault.isChecked(item.id)"
                            [disabled]="vault.isReadOnly() || vault.lifecycle(item.id) === 'settled' || item.remainingAmount <= 0" [class.cursor-not-allowed]="vault.isReadOnly()" [class.opacity-75]="vault.isReadOnly()"
                            (click)="$event.preventDefault(); vault.toggle(item.id)"
                          />
                          <div class="min-w-0 flex-1">
                            <div class="flex flex-wrap items-center gap-2">
                              <span class="rounded px-1.5 py-0.5 text-xs" [class]="badge(item.scheduleLabel)">{{ item.scheduleLabel ?? 'جراج' }}</span>
                              <span class="text-xs text-slate-500">{{ item.dueDate ? date(item.dueDate) : 'بدون تاريخ استحقاق' }}</span>
                            </div>
                            <p class="mt-1 text-sm font-medium text-slate-900">{{ money(item.amount) }}</p>
                            <p class="text-xs text-slate-600">متبقي {{ money(item.remainingAmount) }} · 7% {{ money(item.partnerRemainingShare) }}</p>
                          </div>
                        </div>
                      </div>
                    }
                  </div>

                  <div class="hidden overflow-x-auto md:block">
                    <table class="w-full min-w-[640px] text-sm">
                      <thead class="text-xs text-slate-400">
                        <tr>
                          <th class="py-2 font-medium">تم الدفع</th>
                          <th class="py-2 font-medium">البند</th>
                          <th class="py-2 font-medium">الاستحقاق</th>
                          <th class="py-2 font-medium">القيمة</th>
                          <th class="py-2 font-medium">المسدد</th>
                          <th class="py-2 font-medium">المتبقي</th>
                          <th class="py-2 font-medium">7%</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (item of account.installments; track item.id) {
                          <tr class="border-t border-slate-50">
                            <td class="py-2">
                              <input
                                type="checkbox"
                                class="accent-slate-900"
                                [checked]="vault.isChecked(item.id)"
                                [disabled]="vault.isReadOnly() || vault.lifecycle(item.id) === 'settled' || item.remainingAmount <= 0" [class.cursor-not-allowed]="vault.isReadOnly()" [class.opacity-75]="vault.isReadOnly()"
                                (click)="$event.preventDefault(); vault.toggle(item.id)"
                              />
                            </td>
                            <td class="py-2">
                              <span class="rounded-full px-2 py-0.5 text-xs" [class]="badge(item.scheduleLabel)">{{ item.scheduleLabel ?? 'جراج' }}</span>
                            </td>
                            <td class="py-2">{{ item.dueDate ? date(item.dueDate) : 'بدون تاريخ' }}</td>
                            <td class="py-2">{{ money(item.amount) }}</td>
                            <td class="py-2">{{ money(item.paidAmount) }}</td>
                            <td class="py-2 font-medium">{{ money(item.remainingAmount) }}</td>
                            <td class="py-2">{{ money(item.partnerRemainingShare) }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                }
              </div>
            }
          </article>
        }
      </div>
    }
  `,
})
export class GaragesTabComponent {
  readonly store = inject(DashboardStore);
  readonly vault = inject(VaultStateService);
  readonly openId = signal<string | null>(null);
  readonly money = formatMoney;
  readonly date = formatDate;
  readonly badge = scheduleBadgeClass;

  readonly accounts = computed(() => this.store.garageAccounts());

  readonly totals = computed(() => {
    const list = this.accounts();
    return {
      remaining: Math.round(list.reduce((sum, a) => sum + a.remainingAmount, 0) * 100) / 100,
      share: Math.round(list.reduce((sum, a) => sum + a.partnerRemainingShare, 0) * 100) / 100,
    };
  });

  toggle(id: string): void {
    this.openId.update((current) => (current === id ? null : id));
  }

  modeLabel(account: GarageAccount): string {
    if (account.mode === 'blended') return 'مدمج مع الشقة';
    if (account.mode === 'partial') return 'سداد جزئي / ناقص سكدول';
    return 'سكدول جراج';
  }

  modeClass(account: GarageAccount): string {
    if (account.mode === 'blended') return 'bg-amber-50 text-amber-800';
    if (account.mode === 'partial') return 'bg-rose-50 text-rose-700';
    return 'bg-violet-50 text-violet-700';
  }
}
