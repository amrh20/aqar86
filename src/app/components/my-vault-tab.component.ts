import { Component, computed, inject } from '@angular/core';
import { VaultStateService } from '../services/vault-state.service';
import { formatDate, formatMoney } from '../utils/format';

@Component({
  selector: 'app-my-vault-tab',
  standalone: true,
  template: `
    <div class="space-y-4">
      <article class="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-5 shadow-sm sm:p-6">
        <p class="text-sm text-violet-800">خزنتي — إجمالي مستلم ومعاك (تراكمي)</p>
        <p class="mt-3 text-3xl font-semibold tracking-tight text-violet-950 sm:text-4xl">{{ money(vault.personalVaultTotal()) }}</p>
        <p class="mt-2 text-xs leading-5 text-violet-800/80">
          يزيد تلقائياً مع كل «استلام وتصفير الخزنة». رصيد «جاهز للاستلام» يظهر في البطاقة الخضراء فوق.
        </p>
        @if (vault.personalVaultLedger().length) {
          <p class="mt-3 text-sm text-violet-900">
            {{ vault.personalVaultLedger().length }} عملية استلام
            @if (lastPayout(); as last) {
              · آخرها {{ date(last.payout.date) }} بقيمة {{ money(last.payout.amount) }}
            }
          </p>
        }
      </article>

      <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        @if (!vault.personalVaultLedger().length) {
          <p class="p-6 text-center text-sm leading-6 text-slate-500 sm:p-8">
            لسه مفيش فلوس في خزنتك هنا. لما تضغط «استلام وتصفير الخزنة»، المبلغ يتسجل هنا بالتاريخ والتراكمي.
          </p>
        } @else {
          <div class="divide-y divide-slate-100 md:hidden">
            @for (row of newestLedger(); track row.payout.id) {
              <div class="p-4">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="font-medium text-slate-900">{{ money(row.payout.amount) }}</p>
                    <p class="mt-1 text-xs text-slate-500">{{ date(row.payout.date) }} · {{ row.payout.itemsCount }} بند</p>
                    @if (row.payout.note) {
                      <p class="mt-1 text-xs text-slate-600">{{ row.payout.note }}</p>
                    }
                  </div>
                  <div class="shrink-0 text-left">
                    <p class="text-xs text-slate-500">التراكمي</p>
                    <p class="text-sm font-semibold text-violet-900">{{ money(row.runningTotal) }}</p>
                  </div>
                </div>
              </div>
            }
          </div>
          <table class="hidden w-full text-sm md:table">
            <thead class="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th class="px-4 py-3 text-right font-medium">التاريخ</th>
                <th class="px-4 py-3 text-right font-medium">المستلم في العملية</th>
                <th class="px-4 py-3 text-right font-medium">التراكمي بعدها</th>
                <th class="px-4 py-3 text-right font-medium">البنود</th>
                <th class="px-4 py-3 text-right font-medium">ملاحظة</th>
              </tr>
            </thead>
            <tbody>
              @for (row of newestLedger(); track row.payout.id) {
                <tr class="border-t border-slate-100">
                  <td class="px-4 py-3 text-slate-700">{{ date(row.payout.date) }}</td>
                  <td class="px-4 py-3 font-medium text-slate-900">{{ money(row.payout.amount) }}</td>
                  <td class="px-4 py-3 font-semibold text-violet-900">{{ money(row.runningTotal) }}</td>
                  <td class="px-4 py-3 text-slate-600">{{ row.payout.itemsCount }}</td>
                  <td class="px-4 py-3 text-slate-600">{{ row.payout.note || '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
        }
      </div>
    </div>
  `,
})
export class MyVaultTabComponent {
  readonly vault = inject(VaultStateService);
  readonly money = formatMoney;
  readonly date = formatDate;

  readonly newestLedger = computed(() => [...this.vault.personalVaultLedger()].reverse());

  readonly lastPayout = computed(() => {
    const ledger = this.vault.personalVaultLedger();
    return ledger.length ? ledger[ledger.length - 1] : null;
  });
}