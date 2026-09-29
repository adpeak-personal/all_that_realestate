'use client';

import { useCallback, useState } from 'react';
import AdminGate from '../AdminGate';
import SeoTable from '../SeoTable';
import { adminApi, type AdminPresaleRow } from '../AdminApi';

/**
 * 분양 공고 관리.
 *
 * 두 가지를 한다: 검색 제목·설명 손질, 노출 제어(추천·가중치·숨김).
 * 둘 다 수집이 건드리지 않는 칸이라, 매일 수집이 돌아도 남는다.
 * 단지명·분양가처럼 수집으로 채워지는 값은 여기서 고치지 않는다 — 다음 수집에 덮인다.
 */
function Control() {
  const [flagBusy, setFlagBusy] = useState<number | null>(null);
  // 방금 바꾼 값. 목록을 다시 불러오지 않고 화면만 갱신한다.
  const [flags, setFlags] = useState<Record<number, Partial<AdminPresaleRow>>>({});

  const load = useCallback(
    (p: { q: string; sido: string; page: number }) => adminApi.presales(p),
    [],
  );
  const save = useCallback(
    (id: number, patch: { seoTitle: string; seoDescription: string }) =>
      adminApi.presaleSeo(id, patch),
    [],
  );

  const patchFlag = async (row: AdminPresaleRow, change: Partial<AdminPresaleRow>) => {
    setFlagBusy(row.id);
    try {
      await adminApi.presaleFlags(row.id, change);
      setFlags((prev) => ({ ...prev, [row.id]: { ...prev[row.id], ...change } }));
    } finally {
      setFlagBusy(null);
    }
  };

  return (
    <SeoTable<AdminPresaleRow>
      title="분양 공고"
      hint="검색 결과에 뜨는 제목·설명을 직접 쓸 수 있습니다. 추천을 켜면 메인과 목록 맨 위로 올라갑니다."
      load={load}
      save={save}
      hrefOf={(row) => `/presale/${row.id}`}
      renderRow={(raw) => {
        const row = { ...raw, ...flags[raw.id] };
        return (
          <span className="block">
            <span className="block font-semibold text-slate-800 truncate">{row.houseNm}</span>
            <span className="block text-xs text-slate-400 truncate">
              {[row.sido, row.sgg].filter(Boolean).join(' ')}
              {row.houseType ? ` · ${row.houseType}` : ''}
              {row.rceptBgnde ? ` · 접수 ${row.rceptBgnde}` : ''}
            </span>
            <span className="mt-1.5 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => patchFlag(raw, { isFeatured: !row.isFeatured })}
                disabled={flagBusy === row.id}
                className={`rounded px-2 py-0.5 text-xs font-bold disabled:opacity-50 ${
                  row.isFeatured
                    ? 'bg-sale-600 text-white'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                추천
              </button>
              <button
                type="button"
                onClick={() => patchFlag(raw, { isHidden: !row.isHidden })}
                disabled={flagBusy === row.id}
                className={`rounded px-2 py-0.5 text-xs font-bold disabled:opacity-50 ${
                  row.isHidden
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {row.isHidden ? '숨김' : '노출'}
              </button>
              <input
                type="number"
                defaultValue={row.sortWeight}
                onBlur={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v) && v !== row.sortWeight) patchFlag(raw, { sortWeight: v });
                }}
                title="가중치 — 클수록 앞에 옵니다"
                className="w-14 rounded border border-slate-300 px-1 py-0.5 text-right text-xs tabular-nums"
              />
            </span>
          </span>
        );
      }}
    />
  );
}

export default function AdminPresalePage() {
  return (
    <AdminGate>
      <Control />
    </AdminGate>
  );
}
