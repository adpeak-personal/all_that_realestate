import { ImageResponse } from 'next/og';
import { fetchRegionStats } from '../service/server/api';
import { loadKoreanFont } from '../lib/og-font';
import { formatYearMonth } from '../lib/format';

// 사이트 기본 OG 이미지. 자기 opengraph-image 가 없는 라우트가 이걸 물려받는다
// (/apt/[id] 는 단지별 이미지를 따로 갖는다).

export const alt = '올댓부동산 - 전국 아파트 실거래가';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const BRAND = '#056B5E';
const INK = '#0f172a';
const MUTED = '#64748b';

export default async function Image() {
  const stats = await fetchRegionStats();
  const month = formatYearMonth(stats?.baseMonth ?? null);
  const items = stats?.items ?? [];
  const trades = items.reduce((sum, s) => sum + s.trades, 0);

  // 기준월은 거래 건수에만 의미가 있다 (수집 지역 수에 붙이면 어색하다)
  const tiles: Array<{ label: string; value: string; unit: string }> = [];
  if (trades > 0) {
    tiles.push({
      label: month ? `${month} 거래` : '이달 거래',
      value: trades.toLocaleString(),
      unit: '건',
    });
  }
  if (items.length > 0) {
    tiles.push({ label: '수집 지역', value: String(items.length), unit: '개 시도' });
  }

  const allText = [
    '올댓부동산',
    '전국 아파트 실거래가',
    '국토교통부 실거래 데이터로 보는 지역별 시세와 단가 추이',
    '이달 거래 건 수집 지역 개 시도 기준 년 월',
    month ?? '',
    ...tiles.map((t) => `${t.label}${t.value}${t.unit}`),
  ].join(' ');

  const [bold, regular] = await Promise.all([
    loadKoreanFont(allText, 700),
    loadKoreanFont(allText, 400),
  ]);
  if (!bold || !regular) return new Response('Font unavailable', { status: 500 });

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          backgroundColor: '#ffffff',
          padding: '52px 64px',
          fontFamily: 'Noto Sans KR',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ width: 10, height: 44, backgroundColor: BRAND, borderRadius: 5 }} />
          <div style={{ fontSize: 40, fontWeight: 700, color: BRAND, marginLeft: 16 }}>
            올댓부동산
          </div>
        </div>

        <div style={{ fontSize: 76, fontWeight: 700, color: INK, marginTop: 28 }}>
          전국 아파트 실거래가
        </div>

        <div style={{ fontSize: 30, color: MUTED, marginTop: 16 }}>
          국토교통부 실거래 데이터로 보는 지역별 시세와 단가 추이
        </div>

        {tiles.length > 0 && (
          <div style={{ display: 'flex', marginTop: 44 }}>
            {tiles.map((t, i) => (
              <div
                key={t.label}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  backgroundColor: '#f8fafc',
                  borderRadius: 20,
                  padding: '20px 34px',
                  marginRight: i === tiles.length - 1 ? 0 : 18,
                }}
              >
                {/* Satori 는 자식이 둘 이상이면 display:flex 를 요구한다 */}
                <div style={{ fontSize: 22, color: MUTED }}>{t.label}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', marginTop: 4 }}>
                  <div style={{ fontSize: 46, fontWeight: 700, color: INK }}>{t.value}</div>
                  <div style={{ fontSize: 22, color: '#94a3b8', marginLeft: 8 }}>{t.unit}</div>
                </div>
              </div>
            ))}
          </div>
        )}
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
