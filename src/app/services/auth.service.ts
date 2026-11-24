import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'VIEWER';
}

const TOKEN_KEY = 'piece86.jwt';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  readonly currentUser = signal<AuthUser | null>(null);
  readonly isAdmin = computed(() => this.currentUser()?.role === 'ADMIN');
  readonly isViewer = computed(() => this.currentUser()?.role === 'VIEWER');
  readonly authLoading = signal(true);
  readonly loginError = signal<string | null>(null);
  readonly loggingIn = signal(false);

  token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  async bootstrap(): Promise<void> {
    const token = this.token();
    if (!token) {
      this.authLoading.set(false);
      return;
    }
    try {
      const user = await firstValueFrom(this.http.get<AuthUser>(`${environment.apiUrl}/auth/me`));
      this.currentUser.set(user);
    } catch {
      this.clearSession();
    } finally {
      this.authLoading.set(false);
    }
  }

  async login(email: string, password: string): Promise<boolean> {
    this.loggingIn.set(true);
    this.loginError.set(null);
    try {
      const result = await firstValueFrom(
        this.http.post<{ token: string; user: AuthUser }>(`${environment.apiUrl}/auth/login`, {
          email: email.trim(),
          password,
        }),
      );
      localStorage.setItem(TOKEN_KEY, result.token);
      this.currentUser.set(result.user);
      return true;
    } catch (error) {
      if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 400)) {
        this.loginError.set('البريد أو كلمة المرور غير صحيحة');
      } else {
        this.loginError.set('تعذر الاتصال بالخادم. حاول مرة أخرى.');
      }
      return false;
    } finally {
      this.loggingIn.set(false);
    }
  }

  logout(): void {
    this.clearSession();
    this.authLoading.set(false);
  }

  private clearSession(): void {
    localStorage.removeItem(TOKEN_KEY);
    this.currentUser.set(null);
  }
}
