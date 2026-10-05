-- 오피스텔 매매 + 전월세(아파트·오피스텔) 를 담는다.
--
-- 왜 이렇게 나누는가:
--   · 매매는 유형만 다르고 필드가 거의 같다 (오피스텔은 aptNm → offiNm 정도).
--     그래서 apartment_deals 를 그대로 쓰고 property_type 칸만 붙인다.
--   · 전월세는 모양이 다르다 — dealAmount 대신 deposit·monthlyRent 이고,
--     취소일·등기일이 없고, contractTerm·preDeposit(이전 계약) 이 붙는다.
--     한 테이블에 억지로 넣으면 NULL 칸이 절반이 되므로 테이블을 나눈다.
--
-- 적용 순서 주의: 003 은 002(커버링 인덱스) 뒤에 적용한다.
--
-- 되돌리기:
--   DROP TABLE property_rents;
--   ALTER TABLE apartment_deals DROP COLUMN property_type;
--   ALTER TABLE apartments DROP INDEX uq_apt, ADD UNIQUE KEY uq_apt (sgg_cd, apt_nm, jibun),
--                          DROP INDEX idx_type_sgg, DROP COLUMN property_type;

-- ── 1. 단지 마스터에 유형 ─────────────────────────────────────────────────
-- 같은 지번·같은 이름의 아파트와 오피스텔이 따로 잡혀야 하므로 유니크 키에 넣는다.
-- (기존 행은 전부 'APT' 가 되어 키 값이 그대로 유지된다)
ALTER TABLE `apartments`
  ADD COLUMN `property_type` VARCHAR(10) NOT NULL DEFAULT 'APT'
      COMMENT 'APT:아파트 OFFI:오피스텔 RH:연립다세대' AFTER `id`;

ALTER TABLE `apartments`
  DROP INDEX `uq_apt`,
  ADD UNIQUE KEY `uq_apt` (`property_type`, `sgg_cd`, `apt_nm`, `jibun`),
  ADD KEY `idx_type_sgg` (`property_type`, `sgg_cd`);

-- ── 2. 매매 거래에 유형 ───────────────────────────────────────────────────
-- 맨 뒤에 기본값으로 붙이므로 MySQL 8 은 즉시(INSTANT) 끝낸다 — 61만 행이어도
-- 테이블을 다시 쓰지 않는다.
ALTER TABLE `apartment_deals`
  ADD COLUMN `property_type` VARCHAR(10) NOT NULL DEFAULT 'APT'
      COMMENT 'APT:아파트 OFFI:오피스텔 RH:연립다세대';

-- ── 3. 전월세 ─────────────────────────────────────────────────────────────
-- transaction_key: 전월세 API 는 등기일·해제일이 없어 매매처럼 쓸 수 없다.
--   MD5(유형+시군구+단지명+지번+계약일+층+면적+보증금+월세+계약구분+계약기간)
-- 같은 날 같은 호에 같은 조건의 계약이 두 건이면 한 건으로 본다 (사실상 중복신고).
CREATE TABLE IF NOT EXISTS `property_rents` (
  `id`               BIGINT        NOT NULL AUTO_INCREMENT,
  `transaction_key`  VARCHAR(64)   NOT NULL,
  `apt_id`           BIGINT        DEFAULT NULL COMMENT 'apartments.id FK',
  `property_type`    VARCHAR(10)   NOT NULL DEFAULT 'APT' COMMENT 'APT / OFFI',

  -- 위치·단지
  `sgg_cd`           INT           NOT NULL,
  `umd_nm`           VARCHAR(50)   NOT NULL,
  `jibun`            VARCHAR(20)   DEFAULT NULL,
  `apt_nm`           VARCHAR(100)  NOT NULL,
  `build_year`       SMALLINT      DEFAULT NULL,

  -- 계약
  `deal_date`        DATE          NOT NULL COMMENT '계약일',
  `deal_year`        SMALLINT      NOT NULL,
  `deal_month`       TINYINT       NOT NULL,
  `deal_day`         TINYINT       NOT NULL,
  `deposit`          INT           NOT NULL COMMENT '보증금 (만원)',
  `monthly_rent`     INT           NOT NULL DEFAULT 0 COMMENT '월세 (만원). 0 이면 전세',
  -- 전세/월세 구분을 저장해 둔다. 조회에서 매번 monthly_rent>0 을 쓰면 인덱스를 못 탄다.
  `rent_type`        CHAR(1)       GENERATED ALWAYS AS (IF(`monthly_rent` > 0, 'M', 'J')) STORED
      COMMENT 'J:전세 M:월세',
  `exclu_use_ar`     DECIMAL(7,4)  NOT NULL COMMENT '전용면적 ㎡',
  `floor`            SMALLINT      DEFAULT NULL,

  -- 계약 특성 (2021년 6월 이후 신고분에만 채워진다)
  `contract_term`    VARCHAR(20)   DEFAULT NULL COMMENT '계약기간 (예: 2409~2609)',
  `contract_type`    VARCHAR(20)   DEFAULT NULL COMMENT '신규 / 갱신',
  `pre_deposit`      INT           DEFAULT NULL COMMENT '갱신 전 보증금 (만원)',
  `pre_monthly_rent` INT           DEFAULT NULL COMMENT '갱신 전 월세 (만원)',
  `use_rr_right`     VARCHAR(10)   DEFAULT NULL COMMENT '갱신요구권 사용 여부',

  `created_at`       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_rent`        (`transaction_key`),
  KEY `idx_sgg_date`          (`sgg_cd`, `deal_date`),
  KEY `idx_apt_nm`            (`apt_nm`(50)),
  KEY `idx_grp_sgg_ym`        (`sgg_cd`, `deal_year`, `deal_month`),
  -- 단지 상세의 전월세 집계가 인덱스만 읽고 끝나게 한다 (002 와 같은 이유)
  KEY `idx_rent_cover`        (`apt_id`, `rent_type`, `deal_date`, `deposit`, `monthly_rent`, `exclu_use_ar`),

  CONSTRAINT `fk_rent_apt` FOREIGN KEY (`apt_id`)
    REFERENCES `apartments` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='전월세 실거래 (아파트·오피스텔)';

-- 확인
SELECT 'apartments 유형 분포' AS k, property_type AS v, COUNT(*) AS n
  FROM apartments GROUP BY property_type
UNION ALL
SELECT 'apartment_deals 유형 분포', property_type, COUNT(*) FROM apartment_deals GROUP BY property_type
UNION ALL
SELECT 'property_rents', '(생성됨)', COUNT(*) FROM property_rents;
