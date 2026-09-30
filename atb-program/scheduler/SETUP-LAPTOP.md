# 수집기를 다른 PC(노트북)로 옮기기

수집기는 공공 API에서 받아 **DB 서버(158.247.244.167)** 에 넣는 일만 한다.
웹 서버와는 무관하므로, 노트북이 켜져 있고 인터넷만 되면 된다.

DB 는 SSH 터널로 붙는다. 집 인터넷은 IP 가 바뀌어서 방화벽에 고정할 수 없고,
MySQL(3306)을 인터넷에 열어두면 여러 프로젝트가 같이 쓰는 DB 서버가 통째로
공격 대상이 되기 때문이다.

```
노트북 ──SSH(22)──> DB 서버 ──> MySQL(3306)
       localhost:3307 로 붙으면 서버 MySQL 로 연결된다
```

---

## 1. 노트북 준비

- **Python 3.11 이상** — 설치할 때 "Add Python to PATH" 체크
- **Git**
- **OpenSSH 클라이언트** — 윈도우 10/11 에 기본 포함 (`ssh -V` 로 확인)

## 2. 코드 받기

```bash
git clone https://github.com/adpeak-personal/all_that_realestate.git C:\project\atb
cd C:\project\atb\atb-program
python -m venv .venv
.venv\Scripts\pip install -r requirements-collect.txt
```

`requirements.txt` 가 아니라 **`requirements-collect.txt`** 를 쓴다. 원본에는 접어둔
이미지 파이프라인(torch 등)이 남아 있어 수 GB 를 받는다. 수집에 필요한 건 두 개뿐이다.

## 3. SSH 키 만들고 등록

노트북에서:

```bash
ssh-keygen -t ed25519 -f %USERPROFILE%\.ssh\atb_tunnel -C "atb tunnel" -N ""
type %USERPROFILE%\.ssh\atb_tunnel.pub
```

출력된 공개키를 **DB 서버** `~/.ssh/authorized_keys` 에 한 줄로 붙인다.
앞에 제한을 붙이면 이 키로는 **터널만** 가능하고 서버 접속(쉘)은 막힌다.
노트북을 잃어버려도 피해가 제한된다.

```
restrict,permitopen="127.0.0.1:3306" ssh-ed25519 AAAA... atb tunnel
```

확인:

```bash
ssh -i %USERPROFILE%\.ssh\atb_tunnel -N -L 3307:127.0.0.1:3306 root@158.247.244.167
```

창이 멈춘 채로 있으면 성공이다(터널이 열린 상태). 다른 창에서 다음 단계로 간다.

## 4. `.env` 만들기

`atb-program\.env` 로 만든다. **키 값들은 기존 PC 의 `.env` 에서 그대로 복사**한다
(저장소에는 들어 있지 않다).

```
DATA_AUTH_KEY=공공데이터포털 인증키
JUSO_SEARCH_KEY=주소검색 승인키
JUSO_COORD_KEY=좌표제공 승인키

# 터널로 붙으므로 localhost 다. 포트가 3307 인 것에 주의.
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3307
MYSQL_USER=atb
MYSQL_PASSWORD=DB 서버에서 만든 비밀번호
MYSQL_DATABASE=atb_db
```

연결 확인:

```bash
.venv\Scripts\python -c "from services import db; print(db.load_sgg_codes()[:1])"
```

시군구 한 줄이 나오면 DB 까지 닿은 것이다.

## 5. 예약 작업 등록

```bash
scheduler\register_tasks.bat
```

등록되는 것:

| 이름 | 시점 | 하는 일 |
|---|---|---|
| DB 터널 (시작프로그램) | 로그인 시 | SSH 터널 유지 (끊기면 15초 뒤 재접속) |
| `AllThat\KaptSync` | 매일 09:00 | K-apt 단지 마스터 |
| `AllThat\Geocode` | 매일 04:00 | 좌표 채우기 |
| `AllThat\PresaleSync` | 매일 06:00 | 청약홈 분양 공고 |

터널은 예약 작업이 아니라 **시작프로그램**으로 들어간다. 예약 작업의 '로그인 시' 방식은
관리자 권한을 요구해서, 권한 없이 되는 시작프로그램 폴더를 쓴다.
수집이 시작될 때 이미 연결돼 있어야 하므로 하루 종일 떠 있는다.

## 6. 노트북 설정

- **절전 끄기** — 덮으면 수집이 멈춘다.
  설정 > 시스템 > 전원 > 화면·절전 모드 → "안 함"
- **자동 로그인** — 재부팅 후 로그인 상태여야 예약 작업이 돈다
- 노트북 덮개를 닫아도 안 꺼지게: 제어판 > 전원 옵션 > 덮개를 닫을 때 → "아무 것도 안 함"

## 7. 기존 PC 의 예약 작업 해제 ★

**이걸 빠뜨리면 같은 수집이 두 곳에서 돌아 공공 API 하루 한도를 두 배로 쓴다.**

기존 PC 에서:

```bash
atb-program\scheduler\unregister_tasks.bat
```

---

## 확인

하루 뒤 로그를 본다.

```bash
type logs\kapt-YYYYMMDD.log
```

또는 사이트 어드민(`https://atb.co.kr/admin`)의 **수집 상태** 카드에서
마지막 수집 시각이 갱신되는지 본다. 하루 이상 밀려 있으면 노트북이 꺼졌거나
터널이 끊긴 것이다.

## 터널이 자주 끊길 때

`scheduler\tunnel.bat` 은 끊기면 15초 뒤 다시 붙는다. 그래도 문제가 계속되면
DB 서버 `/etc/ssh/sshd_config` 에 다음을 추가하면 서버 쪽에서도 연결을 유지한다.

```
ClientAliveInterval 60
ClientAliveCountMax 3
```
