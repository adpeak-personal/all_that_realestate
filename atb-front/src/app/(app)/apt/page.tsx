import type { Metadata } from 'next';
import Link from 'next/link';
import { Pager, SggChips, SidoTabs, SortSelect } from './AptBrowser';
import { SORT_LABELS } from '../../../lib/apt-sort';
import { fetchApts, fetchSggBreakdown } from '../../../service/server/api';
import { formatPrice, toPyeong } from '../../../lib/format';
import type { AptSort } from '../../../service/main/type';

const SIZE = 30;
const VALID_SORTS = new Set(SORT_LABELS.map((s) => s.value));

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** searchParams 는 사용자 입력이다. 정렬키는 화이트리스트로 한 번 거른다. */
async function readParams(searchParams: Props['searchParams']) {
  const sp = await searchParams;
  const sortRaw = one(sp.sort);
  return {
    sido: one(sp.sido) || '서울',
    sggCd: one(sp.sggCd) || null,
    sort: (VALID_SORTS.has(sortRaw as AptSort) ? sortRaw : 'deals') as AptSort,
    page: Math.max(Number(one(sp.page)) || 1, 1),
  };
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { sido, sggCd } = await readParams(searchParams);

  const breakdown = await fetchSggBreakdown(sido);
  const sgg = sggCd ? breakdown?.items.find((i) => i.code === sggCd)?.sgg : null;
  const where = sgg ? `${sido} ${sgg}` : sido;

  return {
    title: `${where} 아파트 단지 목록`,
    description:
      `${where}의 아파트 단지를 거래량·㎡당 단가·세대수로 정렬해 찾아보세요. ` +
      '국토교통부 실거래가 기준.',
    alternates: { canonical: sggCd ? `/apt?sido=${sido}&sggCd=${sggCd}` : `/apt?sido=${sido}` },
  };
}

export default async function AptListPage({ searchParams }: Props) {
  const { sido, sggCd, sort, page } = await readParams(searchParams);

  const [breakdown, result] = await Promise.all([
    fetchSggBreakdown(sido),
    fetchApts({ sido, sggCd: sggCd ?? undefined, sort, page, size: SIZE }),
  ]);

  const sggName = sggCd ? breakdown?.items.find((i) => i.code === sggCd)?.sgg : null;
  const where = sggName ? `${sido} ${sggName}` : `${sido} 전체`;
  const total = result?.total ?? 0;
  const totalPages = Math.max(Math.ceil(total / SIZE), 1);

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">아파트 단지 찾기</h1>
          <p className="text-slate-500 mt-2">
            지역을 고르면 그 지역의 단지를 거래량·시세 순으로 볼 수 있습니다.
          </p>
        </div>

        {/* 지역 선택 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 mb-6 space-y-4">
          <div>
            <p className="text-xs font-semibold text-slate-400 mb-2">시 · 도</p>
            <SidoTabs selected={sido} />
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-400 mb-2">
              시 · 군 · 구
              <span className="ml-1.5 font-normal text-slate-300">숫자는 거래건수</span>
            </p>
            <SggChips items={breakdown?.items ?? []} selected={sggCd} />
          </div>
        </div>

        {/* 결과 헤더 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <p className="text-sm text-slate-600">
            <span className="font-bold text-slate-900">{where}</span>
            <span className="text-slate-400 mx-1.5">·</span>
            단지 <span className="font-bold text-slate-900">{total.toLocaleString()}</span>개
          </p>
          <SortSelect value={sort} />
        </div>

        {/* 단지 목록 */}
        {!result || result.items.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
            <p className="text-slate-600">이 지역에는 수집된 거래가 없습니다</p>
            <p className="text-sm text-slate-400 mt-1.5">다른 지역을 선택해보세요</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <ul className="divide-y divide-slate-100">
              {result.items.map((apt, i) => (
                <li key={apt.id}>
                  <Link
                    href={`/apt/${apt.id}`}
                    className="flex items-center gap-4 px-4 sm:px-6 py-4 hover:bg-slate-50 transition-colors"
                  >
                    <span className="text-sm text-slate-300 tabular-nums w-8 shrink-0 text-right">
                      {(page - 1) * SIZE + i + 1}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-slate-800 truncate">
                        {apt.aptNm}
                      </span>
                      <span className="block text-sm text-slate-400 mt-0.5 truncate">
                        {apt.sgg} {apt.umdNm}
                        {apt.households ? ` · ${apt.households.toLocaleString()}세대` : ''}
                        {apt.buildYear ? ` · ${apt.buildYear}년` : ''}
                      </span>
                    </span>

                    {/* 거래건수 — 좁은 화면에서는 접는다 */}
                    <span className="hidden sm:block text-center w-20 shrink-0">
                      <span className="block text-sm font-medium text-slate-700 tabular-nums">
                        {apt.dealCount.toLocaleString()}
                      </span>
                      <span className="block text-xs text-slate-400">거래</span>
                    </span>

                    <span className="text-right w-32 sm:w-40 shrink-0">
                      {apt.lastDealAmount !== null ? (
                        <>
                          <span className="block font-bold text-indigo-600 tabular-nums">
                            {formatPrice(apt.lastDealAmount)}
                          </span>
                          <span className="block text-xs text-slate-400 tabular-nums mt-0.5">
                            {apt.lastDealArea !== null && `${toPyeong(apt.lastDealArea)}평 · `}
                            ㎡당 {apt.unitPrice?.toLocaleString()}만
                          </span>
                        </>
                      ) : (
                        <span className="text-sm text-slate-300">-</span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-6">
            <Pager page={page} totalPages={totalPages} />
            <p className="text-center text-xs text-slate-400 mt-3">
              {page} / {totalPages} 페이지
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
