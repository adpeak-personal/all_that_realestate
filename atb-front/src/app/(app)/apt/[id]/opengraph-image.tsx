import { ImageResponse } from 'next/og';
import { fetchAptDetail, fetchDeals } from '../../../../service/server/api';
import { loadKoreanFont } from '../../../../lib/og-font';
import { formatPrice, toPyeong } from '../../../../lib/format';

export const alt = '단지 실거래가 요약';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const BRAND = '#056B5E';
const INK = '#0f172a';
const MUTED = '#64748b';
const LINE = '#e2e8f0';

interface Props {
  // 페이지와 마찬가지로 params 는 Promise 다
  params: Promise<{ id: string }>;
}

function StatTile({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8fafc',
        borderRadius: 20,
        padding: '16px 28px',
        minWidth: 170,
      }}
    >
      <div style={{ fontSize: 20, color: MUTED }}>{label}</div>
      <div style={{ fontSize: 44, fontWeight: 700, color: INK, marginTop: 2 }}>{value}</div>
      <div style={{ fontSize: 18, color: '#94a3b8' }}>{unit}</div>
    </div>
  );
}

export default async function Image({ params }: Props) {
  const { id } = await params;
  const aptId = Number(id);
  const apt = await fetchAptDetail(aptId);

  // 단지가 없으면 이미지도 만들지 않는다 (page.tsx 가 404 를 낸다)
  if (!apt) return new Response('Not found', { status: 404 });

  const deals = await fetchDeals({ aptId, page: 1, size: 1 });
  const latest = deals?.items[0] ?? null;

  const where = `${apt.sido} ${apt.sgg} ${apt.umdNm}`;
  const households = apt.kapt?.totalHouseholds;
  const year = apt.kapt?.useAprDate?.slice(0, 4) ?? (apt.buildYear ? String(apt.buildYear) : null);
  const floors = apt.kapt?.topFloor;

  const priceText = latest ? formatPrice(latest.dealAmount) : null;
  const dealSub = latest
    ? `${latest.excluUseAr.toFixed(2)}㎡ · ${toPyeong(latest.excluUseAr)}평` +
      `${latest.floor !== null ? ` · ${latest.floor}층` : ''} · ${latest.dealDate.replace(/-/g, '.')}`
    : null;

  // 단지명이 길면 크기를 줄인다 (익산배산사랑으로부영1차 같은 이름이 실제로 있다)
  const nameSize = apt.aptNm.length > 16 ? 42 : apt.aptNm.length > 11 ? 52 : 64;

  // 서브셋 요청에 쓸 글자 모음 — 이미지에 실제로 찍히는 문자 전부
  const allText = [
    '올댓부동산',
    apt.aptNm,
    where,
    '세대 준공 최고층 년 층 최근 실거래 정보 없음',
    households ? households.toLocaleString() : '',
    year ?? '',
    floors ? String(floors) : '',
    priceText ?? '',
    dealSub ?? '',
  ].join(' ');

  const [bold, regular] = await Promise.all([
    loadKoreanFont(allText, 700),
    loadKoreanFont(allText, 400),
  ]);

  // 한글 폰트를 못 받으면 글자가 네모로 깨진다. 그럴 바엔 이미지를 내보내지 않는다.
  if (!bold || !regular) return new Response('Font unavailable', { status: 500 });

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#ffffff',
          padding: '52px 64px',
          fontFamily: 'Noto Sans KR',
        }}
      >
        {/* 브랜드 */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ width: 8, height: 34, backgroundColor: BRAND, borderRadius: 4 }} />
          <div style={{ fontSize: 30, fontWeight: 700, color: BRAND, marginLeft: 14 }}>
            올댓부동산
          </div>
        </div>

        {/* 단지명 + 위치 */}
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 30 }}>
          <div style={{ fontSize: nameSize, fontWeight: 700, color: INK, lineHeight: 1.15 }}>
            {apt.aptNm}
          </div>
          <div style={{ fontSize: 27, color: MUTED, marginTop: 10 }}>{where}</div>
        </div>

        {/* 단지 지표 */}
        <div style={{ display: 'flex', marginTop: 30 }}>
          {households ? (
            <div style={{ display: 'flex', marginRight: 18 }}>
              <StatTile label="세대수" value={households.toLocaleString()} unit="세대" />
            </div>
          ) : null}
          {year ? (
            <div style={{ display: 'flex', marginRight: 18 }}>
              <StatTile label="준공" value={year} unit="년" />
            </div>
          ) : null}
          {floors ? (
            <div style={{ display: 'flex' }}>
              <StatTile label="최고층" value={String(floors)} unit="층" />
            </div>
          ) : null}
        </div>

        {/* 남는 세로 공간을 밀어내는 spacer.
            Satori 는 marginTop:'auto' 를 제대로 처리하지 못해 내용이 넘친다. */}
        <div style={{ display: 'flex', flexGrow: 1 }} />

        {/* 최근 실거래 — 이 이미지의 주인공 */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            borderTop: `2px solid ${LINE}`,
            paddingTop: 24,
          }}
        >
          {priceText ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'baseline' }}>
                <div style={{ fontSize: 24, color: MUTED, marginRight: 16 }}>최근 실거래</div>
                <div style={{ fontSize: 58, fontWeight: 700, color: BRAND }}>{priceText}</div>
              </div>
              <div style={{ fontSize: 24, color: MUTED, marginTop: 6 }}>{dealSub}</div>
            </div>
          ) : (
            <div style={{ fontSize: 28, color: MUTED }}>실거래 정보 없음</div>
          )}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Noto Sans KR', data: bold, style: 'normal', weight: 700 },
        { name: 'Noto Sans KR', data: regular, style: 'normal', weight: 400 },
      ],
    },
  );
}
