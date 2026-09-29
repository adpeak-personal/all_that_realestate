import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import AptDetailView from './AptDetailView';
import { fetchAptDetail, fetchDeals, fetchPriceTrend, fetchSettings } from '../../../../service/server/api';
import { formatPrice } from '../../../../lib/format';
import type { DealListResult } from '../../../../service/main/type';
import JsonLd, { breadcrumb } from '../../../../components/JsonLd';

// 서버 컴포넌트. 데이터를 여기서 받아 뷰에 넘겨야 첫 HTML 에 내용이 담긴다.
// (같은 fetch 는 generateMetadata 와 페이지 사이에서 메모이즈되어 한 번만 나간다)

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const apt = await fetchAptDetail(Number(id));

  if (!apt) {
    return { title: '단지를 찾을 수 없습니다' };
  }

  // 같은 fetch 는 페이지 렌더와 공유되므로 호출이 한 번 더 나가지 않는다
  const deals = await fetchDeals({ aptId: Number(id), page: 1, size: 1 });

  const where = `${apt.sido} ${apt.sgg} ${apt.umdNm}`;

  // 설명에는 이 페이지에 실제로 있는 것만 적는다. 없는 기능(매물·전월세 등)을 적으면
  // 검색으로 들어온 사람이 곧바로 나가고, 그 이탈이 순위에도 불리하게 돌아온다.
  const has: string[] = ['시세 추이', '면적별 시세'];
  if (apt.kapt?.subwayStation) has.push('지하철');
  if (apt.kapt?.educationFacility) has.push('학군');
  if (apt.kapt?.convenientFacility || apt.kapt?.welfareFacility) has.push('편의시설');
  if (apt.lat != null) has.push('지도·거리뷰');

  const facts: string[] = [];
  if (apt.kapt?.totalHouseholds) facts.push(`${apt.kapt.totalHouseholds.toLocaleString()}세대`);
  if (apt.kapt?.useAprDate) facts.push(`${apt.kapt.useAprDate.slice(0, 4)}년 준공`);
  // 최근 거래가는 클릭을 부르는 정보라 설명 앞쪽에 둔다
  const recent = latestLine(deals);

  // 어드민에서 직접 쓴 값이 있으면 그것이 우선이다(검색 결과 문구를 손으로 다듬는 용도).
  const autoTitle = `${apt.aptNm} 실거래가·시세·주변정보 | ${where}`;
  const autoDesc =
    `${where} ${apt.aptNm}의 국토교통부 실거래가, ${has.join(', ')} 정보. ` +
    (recent ? `${recent}. ` : '') +
    (facts.length ? `${facts.join(' · ')}.` : '');

  return {
    title: apt.seoTitle ?? autoTitle,
    description: apt.seoDescription ?? autoDesc,
    alternates: { canonical: `/apt/${apt.id}` },
    openGraph: {
      title: `${apt.aptNm} 실거래가`,
      description: [where, ...facts, recent].filter(Boolean).join(' · '),
      type: 'website',
    },
  };
}

/** '최근 거래 11억 8,000만(84.70㎡, 2026.07)' 형태. 거래가 없으면 null. */
function latestLine(deals: DealListResult | null): string | null {
  const d = deals?.items[0];
  if (!d) return null;
  const ym = d.dealDate?.slice(0, 7).replace('-', '.') ?? '';
  return `최근 거래 ${formatPrice(d.dealAmount)}(${d.excluUseAr.toFixed(2)}㎡${ym ? `, ${ym}` : ''})`;
}

export default async function AptDetailPage({ params }: Props) {
  const { id } = await params;
  const aptId = Number(id);

  if (!Number.isInteger(aptId) || aptId <= 0) notFound();

  const apt = await fetchAptDetail(aptId);
  if (!apt) notFound();

  // 차트·거래이력은 없어도 페이지는 떠야 하므로 실패를 삼킨다(내부에서 null 반환).
  const [trend, deals, settings] = await Promise.all([
    fetchPriceTrend({ aptId, months: 12 }),
    fetchDeals({ aptId, page: 1, size: 20 }),
    fetchSettings(),
  ]);

  const latest = deals?.items[0];

  return (
    <>
      <JsonLd
        data={breadcrumb([
          { name: '홈', path: '/' },
          { name: '단지 찾기', path: '/apt' },
          { name: `${apt.sido} ${apt.sgg}`, path: `/apt?sido=${encodeURIComponent(apt.sido)}` },
          { name: apt.aptNm, path: `/apt/${apt.id}` },
        ])}
      />
      {/*
        구조화 데이터 — 검색엔진이 '이 페이지가 무엇인지' 읽는 경로.
        가격은 실제 최신 거래가를 그대로 쓴다(추정치를 넣지 않는다).
      */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'ApartmentComplex',
            name: apt.aptNm,
            address: {
              '@type': 'PostalAddress',
              addressCountry: 'KR',
              addressRegion: apt.sido,
              addressLocality: apt.sgg,
              streetAddress: apt.kapt?.addrRoad ?? `${apt.umdNm} ${apt.jibun ?? ''}`.trim(),
            },
            ...(apt.kapt?.totalHouseholds
              ? { numberOfAccommodationUnits: apt.kapt.totalHouseholds }
              : {}),
            ...(apt.kapt?.useAprDate ? { yearBuilt: Number(apt.kapt.useAprDate.slice(0, 4)) } : {}),
            ...(latest
              ? {
                  description:
                    `최근 실거래 ${latest.dealDate} · ` +
                    `${latest.excluUseAr.toFixed(2)}㎡ ${formatPrice(latest.dealAmount)}`,
                }
              : {}),
          }),
        }}
      />

      <AptDetailView
        aptId={aptId}
        initialDetail={apt}
        initialTrend={trend ?? undefined}
        initialDeals={deals ?? undefined}
        mapEnabled={settings.mapEnabled}
      />
    </>
  );
}
