import { Component, inject, signal } from '@angular/core';
import { DashboardStore } from '../services/dashboard-store.service';
import { VaultStateService } from '../services/vault-state.service';
import { formatDate, formatMoney } from '../utils/format';

@Component({
  selector: 'app-withdrawals-tab',
  standalone: true,
  template: `
    <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h2 class="text-base font-semibold text-slate-900">سجل الاستلام</h2>
      @if (!vault.isReadOnly() && vault.payoutHistory().length) {
        <button type="button" class="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm sm:w-auto sm:py-2" (click)="vault.undoOpen.set(true)">
          تراجع عن آخر استلام
        </button>
      }
    </div>

    <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      @if (!vault.payoutHistory().length) {
        <p class="p-6 text-center text-sm text-slate-500 sm:p-8">لا توجد عمليات استلام بعد. حدّد البنود المدفوعة ثم استخدم «استلام وتصفير الخزنة».</p>
      } @else {
        <div class="divide-y divide-slate-100 md:hidden">
          @for (payout of newestFirst(); track payout.id) {
            <button type="button" class="w-full p-4 text-right" (click)="toggle(payout.id)">
              <div class="flex items-center justify-between gap-2">
                <span class="font-medium text-slate-900">{{ money(payout.amount) }}</span>
                <span class="text-xs text-slate-500">{{ date(payout.date) }}</span>
              </div>
              <p class="mt-1 text-xs text-slate-500">{{ payout.itemsCount }} بند · {{ payout.note || 'بدون ملاحظة' }}</p>
            </button>
            @if (openId() === payout.id) {
              <ul class="space-y-2 border-t border-slate-50 bg-slate-50/60 p-4 text-xs text-slate-600">
                @for (id of payout.settledItemIds; track id) {
                  <li>
                    @if (vault.itemById().get(id); as item) {
                      {{ item.clientName }} · شقة {{ item.unitNumber }} · {{ item.label }} · {{ date(item.dueDate) }} · {{ money(item.partnerShare) }}
                    } @else {
                      {{ id }}
                    }
                  </li>
                }
              </ul>
            }
          }
        </div>
        <table class="hidden w-full text-sm md:table">
          <thead class="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th class="px-4 py-3 font-medium">تاريخ الاستلام</th>
              <th class="px-4 py-3 font-medium">المبلغ</th>
              <th class="px-4 py-3 font-medium">عدد البنود</th>
              <th class="px-4 py-3 font-medium">الملاحظات</th>
            </tr>
          </thead>
          <tbody>
            @for (payout of newestFirst(); track payout.id) {
              <tr class="cursor-pointer border-t border-slate-100 hover:bg-slate-50" (click)="toggle(payout.id)">
                <td class="px-4 py-3">{{ date(payout.date) }}</td>
                <td class="px-4 py-3 font-medium">{{ money(payout.amount) }}</td>
                <td class="px-4 py-3">{{ payout.itemsCount }}</td>
                <td class="px-4 py-3 text-slate-600">{{ payout.note || '—' }}</td>
              </tr>
              @if (openId() === payout.id) {
                <tr class="border-t border-slate-50 bg-slate-50/60">
                  <td colspan="4" class="px-4 py-3">
                    <ul class="space-y-1 text-xs text-slate-600">
                      @for (id of payout.settledItemIds; track id) {
                        <li>
                          @if (vault.itemById().get(id); as item) {
                            {{ item.clientName }} · شقة {{ item.unitNumber }} · {{ item.label }} · {{ date(item.dueDate) }} · {{ money(item.partnerShare) }}
                          } @else {
                            {{ id }}
                          }
                        </li>
                      }
                    </ul>
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      }
    </div>

    <details class="mt-4 rounded-2xl border border-slate-200 bg-white shadow-sm">
      <summary class="min-h-11 cursor-pointer px-4 py-3 text-sm font-medium text-slate-700">مرجع مسحوبات الخزينة من الإكسيل</summary>
      <div class="border-t border-slate-100 p-3 sm:p-4">
        <div class="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div class="rounded-2xl border border-slate-200 bg-white p-4">
            <p class="text-xs text-slate-500">إجمالي المسحوب</p>
            <p class="mt-1 text-lg font-semibold sm:text-xl">{{ money(store.totals().totalWithdrawn) }}</p>
          </div>
          <div class="rounded-2xl border border-slate-200 bg-white p-4">
            <p class="text-xs text-slate-500">إجمالي المستحق حتى الآن</p>
            <p class="mt-1 text-lg font-semibold sm:text-xl">{{ money(store.totals().totalEarnedToDate) }}</p>
          </div>
        </div>
        @if (!store.withdrawals().length) {
          <p class="p-4 text-center text-sm text-slate-500">لا توجد مسحوبات مطابقة في شيت الخزينة.</p>
        } @else {
          <div class="divide-y divide-slate-100 md:hidden">
            @for (row of store.withdrawals(); track $index) {
              <div class="p-4">
                <div class="flex items-center justify-between gap-2">
                  <span class="font-medium">{{ money(row.amount) }}</span>
                  <span class="text-xs text-slate-500">{{ date(row.date) }}</span>
                </div>
                <p class="mt-1 text-xs leading-5 text-slate-600">{{ row.description || '—' }}</p>
              </div>
            }
          </div>
          <div class="hidden overflow-x-auto md:block">
            <table class="w-full text-sm">
              <thead class="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th class="px-4 py-3 font-medium">التاريخ</th>
                  <th class="px-4 py-3 font-medium">المبلغ</th>
                  <th class="px-4 py-3 font-medium">البيان</th>
                </tr>
              </thead>
              <tbody>
                @for (row of store.withdrawals(); track $index) {
                  <tr class="border-t border-slate-100">
                    <td class="px-4 py-3">{{ date(row.date) }}</td>
                    <td class="px-4 py-3 font-medium">{{ money(row.amount) }}</td>
                    <td class="px-4 py-3 text-slate-600">{{ row.description || '—' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </details>
  `,
})
export class WithdrawalsTabComponent {
  readonly store = inject(DashboardStore);
  readonly vault = inject(VaultStateService);
  readonly money = formatMoney;
  readonly date = formatDate;
  readonly openId = signal<string | null>(null);

  newestFirst() {
    return [...this.vault.payoutHistory()].reverse();
  }

  toggle(id: string): void {
    this.openId.update((current) => (current === id ? null : id));
  }
}