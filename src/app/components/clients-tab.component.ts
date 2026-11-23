import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Contract, LifecycleFilter } from '../models/dashboard.models';
import { DashboardStore } from '../services/dashboard-store.service';
import { VaultStateService } from '../services/vault-state.service';
import { formatDate, formatMoney } from '../utils/format';
import { downPaymentLabel, scheduleBadgeClass } from '../utils/schedule-labels';

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
        class="fixed z-50 flex max-h-[92vh] w-full flex-col overflow-hidden border-slate-200 bg-white shadow-xl inset-x-0 bottom-0 rounded-t-2xl md:inset-y-0 md:left-0 md:max-h-none md:max-w-2xl md:rounded-none md:border-r"
      >
        <div class="shrink-0 border-b border-slate-100 bg-white p-4 sm:p-6">
          <div class="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200 md:hidden"></div>
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <h3 class="text-lg font-semibold">{{ contract.clientName }}</h3>
              <p class="text-sm text-slate-500">شقة {{ contract.unitNumber }} · {{ contract.floor }} · {{ contract.area ?? '—' }} م²</p>
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
                  <input type="checkbox" class="mt-1 accent-slate-900" [checked]="vault.isChecked(contract.downPaymentId)" [disabled]="vault.lifecycle(contract.downPaymentId) === 'settled'" (change)="vault.toggle(contract.downPaymentId)" />
                  <div class="min-w-0 flex-1">
                    <div class="font-medium text-slate-900">
                      <span class="rounded-full px-2 py-0.5 text-xs" [class]="badge(downLabel)">{{ downLabel }}</span>
                      · {{ date(contract.contractDate) }}
                    </div>
                    <p class="mt-1 text-sm">7%: {{ money(contract.partnerDownPaymentShare) }}</p>
                    <p class="mt-1 text-xs text-slate-500">{{ money(contract.downPayment) }}</p>
                    <div class="mt-2">
                      @if (vault.lifecycle(contract.downPaymentId) === 'settled') {
                        <span class="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">تم الاستلام {{ date(vault.settledDate(contract.downPaymentId)) }}</span>
                      } @else if (vault.lifecycle(contract.downPaymentId) === 'vault') {
                        <span class="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800">في الخزنة</span>
                      } @else {
                        <span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">غير مسدد</span>
                      }
                    </div>
                  </div>
                </div>
              </div>
            }
            @for (item of contract.installments; track item.id) {
              @if (showInstallment(item.id)) {
                <div class="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                  <div class="flex items-start gap-3">
                    <input type="checkbox" class="mt-1 accent-slate-900" [checked]="vault.isChecked(item.id)" [disabled]="vault.lifecycle(item.id) === 'settled'" (change)="vault.toggle(item.id)" />
                    <div class="min-w-0 flex-1">
                      <div class="font-medium text-slate-900">
                        <span class="rounded-full px-2 py-0.5 text-xs" [class]="badge(item.scheduleLabel)">{{ item.scheduleLabel }}</span>
                        · {{ date(item.dueDate) }}
                      </div>
                      <div class="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                        <span>القيمة: {{ money(item.amount) }}</span>
                        <span>7%: {{ money(item.partnerPaidShare + item.partnerRemainingShare) }}</span>
                        <span>المسدد: {{ money(item.paidAmount) }}</span>
                        <span>المتبقي: {{ money(item.remainingAmount) }}</span>
                      </div>
                      <div class="mt-2">
                        @if (vault.lifecycle(item.id) === 'settled') {
                          <span class="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">تم الاستلام {{ date(vault.settledDate(item.id)) }}</span>
                        } @else if (vault.lifecycle(item.id) === 'vault') {
                          <span class="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800">في الخزنة</span>
                        } @else {
                          <span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">غير مسدد</span>
                        }
                        <span class="mr-1 text-xs text-slate-400">{{ statusLabel(item.status) }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              }
            }
          </div>
          <table class="hidden w-full text-sm md:table">
            <thead class="text-xs text-slate-400">
              <tr>
                <th class="py-2 font-medium">تم الدفع</th>
                <th class="py-2 font-medium">البند</th>
                <th class="py-2 font-medium">الاستحقاق</th>
                <th class="py-2 font-medium">القيمة</th>
                <th class="py-2 font-medium">المسدد</th>
                <th class="py-2 font-medium">المتبقي</th>
                <th class="py-2 font-medium">7%</th>
                <th class="py-2 font-medium">الحالة</th>
              </tr>
            </thead>
            <tbody>
              @if (showDownPayment(contract)) {
                <tr class="border-t border-slate-100">
                  <td class="py-2">
                    <input type="checkbox" class="accent-slate-900" [checked]="vault.isChecked(contract.downPaymentId)" [disabled]="vault.lifecycle(contract.downPaymentId) === 'settled'" (change)="vault.toggle(contract.downPaymentId)" />
                  </td>
                  <td class="py-2">
                    <span class="rounded-full px-2 py-0.5 text-xs" [class]="badge(downLabel)">{{ downLabel }}</span>
                  </td>
                  <td class="py-2">{{ date(contract.contractDate) }}</td>
                  <td class="py-2">{{ money(contract.downPayment) }}</td>
                  <td class="py-2">{{ money(contract.downPayment) }}</td>
                  <td class="py-2">—</td>
                  <td class="py-2">{{ money(contract.partnerDownPaymentShare) }}</td>
                  <td class="py-2">
                    @if (vault.lifecycle(contract.downPaymentId) === 'settled') {
                      <span class="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">تم الاستلام {{ date(vault.settledDate(contract.downPaymentId)) }}</span>
                    } @else if (vault.lifecycle(contract.downPaymentId) === 'vault') {
                      <span class="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800">في الخزنة</span>
                    } @else {
                      <span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">غير مسدد</span>
                    }
                  </td>
                </tr>
              }
              @for (item of contract.installments; track item.id) {
                @if (showInstallment(item.id)) {
                  <tr class="border-t border-slate-100">
                    <td class="py-2">
                      <input type="checkbox" class="accent-slate-900" [checked]="vault.isChecked(item.id)" [disabled]="vault.lifecycle(item.id) === 'settled'" (change)="vault.toggle(item.id)" />
                    </td>
                    <td class="py-2">
                      <span class="rounded-full px-2 py-0.5 text-xs" [class]="badge(item.scheduleLabel)">{{ item.scheduleLabel }}</span>
                    </td>
                    <td class="py-2">{{ date(item.dueDate) }}</td>
                    <td class="py-2">{{ money(item.amount) }}</td>
                    <td class="py-2">{{ money(item.paidAmount) }}</td>
                    <td class="py-2">{{ money(item.remainingAmount) }}</td>
                    <td class="py-2">{{ money(item.partnerPaidShare + item.partnerRemainingShare) }}</td>
                    <td class="py-2">
                      @if (vault.lifecycle(item.id) === 'settled') {
                        <span class="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">تم الاستلام {{ date(vault.settledDate(item.id)) }}</span>
                      } @else if (vault.lifecycle(item.id) === 'vault') {
                        <span class="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800">في الخزنة</span>
                      } @else {
                        <span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">غير مسدد</span>
                      }
                      <span class="mr-1 text-xs text-slate-400">{{ statusLabel(item.status) }}</span>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
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

  paid(contract: Contract): number {
    return contract.installments.reduce((sum, item) => sum + item.paidAmount, 0);
  }

  paidShare(contract: Contract): number {
    return contract.installments.reduce((sum, item) => sum + item.partnerPaidShare, 0);
  }

  remaining(contract: Contract): number {
    return contract.installments.reduce((sum, item) => sum + item.remainingAmount, 0);
  }

  statusLabel(status: Contract['installments'][number]['status']): string {
    if (status === 'paid') return 'مسدد';
    if (status === 'overdue') return 'متأخر';
    return 'قادم';
  }
}