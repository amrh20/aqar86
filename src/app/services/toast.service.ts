import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: number;
  kind: ToastKind;
  text: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private seq = 0;
  private timers = new Map<number, ReturnType<typeof setTimeout>>();

  readonly messages = signal<ToastMessage[]>([]);

  success(text: string, durationMs = 2800): void {
    this.push('success', text, durationMs);
  }

  error(text: string, durationMs = 3500): void {
    this.push('error', text, durationMs);
  }

  dismiss(id: number): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    this.messages.update((list) => list.filter((m) => m.id !== id));
  }

  private push(kind: ToastKind, text: string, durationMs: number): void {
    const id = ++this.seq;
    this.messages.update((list) => [...list, { id, kind, text }]);
    const timer = setTimeout(() => this.dismiss(id), durationMs);
    this.timers.set(id, timer);
  }
}
