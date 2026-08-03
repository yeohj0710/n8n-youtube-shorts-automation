# 한 화면 정보 카드 레퍼런스 작업 지침

## 작업 루트와 보존 범위

- 이 디렉터리가 유일한 작업 루트다.
- `videos.jsonl`과 `sources.jsonl`의 기존 레코드를 보존한다.
- `C:\dev\n8n-youtube-shorts-automation\research\references`는 수정하지 않는다.
- 목표 2,000개는 달성됐다. 사용자가 추가 수집을 요청하기 전에는 `etc\deferred_after_target.jsonl`을 처리하지 않는다.

## Google Sheet 기준 문서

- 문서 제목: `한 화면 정보 카드 레퍼런스 1-2000`
- Spreadsheet ID: `1K6gT9TY_WHuxB3SHEx5VyJK2JunQWJRdkdV4ecNu_fc`
- URL: `https://docs.google.com/spreadsheets/d/1K6gT9TY_WHuxB3SHEx5VyJK2JunQWJRdkdV4ecNu_fc/edit`
- Google Drive 데스크톱 바로가기: `G:\내 드라이브\영상 편집\AI 크리에이터\한 화면 정보 카드 레퍼런스 1-2000.gsheet`
- 동기화 설정: `etc\google_sheet_sync_config.json`

`.gsheet` 파일은 Google Drive 데스크톱의 가상 바로가기다. 일반 텍스트 파일처럼 읽거나 데이터 저장소로 사용하지 않는다. 문서 식별에는 `state.json`의 `google_sheet.sheet_id`를 사용하고, Google Sheets 커넥터로 문서를 읽고 수정한다.

## 동기화 규칙

1. Google Sheets 작업 전에 Google Sheets 관련 스킬 지침을 읽는다.
2. `state.json`의 Spreadsheet ID와 `etc\google_sheet_sync_config.json`의 Spreadsheet ID가 같은지 확인한다.
3. `videos.jsonl`을 `통과 영상` 탭에, `sources.jsonl`을 `출처 기록` 탭에, `etc\rejections.jsonl`을 `탈락 기록` 탭에 동기화한다.
4. 기존 행을 다시 정렬하거나 삭제하지 않는다. `record_id`를 고유 키로 사용한다.
5. 불리언 열은 문자열 `TRUE`/`FALSE`가 아니라 Boolean 값으로 기록하고, 전체 데이터 범위에 `BOOLEAN` 데이터 검증을 적용해 체크박스로 표시한다.
6. `통과 영상` 탭의 체크박스 열은 `K`, `AD`, `AE`, `AP`, `AR`, `AS`다.
   레퍼런스 카드 사용기록은 별도 `AU` 열(`업로드 완료`)에 기록한다. 기존 6개 열과 섞지 않는다.
7. 데이터 행은 높이 42px, 세로 위쪽 정렬, 긴 텍스트는 `CLIP` 표시를 유지한다. 체크박스는 가로·세로 가운데 정렬한다.
8. 동기화가 끝나면 `state.json`의 `google_sheet.last_synced_row`와 `google_sheet.last_synced_at`을 실제 결과에 맞춰 갱신한다.

## 완료 전 검증

- `node .\etc\validate_dataset.mjs`가 오류 없이 끝나야 한다.
- 로컬 `videos.jsonl` 레코드 수와 `통과 영상` 데이터 행 수가 같아야 한다.
- `통과 영상`의 `record_id`는 모두 채워져 있고 중복이 없어야 한다.
- 마지막 데이터 행 다음 행의 `record_id`는 비어 있어야 한다.
- 기존 체크박스 6개 열과 `AU` 열의 표본 셀에서 `dataValidation.condition.type`이 `BOOLEAN`이어야 한다.
- `state.json`의 `accepted_count`, `last_synced_row`, 실제 Sheet 데이터 행 수가 같아야 한다.
- Google Drive 바로가기 경로가 존재하는지 확인한다. 바로가기의 수정 시간은 동기화 완료 여부를 판정하는 기준으로 사용하지 않는다.

## 브라우저 사용

- 이 작업은 캡처 검증과 인앱 브라우저를 사용하지 않는다.
- 불가피하게 인앱 브라우저를 쓰면 `C:\Users\hjyeo\.codex\iab-browser-lease.ps1`로 임대를 획득하고 반환한다.
