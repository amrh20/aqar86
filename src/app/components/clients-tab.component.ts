import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Contract, LifecycleFilter } from '../models/dashboard.models';
import { DashboardStore } from '../services/dashboard-store.service';
import { VaultStateService } from '../services/vault-state.service';
import { formatDate, formatMoney, monthKey } from '../utils/format';
import { partKindLabel } from '../utils/payment-groups';
import { downPaymentLabel, isGarageLabel, scheduleBadgeClass } from '../utils/schedule-labels';

@Component({
  selector: 'app-clients-tab',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div class="border-b border-slate-100 p-3 sm:p-4">
        <input
          class="w-full rounded-xl border border-slate-200 px-4 py-3 text-base outline-none focus:border-slate-400 sm:py-2.5 sm:text-sm"
          placeholder="بحث بالاسم أو رقم الشقة أو كود العميل"
          [ngModel]="query()"
          (ngModelChange)="query.set($event)"
        />
      </div>

      <div class="divide-y divide-slate-100 md:hidden">
        @for (contract of filtered(); track contract.unitNumber + contract.clientName) {
          <button
            type="button"
            class="flex w-full flex-col gap-2 p-4 text-right transition hover:bg-slate-50 active:bg-slate-100"
            (click)="selected.set(contract)"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <p class="font-medium text-slate-900">{{ contract.clientName }}</p>
                <p class="text-xs text-slate-400">{{ contract.clientCode }} · شقة {{ contract.unitNumber }}</p>
              </div>
              <span class="shrink-0 text-xs text-indigo-600">التفاصيل</span>
            </div>
            <div class="grid grid-cols-2 gap-2 text-xs text-slate-600">
              <div>7% المقدم: <span class="font-medium text-slate-900">{{ money(contract.partnerDownPaymentShare) }}</span></div>
              <div>المتبقي: <span class="font-medium text-slate-900">{{ money(remaining(contract)) }}</span></div>
            </div>
          </button>
        }
      </div>

      <div class="hidden overflow-x-auto md:block">
        <table class="min-w-[1100px] w-full text-sm">
          <thead class="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th class="px-3 py-3 font-medium">العميل</th>
              <th class="px-3 py-3 font-medium">الشقة</th>
              <th class="px-3 py-3 font-medium">ثمن الوحدة</th>
              <th class="px-3 py-3 font-medium">الجراج</th>
              <th class="px-3 py-3 font-medium">مقدم الحجز</th>
              <th class="px-3 py-3 font-medium">عمولة 5%</th>
              <th class="px-3 py-3 font-medium">صافي المقدم</th>
              <th class="px-3 py-3 font-medium">7% المقدم</th>
              <th class="px-3 py-3 font-medium">المسدد / 7%</th>
              <th class="px-3 py-3 font-medium">المتبقي</th>
            </tr>
          </thead>
          <tbody>
            @for (contract of filtered(); track contract.unitNumber + contract.clientName) {
              <tr class="cursor-pointer border-t border-slate-100 hover:bg-slate-50" (click)="selected.set(contract)">
                <td class="px-3 py-3">
                  <div class="font-medium text-slate-900">{{ contract.clientName }}</div>
                  <div class="text-xs text-slate-400">{{ contract.clientCode }}</div>
                </td>
                <td class="px-3 py-3">{{ contract.unitNumber }}</td>
                <td class="px-3 py-3">{{ money(contract.unitPrice) }}</td>
                <td class="px-3 py-3">
                  @if (contract.garagePrice > 0) {
                    <span class="font-medium text-violet-800">{{ money(contract.garagePrice) }}</span>
                  } @else {
                    <span class="text-slate-400">—</span>
                  }
                </td>
                <td class="px-3 py-3">{{ money(contract.downPayment) }}</td>
                <td class="px-3 py-3">{{ money(contract.commission5Pct) }}</td>
                <td class="px-3 py-3">{{ money(contract.netDownPayment) }}</td>
                <td class="px-3 py-3 font-medium">{{ money(contract.partnerDownPaymentShare) }}</td>
                <td class="px-3 py-3">
                  {{ money(paid(contract)) }}
                  <span class="block text-xs text-slate-500">{{ money(paidShare(contract)) }}</span>
                </td>
                <td class="px-3 py-3">{{ money(remaining(contract)) }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    @if (selected(); as contract) {
      <div class="fixed inset-0 z-40 bg-slate-900/30" (click)="selected.set(null)"></div>
      <aside
        class="fixed z-50 flex max-h-[92vh] w-full flex-col overflow-hidden border-slate-200 bg-white shadow-xl inset-x-0 bottom-0 rounded-t-2xl md:inset-y-0 md:left-0 md:max-h-none md:w-[min(96vw,72rem)] md:max-w-6xl md:rounded-none md:border-r"
      >
        <div class="shrink-0 border-b border-slate-100 bg-white p-4 sm:p-6">
          <div class="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200 md:hidden"></div>
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <h3 class="text-lg font-semibold">{{ contract.clientName }}</h3>
              <p class="text-sm text-slate-500">
                شقة {{ contract.unitNumber }} · {{ contract.floor }} · {{ contract.area ?? '—' }} م²
                @if (contract.garagePrice > 0) {
                  <span class="text-violet-700"> · جراج {{ money(contract.garagePrice) }}</span>
                }
              </p>
            </div>
            <button type="button" class="min-h-10 shrink-0 rounded-lg border border-slate-200 px-4 py-2 text-sm" (click)="selected.set(null)">إغلاق</button>
          </div>
          <div class="pill-scroll mt-4 flex gap-2 overflow-x-auto pb-0.5 sm:flex-wrap sm:overflow-visible">
            @for (option of filters; track option.id) {
              <button
                type="button"
                class="shrink-0 snap-start rounded-full px-4 py-2 text-xs"
                [class.bg-slate-900]="statusFilter() === option.id"
                [class.text-white]="statusFilter() === option.id"
                [class.border]="statusFilter() !== option.id"
                [class.border-slate-200]="statusFilter() !== option.id"
                (click)="statusFilter.set(option.id)"
              >{{ option.label }}</button>
            }
          </div>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto p-4 pb-8 sm:p-6">
          <div class="space-y-2 md:hidden">
            @if (showDownPayment(contract)) {
              <div class="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                <div class="flex items-start gap-3">
                  <input type="checkbox" class="mt-1 accent-slate-900" [checked]="vault.isChecked(contract.downPaymentId)" [disabled]="vault.lifecycle(contract.downPaymentId) === 'settled'" (click)="$event.preventDefault(); vault.toggle(contract.downPaymentId)" />
                  <div class="min-w-0 flex-1">
                    <div class="font-medium text-slate-900">
                      <span class="rounded-full px-2 py-0.5 text-xs" [class]="badge(downLabel)">{{ downLabel }}</span>
                      · {{ date(contract.contractDate) }}
                    </div>
                    <p class="mt-1 text-sm">7%: {{ money(contract.partnerDownPaymentShare) }}</p>
                    <p class="mt-1 text-xs text-slate-500">{{ money(contract.downPayment) }}</p>
                    <div class="mt-2">
                      <span class="rounded-full px-2 py-0.5 text-xs font-medium" [class]="lifecycleBadgeClass(contract.downPaymentId)">
                        {{ lifecycleBadgeLabel(contract.downPaymentId) }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            }
            @for (group of installmentGroups(contract); track group.key) {
              <div class="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-xs text-slate-500">{{ date(group.dueDate) }}</span>
                  @if (group.hasGarage && group.hasApartment) {
                    <span class="rounded bg-violet-50 px-1.5 py-0.5 text-xs text-violet-700">شقة + جراج</span>
                  }
                </div>
                <p class="mt-1 text-sm font-semibold text-slate-900">{{ money(group.totalAmount) }}</p>
                @if (group.items.length > 1) {
                  <div class="mt-1 space-y-0.5 text-xs text-slate-600">
                    @for (item of group.items; track item.id) {
                      <p>{{ kindLabel(item.scheduleLabel) }}: {{ money(item.amount) }}</p>
                    }
                  </div>
                }
                <div class="mt-2 space-y-2">
                  @for (item of group.items; track item.id) {
                    <div class="flex items-start gap-3 border-t border-slate-100 pt-2">
                      <input type="checkbox" class="mt-1 accent-slate-900" [checked]="vault.isChecked(item.id)" [disabled]="vault.lifecycle(item.id) === 'settled'" (click)="$event.preventDefault(); vault.toggle(item.id)" />
                      <div class="min-w-0 flex-1">
                        <span class="rounded-full px-2 py-0.5 text-xs" [class]="badge(item.scheduleLabel)">{{ item.scheduleLabel }}</span>
                        <div class="mt-1 grid grid-cols-2 gap-2 text-xs text-slate-600">
                          <span>المسدد: {{ money(item.paidAmount) }}</span>
                          <span>المتبقي: {{ money(item.remainingAmount) }}</span>
                        </div>
                        <div class="mt-2">
                          <span class="rounded-full px-2 py-0.5 text-xs font-medium" [class]="itemStatusClass(item)">
                            {{ itemStatusLabel(item) }}
                          </span>
                        </div>
                      </div>
                    </div>
                  }
                </div>
              </div>
            }
          </div>
          <table class="hidden w-full min-w-[860px] text-sm md:table">
            <thead class="text-xs text-slate-400">
              <tr>
                <th class="whitespace-nowrap py-2 font-medium">تم الدفع</th>
                <th class="whitespace-nowrap py-2 font-medium">البند</th>
                <th class="whitespace-nowrap py-2 font-medium">الاستحقاق</th>
                <th class="whitespace-nowrap py-2 font-medium">القيمة</th>
                <th class="whitespace-nowrap py-2 font-medium">المسدد</th>
                <th class="whitespace-nowrap py-2 font-medium">المتبقي</th>
                <th class="whitespace-nowrap py-2 font-medium">7%</th>
                <th class="whitespace-nowrap py-2 font-medium">الحالة</th>
              </tr>
            </thead>
            <tbody>
              @if (showDownPayment(contract)) {
                <tr class="border-t border-slate-100">
                  <td class="py-2">
                    <input type="checkbox" class="accent-slate-900" [checked]="vault.isChecked(contract.downPaymentId)" [disabled]="vault.lifecycle(contract.downPaymentId) === 'settled'" (click)="$event.preventDefault(); vault.toggle(contract.downPaymentId)" />
                  </td>
                  <td class="py-2">
                    <span class="rounded-full px-2 py-0.5 text-xs" [class]="badge(downLabel)">{{ downLabel }}</span>
                  </td>
                  <td class="whitespace-nowrap py-2">{{ date(contract.contractDate) }}</td>
                  <td class="whitespace-nowrap py-2">{{ money(contract.downPayment) }}</td>
                  <td class="whitespace-nowrap py-2">{{ money(contract.downPayment) }}</td>
                  <td class="py-2">—</td>
                  <td class="whitespace-nowrap py-2">{{ money(contract.partnerDownPaymentShare) }}</td>
                  <td class="py-2">
                    <span class="rounded-full px-2 py-0.5 text-xs font-medium" [class]="lifecycleBadgeClass(contract.downPaymentId)">
                      {{ lifecycleBadgeLabel(contract.downPaymentId) }}
                    </span>
                  </td>
                </tr>
              }
              @for (group of installmentGroups(contract); track group.key) {
                @for (item of group.items; track item.id; let idx = $index) {
                  <tr class="border-t border-slate-100" [class]="isGarageLabel(item.scheduleLabel) ? 'border-t border-slate-100 bg-violet-50' : 'border-t border-slate-100'">
                    <td class="py-2">
                      <input type="checkbox" class="accent-slate-900" [checked]="vault.isChecked(item.id)" [disabled]="vault.lifecycle(item.id) === 'settled'" (click)="$event.preventDefault(); vault.toggle(item.id)" />
                    </td>
                    <td class="py-2">
                      <span class="rounded-full px-2 py-0.5 text-xs font-medium" [class]="badge(item.scheduleLabel)">{{ item.scheduleLabel }}</span>
                      @if (group.items.length > 1 && idx === 0) {
                        <div class="mt-1 text-[11px] text-slate-400">إجمالي اليوم {{ money(group.totalAmount) }}</div>
                      }
                    </td>
                    <td class="whitespace-nowrap py-2">{{ date(item.dueDate) }}</td>
                    <td class="whitespace-nowrap py-2">
                      <div>{{ money(item.amount) }}</div>
                      @if (group.items.length > 1) {
                        <div class="text-[11px] text-slate-400">{{ kindLabel(item.scheduleLabel) }}</div>
                      }
                    </td>
                    <td class="whitespace-nowrap py-2">{{ money(item.paidAmount) }}</td>
                    <td class="whitespace-nowrap py-2">{{ money(item.remainingAmount) }}</td>
                    <td class="whitespace-nowrap py-2">{{ money(item.partnerPaidShare + item.partnerRemainingShare) }}</td>
                    <td class="py-2">
                      <span class="rounded-full px-2 py-0.5 text-xs font-medium" [class]="itemStatusClass(item)">
                        {{ itemStatusLabel(item) }}
                      </span>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>

          @if (balanceCheck(contract); as check) {
            <div
              class="mt-5 rounded-2xl border p-4 sm:p-5"
              [class]="check.ok ? 'mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5' : 'mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 sm:p-5'"
            >
              <div class="flex flex-wrap items-center justify-between gap-2">
                <h4 class="text-sm font-semibold text-slate-900">مراجعة الحساب</h4>
                <span
                  class="rounded-full px-2.5 py-1 text-xs font-medium"
                  [class]="check.ok ? 'rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800' : 'rounded-full bg-rose-100 px-2.5 py-1 text-xs font-medium text-rose-800'"
                >{{ check.ok ? 'الحسبة صح' : 'فيه مشكلة في الارقام' }}</span>
              </div>
              <div class="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div class="rounded-xl bg-white px-3 py-2.5">
                  <p class="text-[11px] text-slate-500">اجمالي الشقة</p>
                  <p class="mt-0.5 text-sm font-semibold text-slate-900">{{ money(check.unitPrice) }}</p>
                </div>
                <div class="rounded-xl bg-white px-3 py-2.5">
                  <p class="text-[11px] text-slate-500">الجراج</p>
                  <p class="mt-0.5 text-sm font-semibold text-slate-900">{{ money(check.garagePrice) }}</p>
                </div>
                <div class="rounded-xl bg-white px-3 py-2.5">
                  <p class="text-[11px] text-slate-500">اجمالي التعاقد</p>
                  <p class="mt-0.5 text-sm font-semibold text-slate-900">{{ money(check.totalContract) }}</p>
                </div>
                <div class="rounded-xl bg-white px-3 py-2.5">
                  <p class="text-[11px] text-slate-500">المقدم المدفوع</p>
                  <p class="mt-0.5 text-sm font-semibold text-slate-900">{{ money(check.downPayment) }}</p>
                </div>
                <div class="rounded-xl bg-white px-3 py-2.5">
                  <p class="text-[11px] text-slate-500">المسدد من الاقساط</p>
                  <p class="mt-0.5 text-sm font-semibold text-slate-900">{{ money(check.paidInstallments) }}</p>
                </div>
                <div class="rounded-xl bg-white px-3 py-2.5">
                  <p class="text-[11px] text-slate-500">اجمالي الاقساط المتبقية</p>
                  <p class="mt-0.5 text-sm font-semibold text-slate-900">{{ money(check.remainingInstallments) }}</p>
                </div>
                <div class="rounded-xl bg-white px-3 py-2.5 sm:col-span-2">
                  <p class="text-[11px] text-slate-500">المقدم + المسدد + المتبقي</p>
                  <p class="mt-0.5 text-sm font-semibold text-slate-900">{{ money(check.reconstructed) }}</p>
                </div>
              </div>
              <p class="mt-3 text-xs leading-5" [class]="check.ok ? 'mt-3 text-xs leading-5 text-emerald-800' : 'mt-3 text-xs leading-5 text-rose-800'">
                @if (check.ok) {
                  <span>المعادلة: اجمالي التعاقد = المقدم + المسدد من الاقساط + المتبقي ({{ money(check.totalContract) }} = {{ money(check.downPayment) }} + {{ money(check.paidInstallments) }} + {{ money(check.remainingInstallments) }})</span>
                } @else {
                  <span>الفرق {{ money(check.diff) }} — المفروض اجمالي التعاقد يساوي المقدم + المسدد + المتبقي.</span>
                  @if (check.scheduleDiff !== 0) {
                    <span> كمان مجموع قيم الاقساط يفرق عن (التعاقد - المقدم) بمقدار {{ money(check.scheduleDiff) }}.</span>
                  }
                }
              </p>

              <div class="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-3">
                <div class="flex flex-wrap items-center gap-2">
                  <p class="text-xs font-semibold text-slate-800">ملاحظة الجراج والاقساط</p>
                  <span class="rounded-full px-2 py-0.5 text-[11px] font-medium" [class]="check.garageNoteBadgeClass">{{ check.garageNoteBadge }}</span>
                </div>
                <p class="mt-2 text-xs leading-5 text-slate-700">{{ check.garageNote }}</p>
                <div class="mt-2 grid gap-2 sm:grid-cols-3">
                  <div class="rounded-lg bg-slate-50 px-2.5 py-2">
                    <p class="text-[10px] text-slate-500">مجموع اقساط/دفعات الشقة</p>
                    <p class="text-xs font-semibold text-slate-900">{{ money(check.apartmentScheduleSum) }}</p>
                  </div>
                  <div class="rounded-lg bg-slate-50 px-2.5 py-2">
                    <p class="text-[10px] text-slate-500">مجموع بنود الجراج</p>
                    <p class="text-xs font-semibold text-slate-900">{{ money(check.garageScheduleSum) }}</p>
                  </div>
                  <div class="rounded-lg bg-slate-50 px-2.5 py-2">
                    <p class="text-[10px] text-slate-500">المتبقي بعد المقدم</p>
                    <p class="text-xs font-semibold text-slate-900">{{ money(check.expectedSchedule) }}</p>
                  </div>
                </div>
              </div>
            </div>
          }
        </div>
      </aside>
    }
  `,
})
export class ClientsTabComponent {
  readonly store = inject(DashboardStore);
  readonly vault = inject(VaultStateService);
  readonly query = signal('');
  readonly selected = signal<Contract | null>(null);
  readonly statusFilter = signal<LifecycleFilter>('all');
  readonly money = formatMoney;
  readonly date = formatDate;
  readonly badge = scheduleBadgeClass;
  readonly kindLabel = partKindLabel;
  readonly isGarageLabel = isGarageLabel;
  readonly downLabel = downPaymentLabel();
  readonly filtered = computed(() => this.store.filterContracts(this.query()));
  readonly filters: { id: LifecycleFilter; label: string }[] = [
    { id: 'all', label: 'الكل' },
    { id: 'unpaid', label: 'غير مسدد' },
    { id: 'vault', label: 'في الخزنة' },
    { id: 'settled', label: 'تم الاستلام' },
  ];

  showDownPayment(contract: Contract): boolean {
    return this.statusFilter() === 'all' || this.vault.lifecycle(contract.downPaymentId) === this.statusFilter();
  }

  showInstallment(id: string): boolean {
    return this.statusFilter() === 'all' || this.vault.lifecycle(id) === this.statusFilter();
  }

  installmentGroups(contract: Contract) {
    const items = contract.installments.filter((item) => this.showInstallment(item.id));
    const map = new Map<string, typeof items>();
    for (const item of items) {
      const key = monthKey(item.dueDate) + '|' + (item.dueDate ?? 'none');
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return [...map.entries()].map(([key, groupItems]) => {
      const hasGarage = groupItems.some((item) => isGarageLabel(item.scheduleLabel));
      const hasApartment = groupItems.some((item) => !isGarageLabel(item.scheduleLabel));
      return {
        key,
        dueDate: groupItems[0]?.dueDate ?? null,
        items: groupItems,
        totalAmount: groupItems.reduce((sum, item) => sum + item.amount, 0),
        hasGarage,
        hasApartment,
      };
    });
  }

  paid(contract: Contract): number {
    return contract.installments.reduce((sum, item) => sum + item.paidAmount, 0);
  }

  paidShare(contract: Contract): number {
    return contract.installments.reduce((sum, item) => sum + item.partnerPaidShare, 0);
  }

  remaining(contract: Contract): number {
    return contract.installments.reduce((sum, item) => sum + item.remainingAmount, 0);
  }

  balanceCheck(contract: Contract) {
    const unitPrice = contract.unitPrice ?? 0;
    const garagePrice = contract.garagePrice ?? 0;
    const totalContract = contract.totalContract ?? round2(unitPrice + garagePrice);
    const downPayment = contract.downPayment ?? 0;
    const paidInstallments = round2(this.paid(contract));
    const remainingInstallments = round2(this.remaining(contract));
    const reconstructed = round2(downPayment + paidInstallments + remainingInstallments);
    const diff = round2(reconstructed - totalContract);
    const scheduleSum = round2(contract.installments.reduce((sum, item) => sum + item.amount, 0));
    const expectedSchedule = round2(totalContract - downPayment);
    const scheduleDiff = round2(scheduleSum - expectedSchedule);
    const ok = Math.abs(diff) <= 50 && Math.abs(scheduleDiff) <= 50;

    const garageLines = contract.installments.filter((item) => isGarageLabel(item.scheduleLabel));
    const apartmentLines = contract.installments.filter((item) => !isGarageLabel(item.scheduleLabel));
    const apartmentScheduleSum = round2(apartmentLines.reduce((sum, item) => sum + item.amount, 0));
    const garageScheduleSum = round2(garageLines.reduce((sum, item) => sum + item.amount, 0));
    const garageUndated = garageLines.some((item) => !item.dueDate && item.remainingAmount > 0);
    const garageNoteInfo = this.garageScheduleNote({
      garagePrice,
      garageLinesCount: garageLines.length,
      garageScheduleSum,
      apartmentScheduleSum,
      expectedSchedule,
      garageUndated,
      scheduleCoversTotal: Math.abs(scheduleDiff) <= 50,
    });

    return {
      unitPrice,
      garagePrice,
      totalContract,
      downPayment,
      paidInstallments,
      remainingInstallments,
      reconstructed,
      diff,
      scheduleDiff,
      expectedSchedule,
      apartmentScheduleSum,
      garageScheduleSum,
      ok,
      garageNote: garageNoteInfo.note,
      garageNoteBadge: garageNoteInfo.badge,
      garageNoteBadgeClass: garageNoteInfo.badgeClass,
    };
  }

  private garageScheduleNote(input: {
    garagePrice: number;
    garageLinesCount: number;
    garageScheduleSum: number;
    apartmentScheduleSum: number;
    expectedSchedule: number;
    garageUndated: boolean;
    scheduleCoversTotal: boolean;
  }): { note: string; badge: string; badgeClass: string } {
    const badgeBase = 'rounded-full px-2 py-0.5 text-[11px] font-medium ';
    if (input.garagePrice <= 0) {
      return {
        badge: 'مفيش جراج',
        badgeClass: badgeBase + 'bg-slate-100 text-slate-600',
        note: 'مفيش جراج على العقد. الاقساط والدفعات دي خاصة بالشقة فقط.',
      };
    }

    if (input.garageLinesCount === 0) {
      if (input.scheduleCoversTotal) {
        return {
          badge: 'شقة + جراج مدموجين',
          badgeClass: badgeBase + 'bg-amber-100 text-amber-900',
          note:
            'الاقساط الدورية والدفعات بتموّل الشقة والجراج مع بعض (مدموجين). مفيش سطر جراج منفصل — يعني القسط الشهري/الربع سنوي مش شقة فقط، الجراج جوه نفس السكدول.',
        };
      }
      return {
        badge: 'جراج ناقص سكدول',
        badgeClass: badgeBase + 'bg-rose-100 text-rose-800',
        note:
          'فيه ثمن جراج، لكن مفيش سطور جراج ظاهرة ومجموع الاقساط مش مغطّي المتبقي بعد المقدم بالكامل.',
      };
    }

    if (input.garageUndated) {
      return {
        badge: 'شقة فقط + جراج منفصل ناقص تواريخ',
        badgeClass: badgeBase + 'bg-rose-100 text-rose-800',
        note:
          `الاقساط الدورية للشقة فقط (مجموعها ${formatMoney(input.apartmentScheduleSum)}). الجراج له بنود منفصلة بمجموع ${formatMoney(input.garageScheduleSum)} وفيها متبقي من غير تاريخ استحقاق — مش محطوط جوه القسط الشهري.`,
      };
    }

    return {
      badge: 'شقة فقط + سطر جراج منفصل',
      badgeClass: badgeBase + 'bg-violet-100 text-violet-800',
      note:
        `الاقساط الدورية للشقة فقط (مجموعها ${formatMoney(input.apartmentScheduleSum)}). الجراج ظاهر كسطر/سطور منفصلة بمجموع ${formatMoney(input.garageScheduleSum)} وبتاريخ استحقاق — مش مدمج جوه مبلغ القسط الشهري.`,
    };
  }

  lifecycleBadgeClass(id: string): string {
    const life = this.vault.lifecycle(id);
    if (life === 'settled') return 'bg-emerald-100 text-emerald-800';
    if (life === 'vault') return 'bg-amber-100 text-amber-900';
    return 'bg-slate-100 text-slate-600';
  }

  lifecycleBadgeLabel(id: string): string {
    const life = this.vault.lifecycle(id);
    if (life === 'settled') {
      const settled = this.vault.settledDate(id);
      return settled ? `تم الاستلام ${this.date(settled)}` : 'تم الاستلام';
    }
    if (life === 'vault') return 'في الخزنة';
    return 'غير مسدد';
  }

  itemStatusClass(item: Contract['installments'][number]): string {
    const life = this.vault.lifecycle(item.id);
    if (life === 'settled') return 'bg-emerald-100 text-emerald-800';
    if (life === 'vault') return 'bg-amber-100 text-amber-900';
    if (item.status === 'overdue') return 'bg-rose-100 text-rose-800';
    if (item.status === 'paid') return 'bg-sky-100 text-sky-800';
    return 'bg-indigo-50 text-indigo-700';
  }

  itemStatusLabel(item: Contract['installments'][number]): string {
    const life = this.vault.lifecycle(item.id);
    if (life === 'settled') {
      const settled = this.vault.settledDate(item.id);
      return settled ? `تم الاستلام ${this.date(settled)}` : 'تم الاستلام';
    }
    if (life === 'vault') return 'في الخزنة';
    if (item.status === 'overdue') return 'متأخر';
    if (item.status === 'paid') return 'مسدد (عميل)';
    return 'قادم';
  }
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}