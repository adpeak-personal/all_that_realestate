import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import AptDetailView from './AptDetailView';
import { fetchAptDetail, fetchDeals, fetchPriceTrend } from '../../../../service/server/api';
import { formatPrice } from '../../../../lib/format';

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

  const where = `${apt.sido} ${apt.sgg} ${apt.umdNm}`;
  const bits = [where];
  if (apt.kapt?.totalHouseholds) bits.push(`${apt.kapt.totalHouseholds.toLocaleString()}세대`);
  if (apt.kapt?.useAprDate) bits.push(`${apt.kapt.useAprDate.slice(0, 4)}년 준공`);

  return {
    title: `${apt.aptNm} 실거래가 · ${where}`,
    description:
      `${where} ${apt.aptNm}의 국토교통부 아파트 매매 실거래가와 ` +
      `㎡당 단가 추이입니다. ${bits.join(' · ')}.`,
    alternates: { canonical: `/apt/${apt.id}` },
    openGraph: {
      title: `${apt.aptNm} 실거래가`,
      description: `${where} · ${bits.slice(1).join(' · ')}`,
      type: 'website',
    },
  };
}

export default async function AptDetailPage({ params }: Props) {
  const { id } = await params;
  const aptId = Number(id);

  if (!Number.isInteger(aptId) || aptId <= 0) notFound();

  const apt = await fetchAptDetail(aptId);
  if (!apt) notFound();

  // 차트·거래이력은 없어도 페이지는 떠야 하므로 실패를 삼킨다(내부에서 null 반환).
  const [trend, deals] = await Promise.all([
    fetchPriceTrend({ aptId, months: 12 }),
    fetchDeals({ aptId, page: 1, size: 20 }),
  ]);

  const latest = deals?.items[0];

  return (
    <>
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
      />
    </>
  );
}
