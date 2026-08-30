"""공동주택(K-apt) 단지정보 API 클라이언트.

국토교통부 3개 서비스(기관코드 1613000)를 감싼다. serviceKey 는 실거래가와 동일 키.
  - AptListService3      : 단지 목록 (kaptCode 획득)
  - AptBasisInfoServiceV4: 단지 기본정보 (세대수/주소/준공일 등)
  - AptBasisInfoServiceV4: 단지 상세정보 (주차/승강기/CCTV 등)

응답은 JSON. 실거래가(apt_api.py)가 XML 인 것과 다르다.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import requests

import config

_LIST_BASE = "https://apis.data.go.kr/1613000/AptListService3"
_INFO_BASE = "https://apis.data.go.kr/1613000/AptBasisInfoServiceV4"


class KaptApiError(RuntimeError):
    pass


def _get(url: str, params: dict, timeout: int = 15) -> dict:
    """serviceKey 는 이미 인코딩된 값이라 직접 URL 에 붙인다 (apt_api.py 와 동일)."""
    if not config.DATA_AUTH_KEY:
        raise KaptApiError(f"DATA_AUTH_KEY 가 설정되지 않았습니다 ({config.ENV_PATH} 확인).")

    qs = "&".join(f"{k}={v}" for k, v in params.items())
    full = f"{url}?serviceKey={config.DATA_AUTH_KEY}&{qs}"
    res = requests.get(full, timeout=timeout)
    if not res.ok:
        raise KaptApiError(f"API 응답 오류: {res.status_code} {res.reason}\n{res.text[:200]}")

    try:
        data = res.json()
    except ValueError as e:
        raise KaptApiError(f"JSON 파싱 실패: {e}\n{res.text[:200]}") from e

    body = (data.get("response") or {}).get("body")
    header = (data.get("response") or {}).get("header") or {}
    code = header.get("resultCode")
    if code not in (None, "00", "000", "0"):
        raise KaptApiError(f"API 오류: [{code}] {header.get('resultMsg')}")
    if body is None:
        raise KaptApiError(f"응답에 body 없음: {res.text[:200]}")
    return body


# ─── 단지 목록 ────────────────────────────────────────────────────────────────
@dataclass
class KaptListItem:
    kaptCode: str
    kaptName: str
    bjdCode: str = ""
    sido: str = ""      # as1
    sgg: str = ""       # as2
    umd: str = ""       # as3
    ri: str = ""        # as4

    @classmethod
    def from_json(cls, d: dict) -> "KaptListItem":
        return cls(
            kaptCode=d.get("kaptCode", ""),
            kaptName=d.get("kaptName", ""),
            bjdCode=d.get("bjdCode", "") or "",
            sido=d.get("as1", "") or "",
            sgg=d.get("as2", "") or "",
            umd=d.get("as3", "") or "",
            ri=d.get("as4", "") or "",
        )


def fetch_sigungu_apt_list(sigungu_code: str, page_size: int = 100) -> list[KaptListItem]:
    """시군구코드(5자리)로 등록 단지 전량 조회 (페이지네이션 자동)."""
    out: list[KaptListItem] = []
    page = 1
    while True:
        body = _get(f"{_LIST_BASE}/getSigunguAptList3",
                    {"sigunguCode": sigungu_code, "pageNo": page, "numOfRows": page_size})
        items = body.get("items") or []
        if isinstance(items, dict):          # 단건일 때 dict 로 오는 경우 방어
            items = [items]
        out.extend(KaptListItem.from_json(x) for x in items)
        total = int(body.get("totalCount") or 0)
        if len(out) >= total or not items:
            break
        page += 1
    return out


# ─── 기본/상세 정보 ───────────────────────────────────────────────────────────
def fetch_basis_info(kapt_code: str) -> dict:
    """단지 기본정보 (세대수/주소/준공일/시공사/면적분포 등). 원본 dict 반환."""
    body = _get(f"{_INFO_BASE}/getAphusBassInfoV4", {"kaptCode": kapt_code})
    return body.get("item") or {}


def fetch_detail_info(kapt_code: str) -> dict:
    """단지 상세정보 (주차/승강기/CCTV/구조/부대복리시설 등). 원본 dict 반환."""
    body = _get(f"{_INFO_BASE}/getAphusDtlInfoV4", {"kaptCode": kapt_code})
    return body.get("item") or {}
