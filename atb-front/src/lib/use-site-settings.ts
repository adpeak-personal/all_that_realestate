'use client';

import { useQuery } from '@tanstack/react-query';

/**
 * 운영 설정을 브라우저에서 직접 확인한다.
 *
 * 서버 렌더 값만 쓰면 어드민에서 스위치를 눌러도 30초(설정 캐시) 동안 이전 화면이
 * 그대로 나온다. 서버 값은 첫 화면 깜빡임을 막는 초기값으로만 쓰고, 실제 판단은
 * 매번 새로 받은 값으로 한다(no-store).
 */
export interface SiteSettings {
  mapEnabled: boolean;
}

export function useSiteSettings(initial?: SiteSettings) {
  return useQuery({
    queryKey: ['site-settings'],
    queryFn: async (): Promise<SiteSettings> => {
      const res = await fetch('/api/settings', { cache: 'no-store' });
      if (!res.ok) throw new Error('설정을 불러오지 못했습니다');
      return (await res.json()) as SiteSettings;
    },
    initialData: initial,
    // 화면에 들어올 때마다 다시 확인한다 — 스위치를 누른 뒤 새로고침이면 곧 반영된다
    refetchOnMount: 'always',
    staleTime: 0,
    retry: 1,
  });
}
