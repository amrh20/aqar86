import { Component, inject } from '@angular/core';
import { DashboardStore } from '../services/dashboard-store.service';
import { VaultStateService } from '../services/vault-state.service';
import { dateInputToIso, formatDate, formatMoney, toDateInputValue } from '../utils/format';

@Component({
  selector: 'app-kpi-cards',
  standalone: true,
  template: `
    <section class="space-y-4">
      <article class="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm sm:p-5">
        <div class="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div class="min-w-0">
            <p class="text-sm text-emerald-800">رصيد الخزنة (جاهز للاستلام)</p>
            <p class="mt-2 break-words text-2xl font-semibold tracking-tight text-emerald-950 sm:text-3xl">{{ money(vault.vaultBalance()) }}</p>
            <p class="mt-2 text-xs text-emerald-800/80">{{ vault.vaultCount() }} بند محدد ولم يُستلم بعد</p>
          </div>
          <div class="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
            <button
              type="button"
              class="min-h-11 w-full rounded-xl bg-emerald-700 px-4 py-3 text-sm font-medium text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto sm:py-2.5"
              [disabled]="vault.vaultBalance() === 0"
              (click)="vault.openPayoutModal(today())"
            >استلام وتصفير الخزنة</button>
            @if (vault.payoutHistory().length) {
              <button type="button" class="min-h-11 w-full rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm text-emerald-900 sm:w-auto sm:py-2.5" (click)="vault.undoOpen.set(true)">
                تراجع عن آخر استلام
              </button>
            }
          </div>
        </div>
      </article>

      <article class="rounded-2xl border border-violet-200 bg-violet-50/40 p-4 shadow-sm sm:p-5">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p class="text-sm text-violet-800">خزنتي — المستلم تراكمياً</p>
            <p class="mt-2 text-2xl font-semibold tracking-tight text-violet-950 sm:text-3xl">{{ money(vault.personalVaultTotal()) }}</p>
            <p class="mt-2 text-xs text-violet-800/80">
              @if (vault.personalVaultLedger().length) {
                من {{ vault.personalVaultLedger().length }} عملية استلام · التفاصيل في تبويب «خزنتي»
              } @else {
                يظهر هنا أول ما تستلم وتصفّر الخزنة
              }
            </p>
          </div>
        </div>
      </article>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <article class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <p class="text-sm text-slate-500">إجمالي المستحق حتى الآن</p>
          <p class="mt-3 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{{ money(store.totals().totalEarnedToDate) }}</p>
          <p class="mt-2 text-xs leading-5 text-slate-400">7% من صافي المقدمات + 7% من الأقساط المسددة</p>
        </article>

        <article class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <p class="text-sm text-slate-500">المسحوب من الخزينة</p>
          <p class="mt-3 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{{ money(store.totals().totalWithdrawn) }}</p>
          <p class="mt-2 text-sm text-slate-600">
            صافي الرصيد المتبقي لك
            <span class="font-semibold" [class.text-emerald-700]="store.totals().netBalance >= 0" [class.text-rose-700]="store.totals().netBalance < 0">
              {{ money(store.totals().netBalance) }}
            </span>
          </p>
        </article>

        <article class="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 shadow-sm sm:p-5">
          <p class="text-sm text-indigo-700">مستحقات الشهر الحالي</p>
          <p class="mt-3 text-xl font-semibold tracking-tight text-indigo-950 sm:text-2xl">{{ money(store.totals().currentMonthShare) }}</p>
          <p class="mt-2 text-xs text-indigo-700/80">7% من الأقساط غير المسددة هذا الشهر · {{ store.totals().currentMonthCount }} قسط</p>
        </article>

        <article class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <p class="text-sm text-slate-500">إجمالي الـ 7% في الأقساط المستقبلية</p>
          <p class="mt-3 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{{ money(store.totals().totalFutureShare) }}</p>
          <p class="mt-2 text-xs text-slate-400">{{ store.totals().soldUnits }} وحدة مباعة</p>
        </article>
      </div>
    </section>

    @if (vault.modalOpen()) {
      <div class="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4">
        <div class="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-slate-200 bg-white p-4 shadow-xl sm:max-w-lg sm:rounded-2xl sm:p-6" role="dialog" aria-modal="true">
          <h3 class="text-lg font-semibold">استلام وتصفير الخزنة</h3>
          <p class="mt-2 text-sm text-slate-500">سيتم تسجيل البنود المحددة كمستلمة وتصفير الرصيد.</p>
          <p class="mt-4 text-2xl font-semibold">{{ money(vault.vaultBalance()) }}</p>
          <label class="mt-4 block text-sm text-slate-600">
            تاريخ الاستلام
            <input
              type="date"
              class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-base sm:py-2 sm:text-sm"
              [value]="vault.payoutDate()"
              (input)="vault.payoutDate.set(inputValue($event))"
            />
          </label>
          <label class="mt-3 block text-sm text-slate-600">
            ملاحظة
            <input
              type="text"
              class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 text-base sm:py-2 sm:text-sm"
              placeholder="اختياري"
              [value]="vault.payoutNote()"
              (input)="vault.payoutNote.set(inputValue($event))"
            />
          </label>
          <button type="button" class="mt-4 text-sm text-slate-600 underline" (click)="vault.previewOpen.set(!vault.previewOpen())">
            {{ vault.previewOpen() ? 'إخفاء البنود' : 'عرض البنود (' + vault.vaultCount() + ')' }}
          </button>
          @if (vault.previewOpen()) {
            <ul class="mt-3 max-h-48 space-y-2 overflow-y-auto rounded-xl border border-slate-100 p-3 text-sm">
              @for (item of vault.inVaultItems(); track item.id) {
                <li class="flex items-center justify-between gap-3">
                  <span>{{ item.clientName }} · {{ item.unitNumber }} · {{ item.label }}</span>
                  <span class="shrink-0 font-medium">{{ money(item.partnerShare) }}</span>
                </li>
              }
            </ul>
          }
          <div class="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" class="min-h-11 rounded-xl border border-slate-200 px-4 py-3 text-sm sm:py-2" (click)="vault.modalOpen.set(false)">إلغاء</button>
            <button type="button" class="min-h-11 rounded-xl bg-emerald-700 px-4 py-3 text-sm text-white sm:py-2" (click)="confirm()">تأكيد الاستلام</button>
          </div>
        </div>
      </div>
    }

    @if (vault.undoOpen()) {
      <div class="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4">
        <div class="w-full max-w-md rounded-t-2xl border border-slate-200 bg-white p-4 shadow-xl sm:rounded-2xl sm:p-6" role="dialog" aria-modal="true">
          <h3 class="text-lg font-semibold">تراجع عن آخر استلام</h3>
          <p class="mt-2 text-sm leading-6 text-slate-600">ستعود بنود آخر عملية استلام إلى الخزنة، ويُعاد رصيدها إلى «جاهز للاستلام».</p>
          <div class="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" class="min-h-11 rounded-xl border border-slate-200 px-4 py-3 text-sm sm:py-2" (click)="vault.undoOpen.set(false)">إلغاء</button>
            <button type="button" class="min-h-11 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white sm:py-2" (click)="vault.undoLastPayout()">تأكيد التراجع</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class KpiCardsComponent {
  readonly store = inject(DashboardStore);
  readonly vault = inject(VaultStateService);
  readonly money = formatMoney;
  readonly date = formatDate;
  readonly today = toDateInputValue;

  inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  confirm(): void {
    const value = this.vault.payoutDate() || toDateInputValue();
    this.vault.confirmPayout(dateInputToIso(value));
  }
}
