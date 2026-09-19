'use client';

import { useMemo, useState } from 'react';
import { useDeals, useRegionStats, useSggCodes } from '../../../service/main/queries';
import type { Deal, DealListParams } from '../../../service/main/type';

const PAGE_SIZE = 50;

function formatPrice(manwon: number): string {
  if (manwon >= 10000) {
    const eok = Math.floor(manwon / 10000);
    const rem = manwon % 10000;
    return rem === 0 ? `${eok}억` : `${eok}억 ${rem.toLocaleString()}만`;
  }
  return `${manwon.toLocaleString()}만`;
}

function currentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function AptTradePage() {
  const [sggCd, setSggCd] = useState('11680');
  // null 이면 '사용자가 아직 안 건드림' → 수집된 최신월을 그대로 쓴다.
  const [dealYmdInput, setDealYmdInput] = useState<string | null>(null);
  const [aptNm, setAptNm] = useState('');
  const [page, setPage] = useState(1);

  // 조회 버튼을 눌렀을 때 확정되는 검색 파라미터 (null 이면 아직 조회 전)
  const [params, setParams] = useState<DealListParams | null>(null);

  const sggQuery = useSggCodes();
  const dealsQuery = useDeals(params);

  // 실거래가는 신고 기한 때문에 이번 달 데이터가 아직 없다.
  // 기본값을 이번 달로 두면 첫 조회가 항상 0건이라, 수집된 최신월을 기본값으로 쓴다.
  const statsQuery = useRegionStats();
  const latestMonth = statsQuery.data?.baseMonth ?? null;
  const dealYmd = dealYmdInput ?? latestMonth ?? currentYearMonth();

  const result = dealsQuery.data ?? null;
  const loading = dealsQuery.isFetching;
  const error = dealsQuery.error instanceof Error ? dealsQuery.error.message : null;

  // 시군구를 시도별로 묶어 optgroup 으로 보여준다.
  const sggGroups = useMemo(() => {
    const groups = new Map<string, Array<{ code: string; sgg: string }>>();
    for (const item of sggQuery.data?.items ?? []) {
      const list = groups.get(item.sido) ?? [];
      list.push({ code: item.code, sgg: item.sgg });
      groups.set(item.sido, list);
    }
    return [...groups.entries()];
  }, [sggQuery.data]);

  function search(nextPage = 1) {
    setPage(nextPage);
    setParams({
      sggCd,
      dealYmd,
      aptNm: aptNm.trim() || undefined,
      page: nextPage,
      size: PAGE_SIZE,
    });
  }

  const totalPages = result ? Math.max(Math.ceil(result.total / result.size), 1) : 1;

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">아파트 실거래가</h1>
          <p className="text-slate-500 text-base mt-2">
            수집된 국토교통부 실거래 데이터를 조회합니다.
          </p>
        </div>

        {/* ── 검색 폼 ── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 mb-6">
          <div className="flex flex-wrap gap-4 items-end">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-700">지역</span>
              <select
                value={sggCd}
                onChange={(e) => setSggCd(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm min-w-[200px] bg-white"
              >
                {sggQuery.isLoading && <option>불러오는 중…</option>}
                {sggGroups.map(([sido, list]) => (
                  <optgroup key={sido} label={sido}>
                    {list.map((s) => (
                      <option key={s.code} value={s.code}>
                        {sido} {s.sgg}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-700">거래년월</span>
              <input
                value={dealYmd}
                onChange={(e) => setDealYmdInput(e.target.value)}
                placeholder="YYYYMM"
                maxLength={6}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-[130px]"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-700">단지명 (선택)</span>
              <input
                value={aptNm}
                onChange={(e) => setAptNm(e.target.value)}
                placeholder="예: 래미안"
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-[180px]"
              />
            </label>

            <button
              onClick={() => search(1)}
              disabled={loading}
              className="bg-indigo-600 text-white text-sm font-semibold px-6 py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {loading ? '조회 중…' : '조회'}
            </button>
          </div>

          <p className="text-xs text-slate-400 mt-4">
            {latestMonth
              ? `수집된 최신 거래월은 ${latestMonth.slice(0, 4)}년 ${Number(latestMonth.slice(4, 6))}월입니다. `
              : ''}
            데이터 수집은 atb-program(Python) 에서 실행합니다. 조회 결과가 비어 있으면
            해당 지역·월이 아직 수집되지 않은 것입니다.
          </p>
        </div>

        {/* ── 결과 ── */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6 text-sm">
            {error}
          </div>
        )}

        {result && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <p className="text-sm text-slate-600">
                총 <span className="font-bold text-slate-900">{result.total.toLocaleString()}</span>건
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => search(page - 1)}
                    disabled={page <= 1 || loading}
                    className="text-sm px-3 py-1.5 rounded-md border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                  >
                    이전
                  </button>
                  <span className="text-sm text-slate-500">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => search(page + 1)}
                    disabled={page >= totalPages || loading}
                    className="text-sm px-3 py-1.5 rounded-md border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                  >
                    다음
                  </button>
                </div>
              )}
            </div>

            {result.items.length === 0 ? (
              <p className="text-center text-slate-400 py-16 text-sm">
                조회된 거래가 없습니다.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="text-left font-medium px-5 py-3">단지명</th>
                      <th className="text-left font-medium px-3 py-3">법정동</th>
                      <th className="text-right font-medium px-3 py-3">전용면적</th>
                      <th className="text-right font-medium px-3 py-3">층</th>
                      <th className="text-right font-medium px-3 py-3">거래금액</th>
                      <th className="text-center font-medium px-3 py-3">거래일</th>
                      <th className="text-center font-medium px-5 py-3">유형</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {result.items.map((d: Deal) => (
                      <tr key={d.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3 font-medium text-slate-800">{d.aptNm}</td>
                        <td className="px-3 py-3 text-slate-500">{d.umdNm}</td>
                        <td className="px-3 py-3 text-right text-slate-600">
                          {d.excluUseAr.toFixed(2)}㎡
                        </td>
                        <td className="px-3 py-3 text-right text-slate-600">{d.floor ?? '-'}</td>
                        <td className="px-3 py-3 text-right font-bold text-indigo-600">
                          {formatPrice(d.dealAmount)}
                        </td>
                        <td className="px-3 py-3 text-center text-slate-500">{d.dealDate}</td>
                        <td className="px-5 py-3 text-center text-slate-400 text-xs">
                          {d.dealingGbn ?? '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {!result && !error && (
          <p className="text-center text-slate-400 py-16 text-sm">
            지역과 거래년월을 선택하고 조회 버튼을 눌러주세요.
          </p>
        )}
      </div>
    </div>
  );
}
