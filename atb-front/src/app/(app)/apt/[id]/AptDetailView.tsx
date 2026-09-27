'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import PriceTrendChart from '../../../../components/PriceTrendChart';
import AptMap from '../../../../components/AptMap';
import { useAptDetail, useDeals, usePriceTrend } from '../../../../service/main/queries';
import type {
  AptDetail,
  Deal,
  DealListResult,
  TrendResult,
} from '../../../../service/main/type';
import { formatDate, formatPrice, toPyeong } from '../../../../lib/format';

const PAGE_SIZE = 20;

/** K-apt 정보 한 줄. 값이 없으면 '-' 로 두되 항목 자체는 남긴다(무엇이 비었는지 보이게). */
function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between items-baseline py-2.5 border-b border-slate-100 last:border-0">
      <dt className="text-sm text-slate-500 shrink-0 mr-4">{label}</dt>
      <dd className={`text-sm text-right ${value ? 'font-medium text-slate-800' : 'text-slate-300'}`}>
        {value ?? '-'}
      </dd>
    </div>
  );
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-slate-50 rounded-xl p-4 text-center">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-900 leading-tight">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function KaptPanel({ apt }: { apt: AptDetail }) {
  const k = apt.kapt;

  if (!k) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-2">단지 정보</h2>
        <p className="text-sm text-slate-500 leading-relaxed">
          공동주택관리정보시스템(K-apt)에 등록되지 않은 단지입니다.
          <br />
          오피스텔·주상복합·소규모 단지는 의무관리 대상이 아니라 세대수·준공일 등의
          상세 정보가 제공되지 않습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      <h2 className="text-lg font-bold text-slate-900 mb-4">단지 정보</h2>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <StatTile
          label="세대수"
          value={k.totalHouseholds ? k.totalHouseholds.toLocaleString() : '-'}
          sub="세대"
        />
        <StatTile label="동수" value={k.dongCnt ? String(k.dongCnt) : '-'} sub="개 동" />
        <StatTile label="최고층" value={k.topFloor ? String(k.topFloor) : '-'} sub="층" />
        <StatTile
          label="준공"
          value={k.useAprDate ? k.useAprDate.slice(0, 4) : String(apt.buildYear ?? '-')}
          sub="년"
        />
      </div>

      <dl>
        <InfoRow label="사용승인일" value={k.useAprDate} />
        <InfoRow label="시공사" value={k.builder} />
        <InfoRow label="난방방식" value={k.heatType} />
        <InfoRow label="복도유형" value={k.hallType} />
        <InfoRow
          label="총 주차대수"
          value={k.parkingTotal ? `${k.parkingTotal.toLocaleString()}대` : null}
        />
        {/* 0 은 '없음' 이 아니라 미기재로 본다 — 승강기 0대 단지는 사실상 표기 누락이다 */}
        <InfoRow
          label="승강기"
          value={k.elevatorCnt ? `${k.elevatorCnt.toLocaleString()}대` : null}
        />
        <InfoRow
          label="전기차 충전기"
          value={k.evChargerCnt ? `${k.evChargerCnt.toLocaleString()}대` : null}
        />
      </dl>

      {k.parkingTotal === null && (
        <p className="text-xs text-slate-400 mt-3">
          주차·CCTV 등 상세정보는 K-apt 상세 API 를 생략하고 수집해 비어 있습니다.
        </p>
      )}
    </div>
  );
}

interface ViewProps {
  aptId: number;
  /** 서버에서 미리 받아 넘긴 값. 첫 HTML 에 내용이 담기게 한다. */
  initialDetail: AptDetail;
  initialTrend?: TrendResult;
  initialDeals?: DealListResult;
}

/**
 * K-apt 가 "초등학교(대도초등학교) 중학교(숙명여중)" 같은 한 덩어리 문자열로 준다.
 * 괄호 앞을 분류, 괄호 안을 이름으로 쪼갠다. 형식이 어긋나면 통째로 하나로 둔다.
 */
function parseFacilities(raw: string | null): Array<{ kind: string; name: string }> {
  if (!raw) return [];
  const out: Array<{ kind: string; name: string }> = [];
  const re = /([^()]+?)\(([^()]*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const kind = m[1].replace(/[,·]/g, ' ').trim();
    const name = m[2].trim();
    if (kind || name) out.push({ kind, name });
  }
  if (out.length === 0) {
    const t = raw.trim();
    if (t) out.push({ kind: '', name: t });
  }
  return out;
}

function FacilityGroup({ title, raw }: { title: string; raw: string | null }) {
  const items = parseFacilities(raw);
  if (items.length === 0) return null;

  return (
    <div>
      <p className="text-sm font-semibold text-slate-700 mb-2">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((f, i) => (
          <span
            key={`${f.kind}-${f.name}-${i}`}
            className="text-sm bg-slate-50 rounded-lg px-2.5 py-1.5"
          >
            {f.kind && <span className="text-slate-400 mr-1.5">{f.kind}</span>}
            <span className="font-medium text-slate-800">{f.name}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** 교통·학군·편의. K-apt 상세가 단지마다 채움률이 달라 통째로 없을 수 있다. */
/**
 * 위치 지도. 좌표가 없는 단지(주소로 못 찾은 150여 곳)는 아예 렌더하지 않는다 —
 * 빈 회색 상자를 두는 것보다 없는 편이 낫다.
 */
function MapPanel({ apt }: { apt: AptDetail }) {
  if (apt.lat == null || apt.lng == null) return null;

  const addr = [apt.sido, apt.sgg, apt.umdNm, apt.jibun].filter(Boolean).join(' ');
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-900">위치</h2>
        <p className="text-sm text-slate-500 truncate">{addr}</p>
      </div>
      <div className="h-[280px] sm:h-[360px]">
        <AptMap lat={apt.lat} lng={apt.lng} name={apt.aptNm} />
      </div>
    </div>
  );
}

function LocationPanel({ apt }: { apt: AptDetail }) {
  const k = apt.kapt;
  if (!k) return null;

  const hasTransit = k.subwayStation || k.subwayWalk || k.busWalk;
  const hasFacility = k.educationFacility || k.convenientFacility || k.welfareFacility;
  if (!hasTransit && !hasFacility) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
      <h2 className="text-lg font-bold text-slate-900">입지 정보</h2>

      {hasTransit && (
        <div className="flex flex-wrap gap-3">
          {k.subwayStation && (
            <div className="flex-1 min-w-[160px] bg-brand-50 rounded-xl px-4 py-3">
              <p className="text-xs text-brand-700 font-semibold">지하철</p>
              <p className="text-lg font-bold text-slate-900 mt-0.5">
                {k.subwayStation}역
              </p>
              <p className="text-sm text-slate-500">
                {[k.subwayLine, k.subwayWalk].filter(Boolean).join(' · ')}
              </p>
            </div>
          )}
          {k.busWalk && (
            <div className="flex-1 min-w-[160px] bg-slate-50 rounded-xl px-4 py-3">
              <p className="text-xs text-slate-500 font-semibold">버스정류장</p>
              <p className="text-lg font-bold text-slate-900 mt-0.5">{k.busWalk}</p>
              <p className="text-sm text-slate-400">도보</p>
            </div>
          )}
        </div>
      )}

      <FacilityGroup title="학군" raw={k.educationFacility} />
      <FacilityGroup title="주변 편의시설" raw={k.convenientFacility} />
      <FacilityGroup title="단지 내 시설" raw={k.welfareFacility} />
    </div>
  );
}

export default function AptDetailView({
  aptId,
  initialDetail,
  initialTrend,
  initialDeals,
}: ViewProps) {
  const [page, setPage] = useState(1);
  // 선택한 전용면적(표시 문자열, 예: '84.70'). null 이면 전체.
  const [area, setArea] = useState<string | null>(null);

  const pickArea = (a: string) => {
    setArea((prev) => (prev === a ? null : a));   // 같은 칩을 다시 누르면 해제
    setPage(1);                                   // 필터가 바뀌면 3페이지에 머물 이유가 없다
  };

  const detailQuery = useAptDetail(aptId, initialDetail);
  const trendQuery = usePriceTrend({ aptId, months: 12 }, initialTrend);
  // 1페이지일 때만 서버가 준 값을 쓴다 (2페이지부터는 새로 받아야 한다)
  const dealsQuery = useDeals(
    { aptId, page, size: PAGE_SIZE, area: area ? Number(area) : undefined },
    page === 1 && area === null ? initialDeals : undefined,
  );

  // 서버가 항상 넘기므로 undefined 가 될 일이 없다. 타입만 좁혀 둔다.
  const apt = detailQuery.data ?? initialDetail;
  const deals = dealsQuery.data;

  // 59.9772 와 59.9818 처럼 소수점만 다른 값은 소수 2자리로는 같은 글자가 되어
  // 똑같은 칩이 두 개 생긴다. 표시 문자열 기준으로 중복을 없앤다.
  const areaChips = useMemo(
    () => [...new Set((apt?.excluAreas ?? []).map((a) => a.toFixed(2)))],
    [apt],
  );
  const totalPages = deals ? Math.max(Math.ceil(deals.total / deals.size), 1) : 1;

  // 서버가 initialDetail 을 넘기므로 로딩/미존재 분기는 여기서 필요 없다
  // (없는 단지는 서버 컴포넌트에서 notFound() 로 처리된다).

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* ── 헤더 ── */}
        <div className="mb-6">
          <Link
            href="/apt"
            className="text-sm text-slate-500 hover:text-brand-700 transition-colors"
          >
            ← 실거래가 목록
          </Link>

          <h1 className="text-3xl font-bold text-slate-900 tracking-tight mt-3">{apt.aptNm}</h1>

          <p className="text-slate-500 mt-2">
            {apt.kapt?.addrRoad ?? `${apt.sido} ${apt.sgg} ${apt.umdNm} ${apt.jibun ?? ''}`.trim()}
          </p>

          {/* K-apt 상 단지명이 실거래 표기와 다르면 같이 보여준다 (동일 단지인지 확인용) */}
          {apt.kapt && apt.kapt.name !== apt.aptNm && (
            <p className="text-xs text-slate-400 mt-1">K-apt 등록명: {apt.kapt.name}</p>
          )}
        </div>

        <div className="space-y-6">
          <KaptPanel apt={apt} />

          <MapPanel apt={apt} />

          <LocationPanel apt={apt} />

          <PriceTrendChart
            items={trendQuery.data?.items ?? []}
            loading={trendQuery.isLoading}
            title="㎡당 단가 추이"
            subtitle="최근 12개월. 거래가 없던 달은 선이 끊깁니다."
          />

          {/* ── 거래된 전용면적 ── */}
          {areaChips.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-1">거래된 전용면적</h2>
              <p className="text-sm text-slate-500 mb-4">
                누르면 아래 거래 이력을 그 면적만 보여줍니다. 다시 누르면 전체로 돌아갑니다.
              </p>
              <div className="flex flex-wrap gap-2">
                {areaChips.map((a) => {
                  const on = area === a;
                  return (
                    <button
                      key={a}
                      type="button"
                      onClick={() => pickArea(a)}
                      aria-pressed={on}
                      className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
                        on
                          ? 'bg-brand-600 text-white'
                          : 'bg-brand-50 text-brand-700 hover:bg-brand-100'
                      }`}
                    >
                      {a}㎡
                      <span className={`ml-1.5 text-xs ${on ? 'text-brand-100' : 'text-brand-500'}`}>
                        {toPyeong(Number(a))}평
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── 거래 이력 ── */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  거래 이력
                  {area && <span className="text-brand-700"> · {area}㎡</span>}
                </h2>
                {deals && (
                  <p className="text-sm text-slate-500 mt-0.5">
                    총 {deals.total.toLocaleString()}건
                    {area && (
                      <button
                        type="button"
                        onClick={() => pickArea(area)}
                        className="ml-2 text-brand-700 font-medium hover:underline"
                      >
                        전체 보기
                      </button>
                    )}
                  </p>
                )}
              </div>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(p - 1, 1))}
                    disabled={page <= 1 || dealsQuery.isFetching}
                    className="text-sm px-3 py-1.5 rounded-md border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                  >
                    이전
                  </button>
                  <span className="text-sm text-slate-500">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                    disabled={page >= totalPages || dealsQuery.isFetching}
                    className="text-sm px-3 py-1.5 rounded-md border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                  >
                    다음
                  </button>
                </div>
              )}
            </div>

            {dealsQuery.isLoading ? (
              <p className="text-center text-slate-400 py-12 text-sm">불러오는 중…</p>
            ) : !deals || deals.items.length === 0 ? (
              <p className="text-center text-slate-400 py-12 text-sm">거래 이력이 없습니다.</p>
            ) : (
              <>
              {/*
                모바일: 표 대신 2줄 목록. 6열 표는 375px 에서 가로 스크롤이 생기고
                정작 중요한 거래금액이 화면 밖으로 밀린다. 금액을 가장 크게, 왼쪽
                위에 두고 나머지는 보조 정보로 내린다.
              */}
              <ul className="md:hidden divide-y divide-slate-100">
                {deals.items.map((d: Deal) => (
                  <li key={d.id} className="flex items-start justify-between gap-3 px-4 py-3.5">
                    <div className="min-w-0">
                      <p className="text-base font-bold text-brand-700 tabular-nums">
                        {formatPrice(d.dealAmount)}
                      </p>
                      <p className="mt-0.5 text-sm text-slate-600 tabular-nums">
                        {d.excluUseAr.toFixed(2)}㎡
                        <span className="text-slate-400"> ({toPyeong(d.excluUseAr)}평)</span>
                        {d.floor != null && <span> · {d.floor}층</span>}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm text-slate-600 tabular-nums">{formatDate(d.dealDate)}</p>
                      <p className="mt-0.5 text-xs text-slate-400 tabular-nums">
                        {d.dealingGbn && <span>{d.dealingGbn} · </span>}
                        ㎡당 {Math.round(d.dealAmount / d.excluUseAr).toLocaleString()}만
                      </p>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="text-left font-medium px-6 py-3">거래일</th>
                      <th className="text-right font-medium px-3 py-3">전용면적</th>
                      <th className="text-right font-medium px-3 py-3">층</th>
                      <th className="text-right font-medium px-3 py-3">거래금액</th>
                      <th className="text-right font-medium px-3 py-3">㎡당</th>
                      <th className="text-center font-medium px-6 py-3">유형</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {deals.items.map((d: Deal) => (
                      <tr key={d.id} className="hover:bg-slate-50">
                        <td className="px-6 py-3 text-slate-600">{formatDate(d.dealDate)}</td>
                        <td className="px-3 py-3 text-right text-slate-600">
                          {d.excluUseAr.toFixed(2)}㎡
                          <span className="text-slate-400 text-xs ml-1">
                            {toPyeong(d.excluUseAr)}평
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right text-slate-600">{d.floor ?? '-'}</td>
                        <td className="px-3 py-3 text-right font-bold text-brand-700">
                          {formatPrice(d.dealAmount)}
                        </td>
                        <td className="px-3 py-3 text-right text-slate-400 text-xs">
                          {Math.round(d.dealAmount / d.excluUseAr).toLocaleString()}만
                        </td>
                        <td className="px-6 py-3 text-center text-slate-400 text-xs">
                          {d.dealingGbn ?? '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
