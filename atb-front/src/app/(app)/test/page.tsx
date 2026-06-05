'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import type { Feature, FeatureCollection } from 'geojson';

interface KoreaMapProps {
    /** 선택 시 콜백 (선택 해제 시 null) */
    onSelect?: (regionName: string | null) => void;
    /** 외부에서 선택값을 제어하고 싶을 때 (controlled) */
    selected?: string | null;
    /** 선택된 지역의 색상 */
    selectedColor?: string;
    /** 라벨 표시 여부 */
    showLabels?: boolean;
    /** 컨테이너 높이 (px) */
    height?: number;
}

// GeoJSON 소스 (CDN, fallback 포함)
const GEO_SOURCES = [
    'https://cdn.jsdelivr.net/gh/southkorea/southkorea-maps@master/kostat/2018/json/skorea-provinces-2018-geo.json',
    'https://cdn.jsdelivr.net/gh/southkorea/southkorea-maps@master/kostat/2013/json/skorea_provinces_geo_simple.json',
];

function getRegionName(feature: Feature): string {
    const p = (feature.properties || {}) as Record<string, any>;
    return p.name || p.NAME_1 || p.CTP_KOR_NM || p.ctp_kor_nm || 'Unknown';
}

function shortName(name: string): string {
    return name
        .replace('특별자치도', '')
        .replace('특별자치시', '')
        .replace('광역시', '')
        .replace('특별시', '')
        .replace(/도$/, '');
}

async function loadGeoJson(): Promise<FeatureCollection> {
    for (const url of GEO_SOURCES) {
        try {
            const res = await fetch(url);
            if (res.ok) return await res.json();
        } catch (e) {
            // 다음 소스 시도
        }
    }
    throw new Error('GeoJSON 데이터를 불러올 수 없습니다.');
}

export default function KoreaMap({
    onSelect,
    selected: controlledSelected,
    selectedColor = '#378ADD',
    showLabels = true,
    height = 560,
}: KoreaMapProps) {
    const svgRef = useRef<SVGSVGElement>(null);
    const [internalSelected, setInternalSelected] = useState<string | null>(null);
    const [geoData, setGeoData] = useState<FeatureCollection | null>(null);
    const [error, setError] = useState<string | null>(null);

    // controlled / uncontrolled 모드 모두 지원
    const isControlled = controlledSelected !== undefined;
    const selected = isControlled ? controlledSelected : internalSelected;

    // GeoJSON 로드
    useEffect(() => {
        loadGeoJson()
            .then(setGeoData)
            .catch((err) => setError(err.message));
    }, []);

    // 지도 렌더링
    useEffect(() => {
        if (!geoData || !svgRef.current) return;

        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        const width = 500;
        const h = height;

        const projection = d3.geoMercator().fitSize([width, h - 20], geoData);
        const pathGen = d3.geoPath().projection(projection);

        const g = svg.append('g');

        // 지역 path 그리기
        g.selectAll('path.region')
            .data(geoData.features)
            .enter()
            .append('path')
            .attr('class', 'region')
            .attr('d', pathGen as any)
            .attr('data-name', (d) => getRegionName(d))
            .on('click', function (_event, d) {
                const name = getRegionName(d);
                const next = selected === name ? null : name;

                if (!isControlled) setInternalSelected(next);
                onSelect?.(next);
            });

        // 라벨
        if (showLabels) {
            g.selectAll('text.region-label')
                .data(geoData.features)
                .enter()
                .append('text')
                .attr('class', 'region-label')
                .attr('transform', (d) => {
                    const c = pathGen.centroid(d);
                    return `translate(${c[0]},${c[1]})`;
                })
                .text((d) => shortName(getRegionName(d)));
        }
    }, [geoData, height, showLabels, isControlled, onSelect, selected]);

    // 선택 상태가 변경되면 스타일만 업데이트 (전체 재렌더 X)
    useEffect(() => {
        if (!svgRef.current) return;
        const svg = d3.select(svgRef.current);
        svg
            .selectAll<SVGPathElement, Feature>('path.region')
            .style('fill', function () {
                const name = this.getAttribute('data-name');
                return name === selected ? selectedColor : null;
            });
    }, [selected, selectedColor]);

    if (error) {
        return (
            <div style={{ padding: 24, color: '#999', fontSize: 14 }}>
                {error}
            </div>
        );
    }

    return (
        <div className="korea-map-wrapper">
            <svg
                ref={svgRef}
                viewBox={`0 0 500 ${height}`}
                xmlns="http://www.w3.org/2000/svg"
                role="img"
                aria-label="대한민국 행정구역 지도"
                style={{ width: '100%', height: 'auto', display: 'block' }}
            />

            <style jsx>{`
        .korea-map-wrapper {
          width: 100%;
        }
        .korea-map-wrapper :global(path.region) {
          fill: #ffffff;
          stroke: #d0d0d0;
          stroke-width: 0.5;
          stroke-linejoin: round;
          cursor: pointer;
          transition: fill 0.15s ease;
        }
        .korea-map-wrapper :global(path.region:hover) {
          fill: #e8f1fb;
        }
        .korea-map-wrapper :global(text.region-label) {
          font-family: inherit;
          font-size: 11px;
          fill: #555;
          text-anchor: middle;
          pointer-events: none;
          user-select: none;
        }
      `}</style>
        </div>
    );
}
