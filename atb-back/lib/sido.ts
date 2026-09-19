// 시도명 유틸 — sgg_codes.sido_nm 은 정식명('서울특별시')이지만
// 프론트 지도(KoreaMap)는 단축명('서울')을 쓴다. 양방향 변환을 여기서 담당.

/** 정식 시도명 → 단축명. '서울특별시' → '서울', '충청북도' → '충북' */
export function toShortSido(full: string): string {
    const base = full
        .replace('특별자치도', '')
        .replace('특별자치시', '')
        .replace('광역시', '')
        .replace('특별시', '')
        .replace(/도$/, '');

    const overrides: Record<string, string> = {
        '충청북': '충북',
        '충청남': '충남',
        '전라북': '전북',
        '전라남': '전남',
        '경상북': '경북',
        '경상남': '경남',
        '강원특별자치': '강원',
        '전북특별자치': '전북',
    };
    return overrides[base] ?? base;
}

/** 단축명 → 정식 시도명 목록. DB 조회 필터용 (LIKE 대신 IN 을 쓰기 위함) */
const SHORT_TO_FULL: Record<string, string[]> = {
    '서울': ['서울특별시'],
    '부산': ['부산광역시'],
    '대구': ['대구광역시'],
    '인천': ['인천광역시'],
    '광주': ['광주광역시'],
    '대전': ['대전광역시'],
    '울산': ['울산광역시'],
    '세종': ['세종특별자치시'],
    '경기': ['경기도'],
    '충북': ['충청북도'],
    '충남': ['충청남도'],
    '전북': ['전북특별자치도', '전라북도'],
    '전남': ['전라남도'],
    '경북': ['경상북도'],
    '경남': ['경상남도'],
    '제주': ['제주특별자치도'],
    '강원': ['강원특별자치도', '강원도'],
};

export function toFullSido(short: string): string[] {
    return SHORT_TO_FULL[short] ?? [];
}
