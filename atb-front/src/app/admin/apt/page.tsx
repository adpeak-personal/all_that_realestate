'use client';

import { useCallback } from 'react';
import AdminGate from '../AdminGate';
import SeoTable from '../SeoTable';
import { adminApi, type AdminAptRow } from '../AdminApi';

/**
 * 단지 관리.
 *
 * 단지 정보 자체(단지명·세대수 등)는 수집으로 채워지므로 여기서 고치지 않는다.
 * 고치면 다음 수집에서 덮인다. 손댈 수 있는 건 검색 제목·설명뿐이다.
 * 거래가 많은 단지가 위로 오게 정렬해 둔다 — 손볼 가치가 큰 순서다.
 */
function Control() {
  const load = useCallback((p: { q: string; sido: string; page: number }) => adminApi.apts(p), []);
  const save = useCallback(
    (id: number, patch: { seoTitle: string; seoDescription: string }) => adminApi.aptSeo(id, patch),
    [],
  );

  return (
    <SeoTable<AdminAptRow>
      title="단지"
      hint="검색 결과에 뜨는 제목·설명을 직접 쓸 수 있습니다. 거래가 많은 단지부터 보입니다."
      load={load}
      save={save}
      hrefOf={(row) => `/apt/${row.id}`}
      renderRow={(row) => (
        <span className="block">
          <span className="block font-semibold text-slate-800 truncate">{row.aptNm}</span>
          <span className="block text-xs text-slate-400 truncate">
            {row.sido} {row.sgg} {row.umdNm} · 거래 {row.dealCount.toLocaleString()}건
          </span>
        </span>
      )}
    />
  );
}

export default function AdminAptPage() {
  return (
    <AdminGate>
      <Control />
    </AdminGate>
  );
}
