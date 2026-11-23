const UPDATED_AT_STORAGE_KEY = 'piece86.state.updatedAt';
const DASHBOARD_STORAGE_KEY = 'piece86.dashboard.v1';

export function readLocalUpdatedAt(): string | null {
  const meta = localStorage.getItem(UPDATED_AT_STORAGE_KEY);
  if (meta) return meta;
  try {
    const raw = localStorage.getItem(DASHBOARD_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { uploadedAt?: string };
    return parsed.uploadedAt ?? null;
  } catch {
    return null;
  }
}

export function writeLocalUpdatedAt(iso: string): void {
  localStorage.setItem(UPDATED_AT_STORAGE_KEY, iso);
}