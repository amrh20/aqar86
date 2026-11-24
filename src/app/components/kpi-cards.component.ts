import { Component, inject } from '@angular/core';
import { DashboardStore } from '../services/dashboard-store.service';
import { VaultStateService } from '../services/vault-state.service';
import { dateInputToIso, formatDate, formatMoney, toDateInputValue } from '../utils/format';
import { scheduleBadgeClass } from '../utils/schedule-labels';

@Component({
  selector: 'app-kpi-cards',
  standalone: true,
  template: `
    <section>
      <div class="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <article class="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-r-4 border-emerald-200/90 border-r-emerald-500 bg-gradient-to-bl from-emerald-50/90 via-white to-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md lg:col-span-7">
          <div class="flex min-w-0 items-start gap-3">
            <span class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="2" y="6" width="20" height="14" rx="2" />
                <path d="M2 10h20M12 14h.01" />
              </svg>
            </span>
            <div class="min-w-0">
              <p class="text-xs font-medium text-slate-500">رصيد الخزنة (جاهز للاستلام)</p>
              <p class="mt-1 text-2xl font-bold tabular-nums text-emerald-950 sm:text-3xl">{{ money(vault.vaultBalance()) }}</p>
              <p class="mt-2 inline-flex rounded-md bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">{{ vault.vaultCount() }} بند محدد ولم يُستلم بعد</p>
            </div>
          </div>
          @if (!vault.isReadOnly()) {
            <div class="flex flex-wrap items-center gap-2">
              <button
                type="button"
                class="h-10 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                [disabled]="vault.vaultBalance() === 0"
                (click)="vault.openPayoutModal(today())"
              >استلام وتصفير الخزنة</button>
            </div>
          }
        </article>

        <article class="flex flex-col justify-between rounded-xl border border-r-4 border-violet-200/80 border-r-violet-500 bg-gradient-to-bl from-violet-50/80 via-white to-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md lg:col-span-5">
          <div class="flex items-start gap-3">
            <span class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
                <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
              </svg>
            </span>
            <div>
              <p class="text-xs font-medium text-slate-500">خزنتي — المستلم تراكمياً</p>
              <p class="mt-1 text-2xl font-bold tabular-nums text-slate-900 sm:text-3xl">{{ money(vault.personalVaultTotal()) }}</p>
            </div>
          </div>
          <p class="mt-3 text-xs text-slate-400">
            @if (vault.personalVaultLedger().length) {
              من {{ vault.personalVaultLedger().length }} عملية استلام · التفاصيل في تبويب «خزنتي»
            } @else {
              يظهر هنا أول ما تستلم وتصفّر الخزنة
            }
          </p>
        </article>
      </div>

      <div class="mb-6 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <article class="rounded-xl border border-t-[3px] border-slate-200/80 border-t-sky-500 bg-gradient-to-b from-sky-50/50 to-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
          <div class="flex items-start justify-between gap-2">
            <p class="text-xs text-slate-500">إجمالي المستحق حتى الآن</p>
            <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-100/80 text-sky-600">
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M16 7h6v6M22 7l-8.5 8.5-5-5L2 17" />
              </svg>
            </span>
          </div>
          <p class="mt-2 text-lg font-bold text-slate-900">{{ money(store.totals().totalEarnedToDate) }}</p>
          <p class="mt-1 truncate text-[11px] text-slate-400">7% من صافي المقدمات والأقساط المسددة</p>
        </article>

        <article class="rounded-xl border border-t-[3px] border-slate-200/80 border-t-amber-500 bg-gradient-to-b from-amber-50/50 to-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
          <div class="flex items-start justify-between gap-2">
            <p class="text-xs text-slate-500">المسحوب من الخزينة</p>
            <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100/80 text-amber-600">
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M7 17L17 7M7 7h10v10" />
              </svg>
            </span>
          </div>
          <p class="mt-2 text-lg font-bold text-slate-900">{{ money(store.totals().totalWithdrawn) }}</p>
          <p class="mt-1 truncate text-[11px] text-slate-400">
            صافي الرصيد
            <span class="font-semibold" [class.text-emerald-700]="store.totals().netBalance >= 0" [class.text-rose-700]="store.totals().netBalance < 0">
              {{ money(store.totals().netBalance) }}
            </span>
          </p>
        </article>

        <article class="rounded-xl border border-t-[3px] border-slate-200/80 border-t-indigo-500 bg-gradient-to-b from-indigo-50/60 to-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
          <div class="flex items-start justify-between gap-2">
            <p class="text-xs text-slate-500">مستحقات الشهر الحالي</p>
            <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100/80 text-indigo-600">
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
            </span>
          </div>
          <p class="mt-2 text-lg font-bold text-slate-900">{{ money(store.totals().currentMonthShare) }}</p>
          <p class="mt-1 truncate text-[11px] text-slate-400">{{ store.totals().currentMonthCount }} قسط غير مسدد هذا الشهر</p>
        </article>

        <article class="rounded-xl border border-t-[3px] border-slate-200/80 border-t-teal-500 bg-gradient-to-b from-teal-50/50 to-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
          <div class="flex items-start justify-between gap-2">
            <p class="text-xs text-slate-500">7% الأقساط المستقبلية</p>
            <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-100/80 text-teal-600">
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            </span>
          </div>
          <p class="mt-2 text-lg font-bold text-slate-900">{{ money(store.totals().totalFutureShare) }}</p>
          <p class="mt-1 truncate text-[11px] text-slate-400">{{ store.totals().soldUnits }} وحدة مباعة</p>
        </article>
      </div>
    </section>

    @if (vault.modalOpen()) {
      <div class="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4">
        <div class="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-slate-200 bg-white p-4 shadow-xl sm:max-w-lg sm:rounded-2xl sm:p-6" role="dialog" aria-modal="true">
          <h3 class="text-lg font-semibold">استلام وتصفير الخزنة</h3>
          <p class="mt-2 text-sm text-slate-500">البنود المحدّدة هتتسجل كمستلمة. اللي تشيل التحديد هيفضل في الخزنة كمستحق لم يُستلم بعد.</p>
          <p class="mt-4 text-2xl font-semibold">{{ money(vault.selectedPayoutBalance()) }}</p>
          <p class="mt-1 text-xs text-slate-500">{{ vault.selectedPayoutCount() }} من {{ vault.vaultCount() }} بند محدد للاستلام</p>
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
          <div class="mt-4 flex flex-wrap items-center justify-between gap-2">
            <button type="button" class="text-sm text-slate-600 underline" (click)="vault.previewOpen.set(!vault.previewOpen())">
              {{ vault.previewOpen() ? 'إخفاء البنود' : 'عرض البنود (' + vault.vaultCount() + ')' }}
            </button>
            @if (vault.previewOpen()) {
              <div class="flex items-center gap-3 text-xs">
                <button type="button" class="text-emerald-700 underline" (click)="vault.selectAllPayoutItems()">تحديد الكل</button>
                <button type="button" class="text-slate-500 underline" (click)="vault.clearPayoutSelection()">إلغاء التحديد</button>
              </div>
            }
          </div>
          @if (vault.previewOpen()) {
            <input
              type="search"
              class="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              placeholder="بحث بالاسم أو رقم الشقة…"
              [value]="vault.payoutSearch()"
              (input)="vault.payoutSearch.set(inputValue($event))"
            />
            <ul class="mt-2 max-h-56 space-y-1 overflow-y-auto rounded-xl border border-slate-100 p-2 text-sm">
              @for (item of vault.filteredPayoutItems(); track item.id) {
                <li>
                  <label class="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      class="mt-0.5 accent-emerald-700"
                      [checked]="vault.isPayoutSelected(item.id)"
                      (change)="vault.togglePayoutSelection(item.id)"
                    />
                    <span class="min-w-0 flex-1">
                      <span class="block text-slate-800">{{ item.clientName }} · {{ item.unitNumber }}</span>
                      <span class="mt-1 flex flex-wrap items-center gap-2">
                        <span class="rounded-full px-2 py-0.5 text-xs font-medium" [class]="badge(item.label)">{{ item.label }}</span>
                        <span class="text-xs text-slate-500">استحقاق {{ date(item.dueDate) }}</span>
                      </span>
                    </span>
                    <span class="shrink-0 font-medium tabular-nums">{{ money(item.partnerShare) }}</span>
                  </label>
                </li>
              } @empty {
                <li class="px-2 py-4 text-center text-xs text-slate-500">لا توجد نتائج للبحث</li>
              }
            </ul>
            @if (vault.unselectedPayoutItems().length) {
              <div class="mt-3 rounded-xl border border-amber-200 bg-amber-50/80 p-3">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <p class="text-sm font-medium text-amber-900">
                    غير محدد — هيبقى في الخزنة ({{ vault.unselectedPayoutItems().length }})
                  </p>
                  <p class="text-sm font-semibold tabular-nums text-amber-950">{{ money(vault.unselectedPayoutBalance()) }}</p>
                </div>
                <ul class="mt-2 max-h-36 space-y-1 overflow-y-auto text-sm">
                  @for (item of vault.unselectedPayoutItems(); track item.id) {
                    <li class="flex items-start justify-between gap-3 rounded-lg px-1 py-1.5 text-amber-950/90">
                      <span class="min-w-0">
                        <span class="block">{{ item.clientName }} · {{ item.unitNumber }}</span>
                        <span class="mt-1 flex flex-wrap items-center gap-2">
                          <span class="rounded-full px-2 py-0.5 text-xs font-medium" [class]="badge(item.label)">{{ item.label }}</span>
                          <span class="text-xs text-amber-900/70">استحقاق {{ date(item.dueDate) }}</span>
                        </span>
                      </span>
                      <span class="shrink-0 font-medium tabular-nums">{{ money(item.partnerShare) }}</span>
                    </li>
                  }
                </ul>
              </div>
            }
          }
          <div class="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" class="min-h-11 rounded-xl border border-slate-200 px-4 py-3 text-sm sm:py-2" (click)="vault.modalOpen.set(false)">إلغاء</button>
            <button
              type="button"
              class="min-h-11 rounded-xl bg-emerald-700 px-4 py-3 text-sm text-white sm:py-2 disabled:cursor-not-allowed disabled:opacity-40"
              [disabled]="vault.selectedPayoutCount() === 0"
              (click)="confirm()"
            >تأكيد الاستلام</button>
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

    @if (vault.pendingToggle(); as pending) {
      <div class="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4" (click)="vault.cancelToggle()">
        <div
          class="w-full max-w-md rounded-t-2xl border border-slate-200 bg-white p-4 shadow-xl sm:rounded-2xl sm:p-6"
          role="dialog"
          aria-modal="true"
          (click)="$event.stopPropagation()"
        >
          <h3 class="text-lg font-semibold">
            {{ pending.willCheck ? 'تأكيد التسديد' : 'تأكيد إلغاء التسديد' }}
          </h3>
          <p class="mt-2 text-sm leading-6 text-slate-600">
            @if (pending.willCheck) {
              هيتضاف البند للخزنة ويُعتبر مسدد. متأكد؟
            } @else {
              هيتشال البند من الخزنة ويرجع غير مسدد. متأكد؟
            }
          </p>
          @if (pending.item; as item) {
            <div class="mt-4 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 text-sm">
              <p class="font-medium text-slate-900">{{ item.clientName }} · شقة {{ item.unitNumber }}</p>
              <p class="mt-1 flex flex-wrap items-center gap-2 text-slate-600">
                <span class="rounded-full px-2 py-0.5 text-xs font-medium" [class]="badge(item.label)">{{ item.label }}</span>
                <span>استحقاق {{ date(item.dueDate) }}</span>
                <span>· نسبتك {{ money(item.partnerShare) }}</span>
              </p>
            </div>
          }
          <div class="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" class="min-h-11 rounded-xl border border-slate-200 px-4 py-3 text-sm sm:py-2" (click)="vault.cancelToggle()">إلغاء</button>
            <button
              type="button"
              class="min-h-11 rounded-xl px-4 py-3 text-sm text-white sm:py-2"
              [class.bg-slate-900]="pending.willCheck"
              [class.bg-rose-700]="!pending.willCheck"
              (click)="vault.confirmToggle()"
            >
              {{ pending.willCheck ? 'تأكيد التسديد' : 'تأكيد الإلغاء' }}
            </button>
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
  readonly badge = scheduleBadgeClass;
  readonly today = toDateInputValue;

  inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  confirm(): void {
    const value = this.vault.payoutDate() || toDateInputValue();
    this.vault.confirmPayout(dateInputToIso(value));
  }
}
