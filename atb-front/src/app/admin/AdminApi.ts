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
  seoTitle: string | null;
  seoDescription: string | null;
}

export type LandingBlock =
  | { id: string; type: 'image'; url: string; alt: string; link: string | null }
  | { id: string; type: 'text'; heading: string; body: string };

export interface AdminPresaleDetail {
  id: number;
  houseNm: string;
  sido: string | null;
  sgg: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  landing: LandingBlock[];
}

export interface AdminAptRow {
  id: number;
  aptNm: string;
  sido: string;
  sgg: string;
  umdNm: string;
  dealCount: number;
  seoTitle: string | null;
  seoDescription: string | null;
}

export interface AdminList<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

/** 목록 조회용 질의 문자열. 빈 값은 빼서 주소를 깔끔하게 둔다. */
function listQuery(p: { q?: string; sido?: string; sggCd?: string; page?: number }) {
  const qs = new URLSearchParams();
  if (p.q) qs.set('q', p.q);
  if (p.sido) qs.set('sido', p.sido);
  if (p.sggCd) qs.set('sggCd', p.sggCd);
  if (p.page && p.page > 1) qs.set('page', String(p.page));
  const s = qs.toString();
  return s ? `?${s}` : '';
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
  presales: (p: { q?: string; sido?: string; sggCd?: string; page?: number }) =>
    call<AdminList<AdminPresaleRow>>(`/admin/presales${listQuery(p)}`),
  apts: (p: { q?: string; sido?: string; sggCd?: string; page?: number }) =>
    call<AdminList<AdminAptRow>>(`/admin/apts${listQuery(p)}`),
  presale: (id: number) => call<AdminPresaleDetail>(`/admin/presales/${id}`),
  presaleLanding: (id: number, blocks: LandingBlock[]) =>
    call<{ ok: true }>(`/admin/presales/${id}/landing`, {
      method: 'PUT',
      body: JSON.stringify({ blocks }),
    }),
  presaleSeo: (id: number, patch: { seoTitle: string; seoDescription: string }) =>
    call<{ ok: true }>(`/admin/presales/${id}/seo`, { method: 'PUT', body: JSON.stringify(patch) }),
  aptSeo: (id: number, patch: { seoTitle: string; seoDescription: string }) =>
    call<{ ok: true }>(`/admin/apts/${id}/seo`, { method: 'PUT', body: JSON.stringify(patch) }),
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
