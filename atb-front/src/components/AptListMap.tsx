'use client';

import { useEffect, useRef, useState } from 'react';
import { loadNaverMaps, NAVER_MAP_KEY_ID } from '../lib/naver-maps';

/**
 * 단지 목록 지도. 현재 페이지에 실린 단지들만 핀으로 찍는다.
 *
 * 핀 번호는 목록의 순번과 같다 — 목록에서 3번을 보다가 지도에서 3번을 찾을 수 있어야
 * 두 화면이 하나로 읽힌다. 핀을 누르면 그 단지 상세로 간다.
 *
 * 좌표가 없는 단지(주소로 못 찾은 150여 곳)는 지도에서 빠지고, 몇 개가 빠졌는지
 * 아래에 적는다. 말없이 빠지면 "목록엔 30개인데 핀은 28개" 가 버그처럼 보인다.
 */
export interface MapPin {
  id: number;
  aptNm: string;
  lat: number | null;
  lng: number | null;
}

export default function AptListMap({
  items,
  startIndex = 0,
}: {
  items: MapPin[];
  /** 첫 핀에 붙일 번호 - 1 (페이지 2면 30) */
  startIndex?: number;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  const withCoord = items.filter((i) => i.lat != null && i.lng != null);
  const missing = items.length - withCoord.length;

  useEffect(() => {
    if (!NAVER_MAP_KEY_ID || withCoord.length === 0) return;
    let cancelled = false;
    const cleanups: Array<() => void> = [];

    loadNaverMaps()
      .then(() => {
        if (cancelled || !boxRef.current || !window.naver?.maps) return;
        const { maps } = window.naver;

        const first = withCoord[0];
        const map = new maps.Map(boxRef.current, {
          center: new maps.LatLng(first.lat as number, first.lng as number),
          zoom: 14,
          scrollWheel: false,
        }) as { fitBounds: (b: unknown) => void };

        const bounds = new maps.LatLngBounds();
        withCoord.forEach((item, i) => {
          const pos = new maps.LatLng(item.lat as number, item.lng as number);
          (bounds as { extend: (p: unknown) => void }).extend(pos);

          const n = startIndex + items.indexOf(item) + 1;
          // 핀을 <a> 로 둔다. 네이버 마커의 click 이벤트에 기대면 지도가 드래그·확대
          // 제스처로 삼켜 버리는 경우가 있고, 링크여야 새 탭 열기도 된다.
          new maps.Marker({
            position: pos,
            map,
            title: item.aptNm,
            icon: {
              content:
                `<a href="/apt/${item.id}" title="${item.aptNm.replace(/"/g, '&quot;')}" ` +
                `style="display:flex;align-items:center;justify-content:center;` +
                `width:28px;height:28px;border-radius:9999px;background:#00897B;color:#fff;` +
                `font:700 12px/1 system-ui,sans-serif;border:2px solid #fff;text-decoration:none;` +
                `box-shadow:0 1px 4px rgba(0,0,0,.35)">${n}</a>`,
              anchor: new maps.Point(14, 14),
            },
          });
          void i;
        });

        // 핀이 하나면 fitBounds 가 과하게 확대된다
        if (withCoord.length > 1) map.fitBounds(bounds);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });

    return () => {
      cancelled = true;
      cleanups.forEach((fn) => fn());
    };
    // items 는 페이지가 바뀔 때만 갈린다. 배열 자체를 의존성으로 두면 매 렌더 재생성된다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.map((i) => i.id).join(','), startIndex]);

  if (!NAVER_MAP_KEY_ID || withCoord.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden mb-6">
      <div className="h-[300px] sm:h-[380px] relative">
        <div className="absolute inset-0">
          <div ref={boxRef} className="h-full w-full" />
        </div>
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-50 text-sm text-slate-400">
            {error}
          </div>
        )}
      </div>
      <p className="px-4 py-2.5 text-xs text-slate-400 border-t border-slate-100">
        이 페이지의 단지 {withCoord.length}곳을 지도에 표시했습니다. 핀을 누르면 단지 상세로 갑니다.
        {missing > 0 && ` 좌표가 없는 ${missing}곳은 제외했습니다.`}
      </p>
    </div>
  );
}
