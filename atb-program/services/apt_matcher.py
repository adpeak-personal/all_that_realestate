"""실거래 단지 ↔ K-apt 단지 매칭 (순수 로직, API/DB 의존 없음).

실측으로 확인한 매칭의 두 가지 벽:
  1. 이름 표기 흔들림 — K-apt 는 법정동을 접두어로 붙임(서초삼풍 / 잠원동대우아이빌),
     실거래도 붙는 경우가 있음(서초동삼성쉐르빌2). 이름만으론 겹침/누락 발생.
  2. 지번 불일치 — 재건축 대단지는 여러 필지에 걸쳐 두 소스가 대표 지번을 다르게
     잡음(원베일리 1 vs 1-1, 리더스원 1336 vs 1755).

→ 이름과 지번을 함께 써서 서로의 약점을 메운다.
     · 지번이 이름 중복을 가른다   (임광1,2차 vs 임광3차 → 지번으로 확정)
     · 이름이 지번 어긋남을 건진다 (원베일리 → 지번 실패해도 이름으로 매칭)
"""
from __future__ import annotations

import re
from collections import defaultdict
from dataclasses import dataclass, field


# ─── 정규화 ───────────────────────────────────────────────────────────────────
def norm_name(s: str) -> str:
    """단지명 정규화: 괄호내용·공백·구분기호 제거, '아파트' 접미어·'N차'의 차 제거."""
    s = s or ""
    s = re.sub(r"\(.*?\)", "", s)          # (113동) 같은 괄호 내용
    s = re.sub(r"[·,\-_/.\s]", "", s)      # 구분기호·공백
    s = re.sub(r"아파트$", "", s)
    s = re.sub(r"(\d+)차", r"\1", s)       # 2차 → 2
    return s.lower()


def norm_jibun(s: str) -> str:
    """지번 정규화: 공백 제거, '산' 접두 유지, 본번-부번 형태로."""
    s = (s or "").strip().replace(" ", "")
    return s


def dong_prefixes(umd: str) -> list[str]:
    """법정동명에서 접두어 후보 [방배동, 방배]. 가/리 로 끝나면 그대로만."""
    d_full = norm_name(umd)                 # 방배동
    out = [d_full]
    base = re.sub(r"동$", "", d_full)       # 방배
    if base and base != d_full:
        out.append(base)
    return [p for p in out if p]


def name_variants(name: str, umd: str) -> set[str]:
    """단지명 + 법정동에서 나올 수 있는 표기 변형 집합.

    양방향: 접두어를 붙인 형태와 뗀 형태를 모두 생성해 교차 매칭한다.
    """
    n = norm_name(name)
    bases = {n}
    # 'N단지' 를 뗀 형태를 후보에 '추가'(파괴적 정규화 아님) —
    # K-apt 가 단지번호 없이 한 항목으로 등록한 경우(마포래미안푸르지오)를 잡되,
    # 단지가 따로 등록된 경우는 원형이 남아 안 깨진다.
    stripped = re.sub(r"\d+단지", "", n)
    if stripped and stripped != n:
        bases.add(stripped)

    v = set(bases)
    for b in bases:
        for pre in dong_prefixes(umd):
            v.add(pre + b)                              # 접두어 추가
            if b.startswith(pre) and len(b) > len(pre):
                v.add(b[len(pre):])                     # 접두어 제거
    return {x for x in v if x}


# ─── 주소 → 지번 파서 (K-apt kaptAddr) ────────────────────────────────────────
_ADDR_JIBUN = re.compile(r"(\S*?[동가리])\s+(산?\s?\d+(?:-\d+)?)")


def parse_addr_jibun(addr: str) -> tuple[str, str] | None:
    """'서울…방배동 899-16 브라운스톤' → ('방배동','899-16'). 실패 시 None."""
    if not addr:
        return None
    m = _ADDR_JIBUN.search(addr)
    if not m:
        return None
    return (m.group(1), norm_jibun(m.group(2)))


# ─── 매칭 ─────────────────────────────────────────────────────────────────────
# 매칭 상태
CONFIRMED = "confirmed"    # 이름+지번 동시 일치 (최고 신뢰)
MATCHED = "matched"        # 한쪽(이름 또는 지번)으로 단일 확정
AMBIGUOUS = "ambiguous"    # 후보 2개 이상, 자동 확정 불가 → 수동 확인
CONFLICT = "conflict"      # 이름과 지번이 서로 다른 단지를 가리킴 → 수동 확인
UNMATCHED = "unmatched"    # 후보 없음 (K-apt 미등록 추정)

# apartments.match_status 정수 코드 (002_apartments_kapt.sql 과 일치)
STATUS_CODE = {UNMATCHED: 0, CONFIRMED: 1, MATCHED: 2, AMBIGUOUS: 3, CONFLICT: 4}


@dataclass
class MatchResult:
    status: str
    kapt_code: str | None = None
    method: str = ""                       # name / jibun / name+jibun
    candidates: list[str] = field(default_factory=list)


@dataclass
class MasterRecord:
    """매칭 대상 단지 (K-apt 목록+기본정보에서 구성)."""
    kapt_code: str
    kapt_name: str
    umd: str                               # 법정동명 (as3)
    jibun: str = ""                        # kaptAddr 에서 파싱한 지번


class AptMatcher:
    """단지 마스터로 인덱스를 구축하고 실거래 1건을 매칭한다."""

    def __init__(self, master: list[MasterRecord]):
        self.master = master
        self._name_idx: dict[str, set[str]] = defaultdict(set)
        self._jibun_idx: dict[tuple[str, str], set[str]] = defaultdict(set)
        for m in master:
            for v in name_variants(m.kapt_name, m.umd):
                self._name_idx[v].add(m.kapt_code)
            if m.jibun:
                self._jibun_idx[(norm_name(m.umd), norm_jibun(m.jibun))].add(m.kapt_code)

    def _name_candidates(self, apt_nm: str, umd: str) -> set[str]:
        out: set[str] = set()
        for v in name_variants(apt_nm, umd):
            out |= self._name_idx.get(v, set())
        return out

    def _jibun_candidates(self, umd: str, jibun: str) -> set[str]:
        if not jibun:
            return set()
        return set(self._jibun_idx.get((norm_name(umd), norm_jibun(jibun)), set()))

    def match(self, apt_nm: str, umd: str, jibun: str = "") -> MatchResult:
        N = self._name_candidates(apt_nm, umd)
        J = self._jibun_candidates(umd, jibun)
        inter = N & J

        # 1) 이름+지번 교집합이 하나로 좁혀지면 최고 신뢰
        if len(inter) == 1:
            return MatchResult(CONFIRMED, next(iter(inter)), "name+jibun", sorted(inter))
        if len(inter) > 1:
            return MatchResult(AMBIGUOUS, None, "name+jibun", sorted(inter))

        # 2) 교집합 없음 — 한쪽만으로 단일 확정되는지
        if len(J) == 1 and len(N) == 1:
            # 이름과 지번이 서로 다른 단지를 지목 → 충돌
            return MatchResult(CONFLICT, None, "name!=jibun", sorted(N | J))
        if len(J) == 1:
            return MatchResult(MATCHED, next(iter(J)), "jibun", sorted(J))
        if len(N) == 1:
            return MatchResult(MATCHED, next(iter(N)), "name", sorted(N))

        # 3) 어느 쪽도 단일이 아님
        if N or J:
            return MatchResult(AMBIGUOUS, None, "name|jibun", sorted(N | J))
        return MatchResult(UNMATCHED, None, "", [])
