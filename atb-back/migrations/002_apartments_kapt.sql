-- ============================================================
-- 002_apartments_kapt.sql
-- K-apt(공동주택) 단지정보 저장소 + 실거래 단지와의 매칭 연결.
--
-- 구조:
--   kapt_complexes  … K-apt 단지 마스터 (목록+기본+상세 정보). 매칭용 인덱스이자
--                     단지 부가정보 저장소. 시군구 단위로 '마스터 동기화 워커'가 채운다.
--   apartments      … 실거래에서 나온 단지. 매칭 결과(kapt_code)로 kapt_complexes 에
--                     연결하고, 세대수·주소 등 부가정보는 JOIN 으로 읽는다.
--
-- 매칭기: atb-program/services/apt_matcher.py (이름+지번 병행)
-- API   : 국토교통부 1613000 (AptListService3 / AptBasisInfoServiceV4)
-- 실측(서초/강남/송파/마포): 자동확정 거래기준 ~75~84%.
--   미매칭(K-apt 미등록 소규모/주상복합)은 apartments.kapt_code NULL 로 남긴다.
-- ============================================================

USE `atb_db`;


-- ── 1. K-apt 단지 마스터 ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `kapt_complexes` (
  `kapt_code`        VARCHAR(20)   NOT NULL COMMENT 'K-apt 단지코드 (PK, 앵커키)',
  `kapt_name`        VARCHAR(100)  NOT NULL COMMENT '단지명 (kaptName)',

  -- 지역
  `sgg_cd`           INT           DEFAULT NULL COMMENT '시군구코드 5자리 (bjd_code 앞 5자리)',
  `sido_nm`          VARCHAR(40)   DEFAULT NULL COMMENT '시도 (as1)',
  `sgg_nm`           VARCHAR(40)   DEFAULT NULL COMMENT '시군구 (as2)',
  `umd_nm`           VARCHAR(50)   DEFAULT NULL COMMENT '법정동 (as3)',
  `bjd_code`         CHAR(10)      DEFAULT NULL COMMENT '법정동코드 10자리 (bjdCode)',

  -- 주소 & 매칭키
  `addr_jibun`       VARCHAR(200)  DEFAULT NULL COMMENT '지번주소 (kaptAddr)',
  `addr_road`        VARCHAR(200)  DEFAULT NULL COMMENT '도로명주소 (doroJuso)',
  `jibun`            VARCHAR(30)   DEFAULT NULL COMMENT 'addr_jibun 에서 파싱한 지번 (매칭용)',

  -- 기본정보 (getAphusBassInfoV4)
  `total_households` INT           DEFAULT NULL COMMENT '세대수 (kaptdaCnt)',
  `dong_cnt`         SMALLINT      DEFAULT NULL COMMENT '동수 (kaptDongCnt)',
  `top_floor`        SMALLINT      DEFAULT NULL COMMENT '최고층 (kaptTopFloor)',
  `use_apr_date`     DATE          DEFAULT NULL COMMENT '사용승인일=준공일 (kaptUsedate)',
  `heat_type`        VARCHAR(20)   DEFAULT NULL COMMENT '난방방식 (codeHeatNm)',
  `hall_type`        VARCHAR(20)   DEFAULT NULL COMMENT '복도유형: 계단식/복도식 (codeHallNm)',
  `sale_type`        VARCHAR(20)   DEFAULT NULL COMMENT '분양형태 (codeSaleNm)',
  `builder`          VARCHAR(100)  DEFAULT NULL COMMENT '시공사 (kaptBcompany)',
  `total_area`       DECIMAL(12,2) DEFAULT NULL COMMENT '연면적 ㎡ (kaptTarea)',

  -- 상세정보 (getAphusDtlInfoV4)
  `parking_total`    INT           DEFAULT NULL COMMENT '총주차대수 = 지상(kaptdPcnt)+지하(kaptdPcntu)',
  `cctv_cnt`         INT           DEFAULT NULL COMMENT 'CCTV 대수 (kaptdCccnt)',

  -- 원본 보존 (향후 필드 추가/재파싱 대비)
  `raw`              JSON          DEFAULT NULL COMMENT '기본+상세 원본 응답 병합',

  `synced_at`        TIMESTAMP     NULL DEFAULT NULL COMMENT 'K-apt 마지막 동기화 시각',
  `created_at`       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`kapt_code`),
  KEY `idx_sgg`         (`sgg_cd`),
  KEY `idx_match`       (`sgg_cd`, `umd_nm`, `jibun`),
  KEY `idx_kapt_name`   (`kapt_name`(50))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='K-apt 공동주택 단지 마스터';


-- ── 2. apartments 에 매칭 연결 컬럼 추가 ────────────────────────
--   부가정보는 apartments 에 복사하지 않고 kapt_code 로 kapt_complexes 를 JOIN 한다.
--   FK 대신 일반 인덱스: 마스터 재동기화 중 일시적 정합성 문제를 피하고 파이프라인을
--   느슨하게 결합 (kapt_code 는 매칭기가 kapt_complexes 에서 가져온 값이라 항상 유효).
ALTER TABLE `apartments`
  ADD COLUMN `kapt_code`    VARCHAR(20)  DEFAULT NULL COMMENT 'kapt_complexes.kapt_code (미매칭 시 NULL)' AFTER `apt_nm`,
  ADD COLUMN `match_status` TINYINT      NOT NULL DEFAULT 0
      COMMENT '0:미매칭 1:confirmed(이름+지번) 2:matched(단일) 3:ambiguous 4:conflict — 3·4는 수동확인',
  ADD COLUMN `match_method` VARCHAR(20)  DEFAULT NULL COMMENT 'name / jibun / name+jibun',
  ADD COLUMN `matched_at`   TIMESTAMP    NULL DEFAULT NULL COMMENT '매칭 실행 시각',
  ADD KEY `idx_kapt_code`    (`kapt_code`),
  ADD KEY `idx_match_status` (`match_status`);
