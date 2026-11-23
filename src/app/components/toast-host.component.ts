import { Component, inject } from '@angular/core';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-toast-host',
  standalone: true,
  template: `
    <div
      class="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:inset-x-auto sm:end-4 sm:items-end"
      aria-live="polite"
    >
      @for (toast of toasts.messages(); track toast.id) {
        <div
          class="pointer-events-auto flex max-w-sm items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg animate-toast-in"
          [class.border-emerald-200]="toast.kind === 'success'"
          [class.bg-emerald-50]="toast.kind === 'success'"
          [class.text-emerald-900]="toast.kind === 'success'"
          [class.border-rose-200]="toast.kind === 'error'"
          [class.bg-rose-50]="toast.kind === 'error'"
          [class.text-rose-900]="toast.kind === 'error'"
          [class.border-slate-200]="toast.kind === 'info'"
          [class.bg-white]="toast.kind === 'info'"
          [class.text-slate-800]="toast.kind === 'info'"
          role="status"
        >
          <span class="mt-0.5 shrink-0 text-base leading-none" aria-hidden="true">
            @if (toast.kind === 'success') { ✓ }
            @else if (toast.kind === 'error') { ! }
            @else { i }
          </span>
          <p class="min-w-0 flex-1 leading-6">{{ toast.text }}</p>
          <button
            type="button"
            class="shrink-0 rounded-md px-1.5 py-0.5 text-xs opacity-60 hover:opacity-100"
            (click)="toasts.dismiss(toast.id)"
            aria-label="إغلاق"
          >
            ✕
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    @keyframes toast-in {
      from {
        opacity: 0;
        transform: translateY(0.75rem);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    .animate-toast-in {
      animation: toast-in 0.22s ease-out;
    }
  `,
})
export class ToastHostComponent {
  readonly toasts = inject(ToastService);
}