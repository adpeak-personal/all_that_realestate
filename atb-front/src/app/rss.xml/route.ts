import { fetchPresales } from '../../service/server/api';
import { presalePriceLabel } from '../../lib/format';
import { siteUrl } from '../../lib/site-url';

/**
 * 분양 공고 RSS.
 *
 * 사이트맵이 '이 사이트에 어떤 페이지가 있다' 라면 RSS 는 '방금 새 글이 올라왔다'
 * 를 알린다. 네이버 서치어드바이저는 사이트맵과 별개로 RSS 를 받고, 새 페이지
 * 색인이 그만큼 빨라진다.
 *
 * 매일 새로 생기는 페이지는 분양 공고뿐이다 — 실거래는 기존 단지 페이지의 내용이
 * 갱신될 뿐 새 주소가 생기지 않으므로 넣지 않는다.
 */
export const revalidate = 3600;

/** XML 안에서 깨지면 안 되는 문자들. 단지명에 &, < 가 실제로 들어온다. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function rfc822(date: string | null): string {
  const d = date ? new Date(date) : new Date();
  return (Number.isNaN(d.getTime()) ? new Date() : d).toUTCString();
}

export async function GET() {
  const base = siteUrl();
  // 공고일 최신순 40건. 읽는 쪽이 매번 전부 받아가므로 길게 둘 이유가 없다.
  const data = await fetchPresales({ size: 40, sort: 'notice' });
  const items = data?.items ?? [];

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n` +
    `<channel>\n` +
    `  <title>올댓부동산 분양정보</title>\n` +
    `  <link>${base}/presale</link>\n` +
    `  <description>전국 아파트·오피스텔 분양 공고. 청약 접수 일정과 분양가.</description>\n` +
    `  <language>ko</language>\n` +
    `  <lastBuildDate>${rfc822(null)}</lastBuildDate>\n` +
    `  <atom:link href="${base}/rss.xml" rel="self" type="application/rss+xml" />\n` +
    items
      .map((it) => {
        const where = [it.sido, it.sgg].filter(Boolean).join(' ');
        const label = presalePriceLabel(it.houseType);
        const bits = [
          where,
          it.totalHouseholds ? `${it.totalHouseholds.toLocaleString()}세대` : null,
          it.rceptBgnde ? `청약접수 ${it.rceptBgnde}` : null,
          it.minAmount ? `${label} ${Math.round(it.minAmount / 10000)}억~` : null,
        ].filter(Boolean);
        const url = `${base}/presale/${it.id}`;
        return (
          `  <item>\n` +
          `    <title>${esc(it.houseNm)}</title>\n` +
          `    <link>${url}</link>\n` +
          `    <guid isPermaLink="true">${url}</guid>\n` +
          `    <pubDate>${rfc822(it.noticeDate)}</pubDate>\n` +
          `    <description>${esc(bits.join(' · '))}</description>\n` +
          `  </item>`
        );
      })
      .join('\n') +
    `\n</channel>\n</rss>\n`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
