'use client';

/**
 * 어드민 API 호출. 브라우저에서 /api/* 로 부르면 next.config 의 rewrites 가
 * 백엔드로 넘긴다. 세션은 쿠키라 credentials: 'include' 가 필요하다.
 */
export interface CollectStatus {
  deals: { total: number; lastMonth: string | null };
  apartments: { total: number; geocoded: number; kaptMatched: number };
  kapt: { total: number; sggDone: number; sggTotal: number; lastSynced: string | null };
  presale: { total: number; open: number; upcoming: number; lastSynced: string | null };
}

export interface AdminPresaleRow {
  id: number;
  houseNm: string;
  sido: string | null;
  sgg: string | null;
  houseType: string | null;
  rceptBgnde: string | null;
  isFeatured: boolean;
  sortWeight: number;
  isHidden: boolean;
}

export interface SiteSettings {
  mapEnabled: boolean;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? '요청이 실패했습니다');
  return body as T;
}

export const adminApi = {
  me: () => call<{ admin: boolean }>('/admin/me'),
  login: (password: string) =>
    call<{ ok: true }>('/admin/login', { method: 'POST', body: JSON.stringify({ password }) }),
  logout: () => call<{ ok: true }>('/admin/logout', { method: 'POST' }),
  status: () => call<CollectStatus>('/admin/status'),
  presales: (q: string) =>
    call<{ items: AdminPresaleRow[] }>(`/admin/presales?size=30${q ? `&q=${encodeURIComponent(q)}` : ''}`),
  settings: () => call<SiteSettings>('/admin/settings'),
  saveSettings: (patch: Partial<SiteSettings>) =>
    call<SiteSettings>('/admin/settings', { method: 'PUT', body: JSON.stringify(patch) }),
  presaleFlags: (
    id: number,
    patch: { isFeatured?: boolean; sortWeight?: number; isHidden?: boolean },
  ) =>
    call<{ ok: true }>(`/admin/presales/${id}/flags`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    }),
};
