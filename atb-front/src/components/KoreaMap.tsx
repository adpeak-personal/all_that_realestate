'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson';

interface KoreaMapProps {
    onSelect?: (regionName: string | null) => void;
    selected?: string | null;
    selectedColor?: string;
    showLabels?: boolean;
    height?: number;
    paddingX?: number;
    paddingY?: number;
}

const GEO_SOURCES = [
    'https://cdn.jsdelivr.net/gh/southkorea/southkorea-maps@master/kostat/2018/json/skorea-provinces-2018-geo.json',
    'https://cdn.jsdelivr.net/gh/southkorea/southkorea-maps@master/kostat/2013/json/skorea_provinces_geo_simple.json',
];

// 지역명 단축 변환 (shortName 이후 추가 치환)
const NAME_OVERRIDE: Record<string, string> = {
    '충청북': '충북',
    '충청남': '충남',
    '전라북': '전북',
    '전라남': '전남',
    '경상북': '경북',
    '경상남': '경남',
    '강원특별자치': '강원',
    '전북특별자치': '전북',
};

// 제주도를 본토 가까이 끌어올리는 오프셋 (px, 음수 = 위쪽)
const JEJU_OFFSET_Y = -50;

function isJeju(feature: Feature): boolean {
    return getRegionName(feature).includes('제주');
}

// 라벨 위치 미세 조정 오프셋 [dx, dy] (px 단위)
const LABEL_OFFSETS: Record<string, [number, number]> = {
    '서울': [0, 2],
    '인천': [0, 4],
    '경기': [18, 6],
    '세종': [0, 0],
    '대전': [0, 2],
    '충북': [-10, -4],
    '충남': [-6, 0],
    '전북': [0, 0],
    '전남': [0, 6],
    '경북': [0, -4],
    '대구': [3, 0],
    '경남': [0, 4],
    '강원': [0, 0],
    '제주': [0, 0],
};

// 라벨 폰트 크기 (지역별 개별 지정 가능, 기본값 12)
const LABEL_SIZES: Record<string, number> = {
    '인천': 8,
    '서울': 8,
    '세종': 8,
    '대전': 8,
    '광주': 8,
    '대구': 8,
    '울산': 10,
    '부산': 8,
};

function getRegionName(feature: Feature): string {
    const p = (feature.properties || {}) as Record<string, string>;
    return p.name || p.NAME_1 || p.CTP_KOR_NM || p.ctp_kor_nm || 'Unknown';
}

function shortName(name: string): string {
    const n = name
        .replace('특별자치도', '')
        .replace('특별자치시', '')
        .replace('광역시', '')
        .replace('특별시', '')
        .replace(/도$/, '');
    return NAME_OVERRIDE[n] ?? n;
}

// MultiPolygon에서 가장 큰 polygon만 남겨 작은 섬 제거
function keepLargestPolygon(feature: Feature): Feature {
    if (feature.geometry.type !== 'MultiPolygon') return feature;

    const geo = feature.geometry as MultiPolygon;
    const largest = geo.coordinates.reduce((best, polygon) => {
        const a: Feature = { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: best } as Polygon };
        const b: Feature = { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: polygon } as Polygon };
        return d3.geoArea(b) > d3.geoArea(a) ? polygon : best;
    });

    return {
        ...feature,
        geometry: { type: 'MultiPolygon', coordinates: [largest] } as MultiPolygon,
    };
}

async function loadGeoJson(): Promise<FeatureCollection> {
    for (const url of GEO_SOURCES) {
        try {
            const res = await fetch(url);
            if (res.ok) return await res.json();
        } catch {
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
    paddingX = 20,
    paddingY = 20,
}: KoreaMapProps) {
    const svgRef = useRef<SVGSVGElement>(null);
    const [internalSelected, setInternalSelected] = useState<string | null>(null);
    const [geoData, setGeoData] = useState<FeatureCollection | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [viewBox, setViewBox] = useState(`0 0 500 ${height}`);

    const isControlled = controlledSelected !== undefined;
    const selected = isControlled ? controlledSelected : internalSelected;

    useEffect(() => {
        loadGeoJson()
            .then((data) => {
                const cleaned: FeatureCollection = {
                    ...data,
                    features: data.features.map(keepLargestPolygon),
                };
                setGeoData(cleaned);
            })
            .catch((err: Error) => setError(err.message));
    }, []);

    useEffect(() => {
        if (!geoData || !svgRef.current) return;

        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        const width = 500;
        const h = height;

        const projection = d3.geoMercator().fitSize([width, h - 20], geoData);
        const pathGen = d3.geoPath().projection(projection);

        const g = svg.append('g');

        g.selectAll('path.region')
            .data(geoData.features)
            .enter()
            .append('path')
            .attr('class', 'region')
            .attr('d', (d) => pathGen(d))
            .attr('data-name', (d) => getRegionName(d))
            .attr('transform', (d) => isJeju(d) ? `translate(0,${JEJU_OFFSET_Y})` : null)
            .on('click', function (_event, d) {
                const name = getRegionName(d);
                const next = selected === name ? null : name;
                if (!isControlled) setInternalSelected(next);
                onSelect?.(next);
            });

        if (showLabels) {
            g.selectAll('text.region-label')
                .data(geoData.features)
                .enter()
                .append('text')
                .attr('class', 'region-label')
                .attr('transform', (d) => {
                    const c = pathGen.centroid(d);
                    const label = shortName(getRegionName(d));
                    const [dx, dy] = LABEL_OFFSETS[label] ?? [0, 0];
                    const jejuDY = isJeju(d) ? JEJU_OFFSET_Y : 0;
                    return `translate(${c[0] + dx},${c[1] + dy + jejuDY})`;
                })
                .attr('font-size', (d) => {
                    const label = shortName(getRegionName(d));
                    return LABEL_SIZES[label] ?? 12;
                })
                .text((d) => shortName(getRegionName(d)));
        }

        // 실제 렌더링된 콘텐츠 영역으로 viewBox 업데이트 (Jeju transform 포함)
        const gEl = g.node();
        if (gEl) {
            const bbox = gEl.getBBox();
            setViewBox(`${bbox.x - paddingX} ${bbox.y - paddingY} ${bbox.width + paddingX * 2} ${bbox.height + paddingY * 2}`);
        }
    }, [geoData, height, showLabels, isControlled, onSelect, selected]);

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
        return <div style={{ padding: 24, color: '#999', fontSize: 14 }}>{error}</div>;
    }

    return (
        <div className="korea-map-wrapper">
            <svg
                ref={svgRef}
                viewBox={viewBox}
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
          font-weight: 500;
          fill: #444;
          text-anchor: middle;
          dominant-baseline: middle;
          pointer-events: none;
          user-select: none;
        }
      `}</style>
        </div>
    );
}
