import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { StatusBadge, daysLeft, formatMoveIn, priceRange } from '../PresaleUI';
import { fetchPresaleDetail } from '../../../../service/server/api';
import { formatPrice, toPyeong, presalePriceLabel } from '../../../../lib/format';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const p = await fetchPresaleDetail(id);
  if (!p) return { title: '분양 공고를 찾을 수 없습니다' };

  const where = [p.sido, p.sgg].filter(Boolean).join(' ');
  const price = priceRange(p.minAmount, p.maxAmount);

  return {
    title: `${p.houseNm} 분양정보`,
    description:
      `${where} ${p.houseNm} 청약 일정과 ${presalePriceLabel(p.houseType, p.rentType)}. ` +
      [
        p.totalHouseholds ? `총 ${p.totalHouseholds.toLocaleString()}세대` : null,
        price ? `${presalePriceLabel(p.houseType, p.rentType)} ${price}` : null,
      ]
        .filter(Boolean)
        .join(' · '),
    alternates: { canonical: `/presale/${p.id}` },
  };
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between items-baseline gap-4 py-2.5 border-b border-slate-100 last:border-0">
      <dt className="text-sm text-slate-500 shrink-0">{label}</dt>
      <dd className={`text-sm text-right ${value ? 'font-medium text-slate-800' : 'text-slate-300'}`}>
        {value ?? '-'}
      </dd>
    </div>
  );
}

function period(a: string | null, b: string | null): string | null {
  if (!a && !b) return null;
  return `${a ?? '?'} ~ ${b ?? '?'}`;
}

export default async function PresaleDetailPage({ params }: Props) {
  const { id } = await params;
  const p = await fetchPresaleDetail(id);
  if (!p) notFound();

  const where = [p.sido, p.sgg].filter(Boolean).join(' ');
  const left = daysLeft(p.status, p.rceptEndde);
  const price = priceRange(p.minAmount, p.maxAmount);
  const priceLabel = presalePriceLabel(p.houseType, p.rentType);

  const flags = [
    p.specltRdnEarthAt === 'Y' ? '투기과열지구' : null,
    p.mdatTrgetAreaAt === 'Y' ? '조정대상지역' : null,
    p.parcprcUlsAt === 'Y' ? '분양가상한제' : null,
  ].filter(Boolean) as string[];

  return (
    <div className="bg-slate-50 min-h-screen">
      <section className="bg-sale-900 text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <Link href="/presale" className="text-sm text-sale-100/70 hover:text-white">
            ← 분양정보
          </Link>

          <div className="flex flex-wrap items-center gap-2 mt-4">
            <StatusBadge status={p.status} />
            {left !== null && (
              <span className="text-sm font-bold text-sale-100">
                {left === 0 ? '오늘 마감' : `D-${left}`}
              </span>
            )}
            {p.houseType && (
              <span className="text-xs text-sale-100/60">{p.houseType}</span>
            )}
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mt-3">{p.houseNm}</h1>
          <p className="text-sale-100/80 mt-2">{p.addr ?? where}</p>

          {price && (
            <p className="mt-6">
              <span className="text-sm text-sale-100/70 mr-3">{priceLabel}</span>
              <span className="text-2xl sm:text-3xl font-bold tabular-nums">{price}</span>
            </p>
          )}
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">
        {flags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {flags.map((f) => (
              <span
                key={f}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-sale-50 text-sale-700"
              >
                {f}
              </span>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-3">청약 일정</h2>
            <dl>
              <Row label="모집공고일" value={p.noticeDate} />
              <Row label="특별공급" value={period(p.spsplyBgnde, p.spsplyEndde)} />
              <Row label="청약접수" value={period(p.rceptBgnde, p.rceptEndde)} />
              <Row label="당첨자발표" value={p.winnerDate} />
              <Row label="계약기간" value={period(p.contractBgnde, p.contractEndde)} />
              <Row label="입주예정" value={formatMoveIn(p.moveinYm)} />
            </dl>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-3">공급 정보</h2>
            <dl>
              <Row label="공급위치" value={p.addr} />
              <Row
                label="총 세대수"
                value={p.totalHouseholds ? `${p.totalHouseholds.toLocaleString()}세대` : null}
              />
              <Row label="주택구분" value={p.houseType} />
              <Row label="분양구분" value={p.rentType} />
              <Row label="시행사" value={p.developer} />
              <Row label="시공사" value={p.builder} />
              <Row label="문의처" value={p.tel} />
            </dl>

            {(p.homepage || p.pblancUrl) && (
              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100">
                {p.homepage && (
                  <a
                    href={p.homepage}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="text-sm font-semibold text-sale-700 hover:text-sale-600"
                  >
                    분양 홈페이지 ↗
                  </a>
                )}
                {p.pblancUrl && (
                  <a
                    href={p.pblancUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="text-sm font-semibold text-slate-500 hover:text-slate-700 ml-auto"
                  >
                    청약홈 공고 원문 ↗
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 주택형 — 분양의 핵심 정보. 없으면 섹션 자체를 띄우지 않는다. */}
        {p.types.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">주택형별 공급</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="text-left font-medium px-6 py-3">주택형</th>
                    <th className="text-right font-medium px-3 py-3">전용면적</th>
                    <th className="text-right font-medium px-3 py-3">일반</th>
                    <th className="text-right font-medium px-3 py-3">특별</th>
                    <th className="text-right font-medium px-6 py-3">{priceLabel}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {p.types.map((t) => (
                    <tr key={t.modelNo} className="hover:bg-slate-50">
                      <td className="px-6 py-3 font-medium text-slate-800">
                        {t.houseTy ?? t.modelNo}
                      </td>
                      <td className="px-3 py-3 text-right text-slate-600 tabular-nums">
                        {t.excluAr !== null ? (
                          <>
                            {t.excluAr.toFixed(2)}㎡
                            <span className="text-slate-400 text-xs ml-1">
                              {toPyeong(t.excluAr)}평
                            </span>
                          </>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-3 py-3 text-right text-slate-600 tabular-nums">
                        {t.generalHshldco?.toLocaleString() ?? '-'}
                      </td>
                      <td className="px-3 py-3 text-right text-slate-600 tabular-nums">
                        {t.specialHshldco?.toLocaleString() ?? '-'}
                      </td>
                      <td className="px-6 py-3 text-right font-bold text-sale-700 tabular-nums">
                        {t.topAmount !== null ? formatPrice(t.topAmount) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="px-6 py-3 text-xs text-slate-400 border-t border-slate-100">
              분양가는 해당 주택형의 공급금액(최고가) 기준입니다. 실제 금액은 층·향·옵션에
              따라 달라질 수 있습니다.
            </p>
          </div>
        )}

        {/* 같은 지역 실거래와 이어 준다 — 분양가가 비싼지 판단할 근거 */}
        {p.sido && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900">주변 시세와 비교</h2>
            <p className="text-sm text-slate-500 mt-1">
              같은 지역 아파트 실거래가를 보면 분양가 수준을 가늠할 수 있습니다.
            </p>
            <Link
              href={`/apt?sido=${encodeURIComponent(p.sido)}${p.sggCd ? `&sggCd=${p.sggCd}` : ''}`}
              className="inline-block mt-4 text-sm font-semibold text-brand-700 hover:text-brand-600"
            >
              {where} 실거래가 보기 →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
