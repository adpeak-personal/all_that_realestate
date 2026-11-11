# scheduler — 남은 것 하나뿐

수집 예약은 더 이상 Windows 작업 스케줄러로 하지 않는다. 노트북에 띄워 두는
통합 실행기(`py` 저장소의 `dgn&atb/dgn-atb-program`)가 스케줄을 직접 들고 있다.

그래서 여기 있던 것들을 지웠다:

| 지운 것 | 대체 |
|---|---|
| `register_tasks.bat` | 실행기가 `jobs.py` 의 `JOBS` 로 스케줄을 갖는다 |
| `run_job.py` | `worker.py` (실행기가 자기 자신을 `--job` 으로 다시 띄운다) |
| `tunnel.bat` | 실행기의 `SshTunnel` 이 직접 열고 유지한다 |
| `SETUP-LAPTOP.md` | **`py` 저장소의 `dgn&atb/dgn-atb-program/SETUP-LAPTOP.md`** 로 옮기고 갱신했다 |

`register_tasks.bat` 을 일부러 지웠다. 예약 작업과 실행기가 같이 돌면 같은
수집이 두 번 나가 공공 API 하루 한도를 두 배로 쓴다. 되돌릴 길을 없애는 게
안전하다 (필요하면 git 역사에 있다).

## unregister_tasks.bat 만 남긴 이유

예전 방식으로 등록해 둔 기계가 아직 있을 수 있다. 실행기가 뜰 때
`AllThat\KaptSync` 가 작업 스케줄러에 남아 있으면 경고를 띄우고 **이 파일로
지우라고 안내한다** (`jobs.py` 의 `preflight`). 그 경고가 가리키는 대상이라
지우지 않는다.
