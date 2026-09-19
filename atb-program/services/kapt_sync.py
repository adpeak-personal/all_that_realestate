"""K-apt 단지 마스터 동기화 워커.

시군구 단위로 K-apt(공동주택) 단지 목록 → 기본정보 → 상세정보를 받아
kapt_complexes 테이블 1행으로 조립·저장한다. 매칭(services/apt_match_run.py)의
선행 단계 — 이 테이블이 매칭용 마스터이자 단지 부가정보 저장소를 겸한다.

DB 없이도 레코드 조립을 검증할 수 있게 build_complex_record() 는 순수 함수다.
"""
from __future__ import annotations

from services import kapt_api
from services.apt_matcher import parse_addr_jibun


# ─── 파싱 헬퍼 ────────────────────────────────────────────────────────────────
def _to_int(v):
    try:
        return int(float(str(v).replace(",", "").strip()))
    except (ValueError, TypeError):
        return None


def _to_float(v):
    try:
        return float(str(v).replace(",", "").strip())
    except (ValueError, TypeError):
        return None


def _to_date(v):
    """'20050817' → '2005-08-17'. 형식 어긋나면 None."""
    s = (str(v) if v is not None else "").strip()
    if len(s) == 8 and s.isdigit():
        return f"{s[0:4]}-{s[4:6]}-{s[6:8]}"
    return None


def _clean(v):
    """빈 문자열/공백만 → None."""
    if v is None:
        return None
    s = str(v).strip()
    return s or None


# ─── 레코드 조립 (순수) ───────────────────────────────────────────────────────
def build_complex_record(item: kapt_api.KaptListItem, bass: dict, dtl: dict) -> dict:
    """목록+기본+상세 dict → kapt_complexes 행 dict."""
    addr = _clean(bass.get("kaptAddr")) or ""
    jb = parse_addr_jibun(addr)
    jibun = jb[1] if jb else None

    parking = None
    p_ground, p_under = _to_int(dtl.get("kaptdPcnt")), _to_int(dtl.get("kaptdPcntu"))
    if p_ground is not None or p_under is not None:
        parking = (p_ground or 0) + (p_under or 0)

    sgg_cd = None
    bjd = _clean(item.bjdCode) or _clean(bass.get("bjdCode"))
    if bjd and len(bjd) >= 5 and bjd[:5].isdigit():
        sgg_cd = int(bjd[:5])

    return {
        "kapt_code": item.kaptCode,
        "kapt_name": item.kaptName or _clean(bass.get("kaptName")) or "",
        "sgg_cd": sgg_cd,
        "sido_nm": item.sido or None,
        "sgg_nm": item.sgg or None,
        "umd_nm": item.umd or None,
        "bjd_code": bjd,
        "addr_jibun": addr or None,
        "addr_road": _clean(bass.get("doroJuso")),
        "jibun": jibun,
        # kaptdaCnt 가 0/빈값이면(신축 등 미기재) hoCnt 로 폴백
        "total_households": _to_int(bass.get("kaptdaCnt")) or _to_int(bass.get("hoCnt")),
        "dong_cnt": _to_int(bass.get("kaptDongCnt")),
        "top_floor": _to_int(bass.get("kaptTopFloor")),
        "use_apr_date": _to_date(bass.get("kaptUsedate")),
        "heat_type": _clean(bass.get("codeHeatNm")),
        "hall_type": _clean(bass.get("codeHallNm")),
        "sale_type": _clean(bass.get("codeSaleNm")),
        "builder": _clean(bass.get("kaptBcompany")),
        "total_area": _to_float(bass.get("kaptTarea")),
        "parking_total": parking,
        "cctv_cnt": _to_int(dtl.get("kaptdCccnt")),
        "raw": {"bass": bass, "dtl": dtl},
    }


def fetch_complex_record(item: kapt_api.KaptListItem, with_detail: bool = True) -> dict:
    """단지 1건의 기본(+상세)정보를 API 로 받아 레코드 조립."""
    bass = kapt_api.fetch_basis_info(item.kaptCode)
    dtl = kapt_api.fetch_detail_info(item.kaptCode) if with_detail else {}
    return build_complex_record(item, bass, dtl)


# ─── 시군구 동기화 (DB) ───────────────────────────────────────────────────────
def sync_sigungu(sgg_cd: str, with_detail: bool = True,
                 max_age_days: int = 30, on_progress=None) -> dict:
    """시군구 K-apt 단지 동기화 → kapt_complexes upsert.

    단지 목록(list)은 매번 받되(저렴), 각 단지의 기본/상세정보(비쌈)는 최근
    max_age_days 일 내 동기화된 건 건너뛴다 → 자주 눌러도 신규/오래된 것만 받음.
    max_age_days=0 이면 전량 강제 재동기화.

    on_progress(done, total, kapt_name) 콜백(선택). 통계 dict 반환.
    """
    from services import db

    items = kapt_api.fetch_sigungu_apt_list(sgg_cd)
    fresh = db.get_recent_kapt_codes(max_age_days) if max_age_days else set()
    total = len(items)
    rows, errors, skipped = [], 0, 0
    for i, it in enumerate(items):
        if it.kaptCode in fresh:                       # 최근 동기화됨 → 건너뜀
            skipped += 1
            if on_progress:
                on_progress(i + 1, total, f"{it.kaptName} (최신)")
            continue
        try:
            rows.append(fetch_complex_record(it, with_detail=with_detail))
        except kapt_api.KaptQuotaExceeded:
            # 한도 초과는 재시도해도 소용없다. 여기까지 받은 건 저장하고 중단.
            if rows:
                db.upsert_kapt_complexes(rows)
            raise
        except kapt_api.KaptApiError:
            errors += 1
        if on_progress:
            on_progress(i + 1, total, it.kaptName)

    saved = db.upsert_kapt_complexes(rows) if rows else 0
    return {"sgg_cd": sgg_cd, "total": total, "fetched": len(rows),
            "skipped": skipped, "errors": errors, "saved": saved}
