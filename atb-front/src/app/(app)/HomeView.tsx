'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import KoreaMap from '../../components/KoreaMap';
import PriceTrendChart from '../../components/PriceTrendChart';
import { usePriceTrend, useRecentDeals, useRegionStats } from '../../service/main/queries';
import type {
  Deal,
  RecentDealsResult,
  RegionStat,
  RegionStatsResult,
  TrendResult,
} from '../../service/main/type';
import { formatDate, formatPrice, formatYearMonth } from '../../lib/format';

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** KoreaMap 이 넘겨주는 정식 지역명 → 통계 API 의 단축명 */
function toShortName(rawName: string): string {
  const n = rawName
    .replace('특별자치도', '')
    .replace('특별자치시', '')
    .replace('광역시', '')
    .replace('특별시', '')
    .replace(/도$/, '');
  const overrides: Record<string, string> = {
    '충청북': '충북', '충청남': '충남',
    '전라북': '전북', '전라남': '전남',
    '경상북': '경북', '경상남': '경남',
    '강원특별자치': '강원', '전북특별자치': '전북',
  };
  return overrides[n] ?? n;
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function CheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function StatBox({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="bg-slate-50 rounded-xl p-3 text-center">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-slate-900 leading-tight">{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{unit}</p>
    </div>
  );
}

function TrendBox({ trend }: { trend: number | null }) {
  return (
    <div className="bg-slate-50 rounded-xl p-3 text-center flex flex-col justify-center">
      <p className="text-xs text-slate-500 mb-1">전월 대비</p>
      {trend === null ? (
        <p className="text-xl font-bold leading-tight text-slate-300">–</p>
      ) : (
        <p
          className={`text-xl font-bold leading-tight ${
            trend >= 0 ? 'text-red-500' : 'text-blue-500'
          }`}
        >
          {trend >= 0 ? '▲' : '▼'}
          {Math.abs(trend)}%
        </p>
      )}
      <p className="text-xs text-slate-400 mt-0.5">㎡당 단가</p>
    </div>
  );
}

function FeatureItem({ label, desc, disabled }: { label: string; desc: string; disabled?: boolean }) {
  return (
    <div className={`flex items-start gap-2.5 ${disabled ? 'opacity-40' : ''}`}>
      <CheckIcon className="w-5 h-5 text-indigo-500 mt-0.5 shrink-0" />
      <div>
        <p className="text-sm font-semibold text-slate-800">
          {label}
          {disabled && <span className="text-xs font-normal text-slate-400 ml-1">(준비중)</span>}
        </p>
        <p className="text-sm text-slate-500 mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

function DealCard({ deal }: { deal: Deal }) {
  const card = (
    <div className="bg-white rounded-xl border border-slate-200 p-4 h-full hover:shadow-lg hover:border-indigo-300 transition-all group">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
          아파트
        </span>
        <span className="text-xs text-slate-400">
          {deal.sido} {deal.sgg}
        </span>
      </div>
      <p className="font-semibold text-slate-800 text-base leading-snug mb-1 truncate group-hover:text-indigo-600 transition-colors">
        {deal.aptNm}
      </p>
      <p className="text-sm text-slate-500 mb-3">
        {deal.excluUseAr.toFixed(1)}㎡{deal.floor !== null && ` · ${deal.floor}층`}
      </p>
      <p className="text-2xl font-bold text-indigo-600">{formatPrice(deal.dealAmount)}</p>
      <p className="text-xs text-slate-400 mt-1">{formatDate(deal.dealDate)} 거래</p>
    </div>
  );

  // apt_id 가 없는 거래(단지 미연결)는 상세로 갈 수 없으므로 링크하지 않는다.
  return deal.aptId ? <Link href={`/apt/${deal.aptId}`}>{card}</Link> : card;
}

/** 데이터가 아직 수집되지 않았을 때 공통으로 쓰는 안내 */
function EmptyState({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="text-center py-16 bg-slate-50 rounded-xl border border-dashed border-slate-200">
      <p className="text-base font-medium text-slate-600">{title}</p>
      <p className="text-sm text-slate-400 mt-1.5">{desc}</p>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

interface ViewProps {
  /** 서버에서 받은 전국 기준 초기값. 첫 HTML 에 내용이 담기게 한다. */
  initialStats?: RegionStatsResult;
  initialDeals?: RecentDealsResult;
  initialTrend?: TrendResult;
}

export default function HomeView({ initialStats, initialDeals, initialTrend }: ViewProps) {
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [mapPaddingX, setMapPaddingX] = useState(120); // 기본값 (SSR)

  useEffect(() => {
    const update = () => setMapPaddingX(window.innerWidth < 1024 ? 30 : 120);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const shortSelected = selectedRegion ? toShortName(selectedRegion) : null;

  const statsQuery = useRegionStats(undefined, initialStats);
  const dealsQuery = useRecentDeals(shortSelected, 8, initialDeals);
  // 지역 미선택이면 전국 추이. 서버가 준 값도 전국 기준이라 그때만 쓴다.
  const trendQuery = usePriceTrend(
    { sido: shortSelected ?? undefined, months: 12 },
    shortSelected === null ? initialTrend : undefined,
  );

  const stats = statsQuery.data;
  const baseMonthLabel = formatYearMonth(stats?.baseMonth ?? null);

  const regionStat: RegionStat | null = useMemo(() => {
    if (!shortSelected || !stats) return null;
    return stats.items.find((s) => s.sido === shortSelected) ?? null;
  }, [shortSelected, stats]);

  /** 전국 집계 — 거래건수 가중평균으로 계산 */
  const national = useMemo(() => {
    const items = stats?.items ?? [];
    if (items.length === 0) return null;

    const trades = items.reduce((sum, s) => sum + s.trades, 0);
    if (trades === 0) return null;

    const avgPrice = Math.round(
      items.reduce((sum, s) => sum + s.avgPrice * s.trades, 0) / trades,
    );

    const withTrend = items.filter((s) => s.trend !== null);
    const trendWeight = withTrend.reduce((sum, s) => sum + s.trades, 0);
    const trend =
      trendWeight > 0
        ? Number(
            (
              withTrend.reduce((sum, s) => sum + (s.trend as number) * s.trades, 0) /
              trendWeight
            ).toFixed(1),
          )
        : null;

    return { trades, avgPrice, regions: items.length, trend };
  }, [stats]);

  const deals = dealsQuery.data?.items ?? [];
  const regionDeals = shortSelected ? deals.slice(0, 5) : [];
  const loadingDeals = dealsQuery.isLoading;

  return (
    <div className="bg-slate-50">
      {/* ── Hero / Map ── */}
      <section className="py-10 sm:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">지역별 부동산 현황</h1>
            <p className="text-slate-500 text-base mt-2">
              지도에서 지역을 선택해 실거래가 정보를 확인하세요
              {baseMonthLabel && (
                <span className="text-slate-400"> · {baseMonthLabel} 기준</span>
              )}
            </p>
          </div>

          <div className="flex flex-col lg:flex-row gap-6 items-start">
            {/* Map */}
            <div className="w-full lg:w-[56%] bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-6">
              <KoreaMap
                onSelect={setSelectedRegion}
                selected={selectedRegion}
                selectedColor="#4F46E5"
                height={480}
                paddingX={mapPaddingX}
                paddingY={0}
              />
            </div>

            {/* Info Panel */}
            <div className="w-full lg:w-[44%] space-y-4">
              {shortSelected ? (
                <>
                  {/* Region stats */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
                    <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-1">
                      선택된 지역
                    </p>
                    <h2 className="text-3xl font-bold text-slate-900 mb-5">{shortSelected}</h2>

                    {regionStat ? (
                      <div className="grid grid-cols-3 gap-3">
                        <StatBox
                          label="거래 건수"
                          value={regionStat.trades.toLocaleString()}
                          unit="건"
                        />
                        <StatBox
                          label="평균 실거래가"
                          value={formatPrice(regionStat.avgPrice)}
                          unit=""
                        />
                        <TrendBox trend={regionStat.trend} />
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 py-4">
                        {statsQuery.isLoading
                          ? '통계를 불러오는 중…'
                          : '이 지역은 아직 수집된 거래가 없습니다'}
                      </p>
                    )}
                  </div>

                  {/* Recent transactions for this region */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
                    <p className="text-sm font-semibold text-slate-700 mb-3">
                      {shortSelected} 최근 거래
                    </p>
                    {loadingDeals ? (
                      <p className="text-sm text-slate-400 text-center py-5">불러오는 중…</p>
                    ) : regionDeals.length > 0 ? (
                      <div className="divide-y divide-slate-100">
                        {regionDeals.map((deal) => (
                          <div key={deal.id} className="flex items-center justify-between py-2.5">
                            <div className="min-w-0 mr-3">
                              {deal.aptId ? (
                                <Link
                                  href={`/apt/${deal.aptId}`}
                                  className="text-sm font-medium text-slate-800 truncate block hover:text-indigo-600"
                                >
                                  {deal.aptNm}
                                </Link>
                              ) : (
                                <p className="text-sm font-medium text-slate-800 truncate">
                                  {deal.aptNm}
                                </p>
                              )}
                              <p className="text-xs text-slate-400">
                                {deal.sgg} · {deal.excluUseAr.toFixed(1)}㎡
                                {deal.floor !== null && ` · ${deal.floor}층`}
                              </p>
                            </div>
                            <p className="text-sm font-bold text-indigo-600 shrink-0">
                              {formatPrice(deal.dealAmount)}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 text-center py-5">
                        등록된 거래 데이터가 없습니다
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* Default panel */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
                    <h2 className="text-lg font-bold text-slate-900 mb-1">지역을 선택해보세요</h2>
                    <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                      지도에서 원하는 지역을 클릭하면
                      <br className="hidden sm:inline" />
                      해당 지역의 부동산 정보를 볼 수 있어요
                    </p>
                    <div className="space-y-4">
                      <FeatureItem
                        label="실거래가 조회"
                        desc="국토교통부 아파트 매매 실거래가 확인"
                      />
                      <FeatureItem label="시세 분석" desc="지역별 가격 동향 분석" disabled />
                      <FeatureItem label="분양정보 확인" desc="분양 예정·진행 단지 정보" disabled />
                    </div>
                  </div>

                  {/* National stats */}
                  <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl p-6 text-white">
                    <p className="text-xs font-semibold opacity-70 uppercase tracking-wide mb-4">
                      전국 현황{baseMonthLabel && ` (${baseMonthLabel})`}
                    </p>
                    {national ? (
                      <div className="grid grid-cols-2 gap-y-5 gap-x-4">
                        <div>
                          <p className="text-2xl font-bold">{national.trades.toLocaleString()}</p>
                          <p className="text-xs opacity-60 mt-0.5">전국 거래건수</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{formatPrice(national.avgPrice)}</p>
                          <p className="text-xs opacity-60 mt-0.5">전국 평균가</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{national.regions}개</p>
                          <p className="text-xs opacity-60 mt-0.5">수집된 지역</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold">
                            {national.trend === null
                              ? '–'
                              : `${national.trend >= 0 ? '▲' : '▼'} ${Math.abs(national.trend)}%`}
                          </p>
                          <p className="text-xs opacity-60 mt-0.5">전월 대비 ㎡당</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm opacity-70 py-4">
                        {statsQuery.isLoading
                          ? '집계 중…'
                          : '아직 수집된 실거래 데이터가 없습니다'}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── 시세 추이 ── */}
      <section className="pb-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <PriceTrendChart
            items={trendQuery.data?.items ?? []}
            loading={trendQuery.isLoading}
            title={`${shortSelected ?? '전국'} ㎡당 단가 추이`}
            subtitle="최근 12개월 평균. 평균 거래금액이 아니라 면적당 단가라 평형 구성에 덜 흔들립니다."
          />
        </div>
      </section>

      {/* ── 실거래가 ── */}
      <section id="transactions" className="py-14 bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">최근 실거래가</h2>
              <p className="text-base text-slate-500 mt-1">
                {shortSelected
                  ? `${shortSelected} 지역의 최근 거래 내역입니다`
                  : '전국 최근 거래 내역입니다'}
              </p>
            </div>
            {shortSelected && (
              <button
                onClick={() => setSelectedRegion(null)}
                className="text-sm font-semibold text-indigo-600 hover:text-indigo-500 transition-colors self-start sm:self-auto"
              >
                전국 보기
              </button>
            )}
          </div>

          {loadingDeals ? (
            <EmptyState title="불러오는 중…" desc="" />
          ) : deals.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {deals.map((deal) => (
                <DealCard key={deal.id} deal={deal} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="표시할 거래 데이터가 없습니다"
              desc="atb-program 에서 실거래 수집을 먼저 실행해주세요"
            />
          )}
        </div>
      </section>

      {/* ── 분양정보 ── */}
      <section id="presales" className="py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">주요 분양정보</h2>
            <p className="text-base text-slate-500 mt-1">
              전국 분양 예정 및 진행 중인 단지 정보입니다
            </p>
          </div>
          <EmptyState
            title="분양정보 준비중"
            desc="청약홈 분양 데이터 연동 후 제공될 예정입니다"
          />
        </div>
      </section>
    </div>
  );
}
