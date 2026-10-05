import type { Metadata } from 'next';
import Link from 'next/link';
import { Pager, SggChips, SidoTabs, SortSelect, TypeTabs } from './AptBrowser';
import AptListMap from '../../../components/AptListMap';
import { PROPERTY_TABS, SORT_LABELS } from '../../../lib/apt-sort';
import { fetchApts, fetchSettings, fetchSggBreakdown } from '../../../service/server/api';
import { formatPrice, toPyeong } from '../../../lib/format';
import type { AptSort } from '../../../service/main/type';

const SIZE = 30;
const VALID_SORTS = new Set(SORT_LABELS.map((s) => s.value));
const VALID_TYPES = new Set(PROPERTY_TABS.map((t) => t.value).filter(Boolean));

/** 유형별 화면 문구. 유형을 안 고르면 둘 다 섞여 나온다. */
const TYPE_WORD: Record<string, string> = { APT: '아파트', OFFI: '오피스텔' };
function typeWord(type: string): string {
  return TYPE_WORD[type] ?? '아파트·오피스텔';
}

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
  const typeRaw = (one(sp.type) || '').toUpperCase();
  return {
    q: (one(sp.q) || '').trim(),
    sido: one(sp.sido) || '서울',
    sggCd: one(sp.sggCd) || null,
    type: VALID_TYPES.has(typeRaw) ? typeRaw : '',
    sort: (VALID_SORTS.has(sortRaw as AptSort) ? sortRaw : 'deals') as AptSort,
    page: Math.max(Number(one(sp.page)) || 1, 1),
  };
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q, sido, sggCd, type } = await readParams(searchParams);

  // 검색 결과는 색인 대상이 아니다 (같은 내용이 무한히 생긴다)
  if (q) {
    return {
      title: `'${q}' 단지 검색`,
      description: `단지명에 '${q}' 가 들어가는 아파트를 찾습니다.`,
      robots: { index: false, follow: true },
    };
  }

  const breakdown = await fetchSggBreakdown(sido);
  const sgg = sggCd ? breakdown?.items.find((i) => i.code === sggCd)?.sgg : null;
  const where = sgg ? `${sido} ${sgg}` : sido;
  const word = typeWord(type);

  // canonical 에 유형을 넣는다. 안 넣으면 아파트·오피스텔 목록이 같은 주소로
  // 몰려 둘 중 하나만 색인된다.
  const qs = [`sido=${sido}`, sggCd ? `sggCd=${sggCd}` : '', type ? `type=${type}` : '']
    .filter(Boolean)
    .join('&');

  return {
    title: `${where} ${word} 단지 목록`,
    description:
      `${where}의 ${word} 단지를 거래량·㎡당 단가·세대수로 정렬해 찾아보세요. ` +
      '국토교통부 실거래가 기준.',
    alternates: { canonical: `/apt?${qs}` },
  };
}

export default async function AptListPage({ searchParams }: Props) {
  const { q, sido, sggCd, type, sort, page } = await readParams(searchParams);

  // 검색어가 있으면 지역을 가리지 않고 전국에서 찾는다.
  const [breakdown, result, settings] = await Promise.all([
    fetchSggBreakdown(sido),
    fetchApts(
      q
        ? { q, type: type || undefined, sort, page, size: SIZE }
        : { sido, sggCd: sggCd ?? undefined, type: type || undefined, sort, page, size: SIZE },
    ),
    fetchSettings(),
  ]);
  const mapEnabled = settings.mapEnabled;

  const sggName = sggCd ? breakdown?.items.find((i) => i.code === sggCd)?.sgg : null;
  const where = q ? `'${q}' 검색` : sggName ? `${sido} ${sggName}` : `${sido} 전체`;
  const total = result?.total ?? 0;
  const totalPages = Math.max(Math.ceil(total / SIZE), 1);

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            {typeWord(type)} 단지 찾기
          </h1>
          <p className="text-slate-500 mt-2">
            {q
              ? '단지명으로 전국에서 찾은 결과입니다.'
              : '지역을 고르면 그 지역의 단지를 거래량·시세 순으로 볼 수 있습니다.'}
          </p>
        </div>

        {q ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 mb-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-slate-700">
              <span className="font-bold text-slate-900">&lsquo;{q}&rsquo;</span> 검색 결과
            </p>
            <Link
              href="/apt"
              className="text-sm font-semibold text-brand-700 hover:text-brand-600"
            >
              지역으로 찾기 →
            </Link>
          </div>
        ) : (
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
        )}

        {/* 결과 헤더 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <p className="text-sm text-slate-600">
            <span className="font-bold text-slate-900">{where}</span>
            <span className="text-slate-400 mx-1.5">·</span>
            단지 <span className="font-bold text-slate-900">{total.toLocaleString()}</span>개
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <TypeTabs selected={type} />
            <SortSelect value={sort} />
          </div>
        </div>

        {/* 지도 — 이 페이지에 실린 단지의 핀. 어드민에서 끄면 나오지 않는다 */}
        {result && result.items.length > 0 && (
          <AptListMap items={result.items} enabled={mapEnabled} />
        )}

        {/* 단지 목록 */}
        {!result || result.items.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
            <p className="text-slate-600">
              {q ? '검색 결과가 없습니다' : '이 지역에는 수집된 거래가 없습니다'}
            </p>
            <p className="text-sm text-slate-400 mt-1.5">
              {q ? '단지명 일부만 입력해보세요 (예: 래미안)' : '다른 지역을 선택해보세요'}
            </p>
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
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span className="font-semibold text-slate-800 truncate">
                          {apt.aptNm}
                        </span>
                        {apt.propertyType === 'OFFI' && (
                          <span className="shrink-0 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-500">
                            오피스텔
                          </span>
                        )}
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
                          <span className="block font-bold text-brand-700 tabular-nums">
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
