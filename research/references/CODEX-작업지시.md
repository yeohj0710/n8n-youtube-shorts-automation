# Codex 작업지시 — 5060 대상 쇼츠 레퍼런스 수집

goal 모드로 장시간 실행하는 수집 작업이다. 목표 수치를 전부 채울 때까지 계속한다.

작업 폴더는 `C:\dev\n8n-youtube-shorts-automation\research\references` 하나뿐이다.
이 폴더 **밖의 파일은 읽기만 하고 절대 수정하지 않는다.**

---

## 1. 목표 수치 (전부 충족해야 완료)

| 항목 | 목표 |
|---|---|
| 유튜브 채널 | **40개 이상** (시드 4개 포함) |
| 인스타그램 계정 | **30개 이상** |
| 유튜브 영상 항목 | **700개 이상** |
| 인스타그램 게시물 항목 | **300개 이상** |
| 총 항목 | **1000개 이상** |
| 채널당 항목 | 최소 10개, 최대 60개 (한 채널 편중 금지) |

선택 목표 (위를 다 채우고도 시간이 남으면):

| 항목 | 목표 |
|---|---|
| 상위 조회수 항목의 인기 댓글 수집 | **100개 항목 × 댓글 3개** |

---

## 2. 출력 파일

`research/references/` 아래 JSONL 두 개. **한 줄에 JSON 하나**, append 전용.

### `channels.jsonl`

```json
{"platform":"youtube","handle":"@BABARA-k2i","url":"https://www.youtube.com/@BABARA-k2i/shorts","name":"바바라핵팁","subscribers":71000,"topic_axes":["health_habit","cooking_recipe","money_policy"],"item_count":48,"collected_at":"2026-07-25","blocked":false}
```

- `subscribers`: 정수. 못 구하면 `null`
- `topic_axes`: 아래 topic_axis 값 중 그 채널의 주력 1~3개
- `blocked`: 항목 수집이 막힌 계정이면 `true`, 이유는 `note`에

### `items.jsonl`

```json
{"platform":"youtube","channel_handle":"@BABARA-k2i","item_id":"abc123","url":"https://www.youtube.com/shorts/abc123","title":"60 넘어 알게 된 황금 레시피 TOP10 #요리꿀팁","views":800000,"likes":null,"published_at":"2026-05-11","list_count":10,"hook_patterns":["age_call_out","number_list"],"topic_axis":"cooking_recipe","collected_at":"2026-07-25"}
```

- `title`: **원문 그대로 복사한다.** 해시태그 포함, 오타 포함, 그대로. 요약·의역·다시쓰기 절대 금지
- `views`: 정수. 인스타처럼 조회수가 없으면 `null`
- `likes`: 정수 또는 `null`
- `list_count`: 제목에 박힌 항목 수(`10가지` → 10, `TOP7` → 7). 없으면 `null`
- `item_id`: 유튜브 영상 ID / 인스타 게시물 shortcode. 중복 판정 키
- `hook_patterns`: 아래 enum에서 해당하는 것 전부 (보통 1~3개)

---

## 3. enum (이 값만 쓴다. 새 값 만들지 말 것)

### hook_patterns

| 값 | 뜻 | 예 |
|---|---|---|
| `age_call_out` | 나이를 직접 부름 | 60 넘어, 나이 들수록, 내 나이에 |
| `loss_frame` | 손해·후회 프레임 | 놔두면 나만 손해, 늦게 알수록 손해, 돈 버립니다 |
| `command` | 강한 명령형 | 당장 버리세요, 절대 하지 마세요, 조심하세요 |
| `authority_flip` | 권위 비틀기 | 의사들은 알려주지 않는, 요리 고수만 아는, 사장님이 알려준 |
| `number_list` | 개수 제시 | 10가지, TOP7, 9가지 |
| `paren_preview` | 괄호 부제로 항목 미리보기 | (계란, 두부, 꿀 보관법), (낙상 예방 필수) |
| `belief_reversal` | 통념 뒤집기 | 99%가 잘못 알고 있다, ~가 아니라 ~입니다 |
| `threat` | 위협·공포 | 돌연사, 생명을 위협하는, 큰일 납니다 |
| `versus` | 대결 구도 | vs, 이것 대신 저것 |
| `identity_quiz` | 나를 맞히기 | 혈액형, 출생년도, 사주, 체크리스트 |
| `moment_trigger` | 특정 순간 지목 | 아침에 눈뜨자마자, 밥 먹고 1시간 안에 |
| `insider_reveal` | 내부자 폭로 | 며느리도 놀란, 30년 차가 알려주는 |

### topic_axis (하나만 고른다)

`cooking_recipe` `food_ingredient` `cleaning_home` `health_signal` `health_habit`
`disease_risk` `money_policy` `real_estate_tax` `relationships_family`
`life_wisdom_psych` `appliance_manual` `hospital_pharmacy` `clothing_appearance`
`phone_digital` `car_transport` `season_weather` `travel_leisure` `fortune_identity`

---

## 4. 수집 대상 판정

**담는다**
- 시청자가 50~60대인 채널/계정. 구독자·댓글·말투·소재로 판단
- 유튜브: 조회수 **3만 이상**, 또는 그 채널 상위 30% 안에 드는 것
- 인스타: 좋아요 **500 이상**, 또는 그 계정 상위 30%

**버린다**
- 20~30대 타깃 (여드름, 선크림, 다이어트 보조제, 헬스 벌크업, 취업)
- 뉴스 클립, 드라마·예능 잘라 붙인 것, 정치 콘텐츠
- 조회수·좋아요를 못 구한 항목 (단, 그 계정 전체가 막힌 경우는 `channels.jsonl`에 `blocked:true`로 기록)

---

## 5. 채널 찾는 법

시드 4개 (이미 수집됨, `seed-scrape-2026-07-25.txt` 참고):

```
https://www.youtube.com/@BABARA-k2i/shorts        바바라핵팁
https://www.youtube.com/@DreamLife99100/shorts    꿈꾸는 인생
https://www.youtube.com/@지혜人TV/shorts           지혜人TV
https://www.youtube.com/@건강-d4i/shorts           건강행복교수
```

여기서 넓힌다.

1. 유튜브 검색어를 돌린다 — 시니어 건강 / 5060 건강 / 중년 건강상식 / 노후 준비 / 실버 라이프 / 살림 꿀팁 / 생활 정보 / 주부 꿀팁 / 몸이 보내는 신호 / 나이 들수록 / 60대 / 은퇴 후 / 연금 / 요리 꿀팁 / 반찬 레시피 / 식재료 보관법 / 청소 꿀팁 / 인생 조언 / 삶의 지혜 / 건강 수명 / 낙상 예방 / 혈압 혈당 관리 / 무릎 관절 / 치매 예방
2. 시드 채널의 추천 채널·관련 채널을 탄다
3. 잘 나온 영상 제목을 그대로 검색해 같은 소재를 다루는 다른 채널을 찾는다
4. 인스타는 해시태그로 — #시니어건강 #5060 #중년건강 #건강정보 #건강상식 #살림꿀팁 #생활꿀팁 #주부꿀팁 #노후준비 #실버

---

## 6. 유튜브 수집 방법 (검증된 방식, 이대로 쓸 것)

`research/references/tools/scrape-youtube-shorts.mjs` 가 이미 동작한다. 채널 `/shorts` URL을 인자로 주면 제목+조회수가 나온다.

```
node research/references/tools/scrape-youtube-shorts.mjs "https://www.youtube.com/@핸들/shorts"
```

원리: 채널 페이지 HTML의 `var ytInitialData = {...}` 를 통째로 파싱해서 `shortsLockupViewModel` 을 훑는다. 브라우저 렌더링이 필요 없다.

이 스크립트를 확장해도 된다 (JSONL 직접 출력, 페이지네이션으로 48개 이상 가져오기, 업로드 날짜 추가 등). **단 이 폴더 안에서만 수정한다.**

한 채널이 48개까지만 나오는 것은 첫 페이지만 읽기 때문이다. `continuation` 토큰으로 더 받아오면 채널당 상한 60개를 채울 수 있다.

---

## 7. 인스타그램 수집 방법

**인앱 브라우저에 사용자가 미리 본인 계정으로 로그인해 둔다.** 그 세션을 그대로 쓴다. 로그인 상태이므로 프로필 그리드, 릴스 조회수, 해시태그 페이지가 다 보인다.

- `fetch`로는 세션이 안 실려서 안 된다. **인앱 브라우저로 페이지를 열어 DOM에서 읽는다**
- 릴스는 조회수가 보인다 → `views`에 넣는다. 일반 게시물은 `views:null`, `likes`에 좋아요 수
- 게시물 제목이 따로 없으므로 **캡션 첫 줄**을 `title`에 넣는다. 원문 그대로
- 계정 탐색: 해시태그 페이지 → 상위 게시물 → 그 계정 프로필 → 그 계정이 팔로우하는 유사 계정 순으로 넓힌다

로그인 상태에서도 막히는 경우(비공개 계정 등)에는 `channels.jsonl`에 `blocked:true`, `note`에 이유를 적고 넘어간다.

---

## 8. 계정 안전 수칙 (사용자 본인 계정이다)

로그인된 개인 계정으로 도는 작업이라, 과하게 빠르면 계정이 제한된다. 데이터보다 계정이 중요하다.

- **요청 간 최소 3초 간격.** 페이지 연속 로딩 금지
- **인스타 시간당 200페이지 이하**로 유지한다. 넘을 것 같으면 유튜브 쪽 작업으로 전환한다
- 로딩 실패·오류 화면이 연속 3회 나오면 **10분 쉬었다가** 재개한다. 즉시 재시도 반복 금지
- 보안 확인·비정상 활동 경고·CAPTCHA가 뜨면 **거기서 멈추고 사용자에게 알린다.** 절대 풀거나 우회하지 않는다
- **상호작용 금지**: 좋아요, 팔로우, 댓글, DM, 저장, 구독, 공유, 신고 어느 것도 누르지 않는다. 읽기만 한다
- 계정 설정·비밀번호·연결 앱을 건드리지 않는다. 약관·쿠키 동의 창은 승인하지 말고 사용자에게 알린다
- 유튜브는 로그인 세션을 쓰지 않는다 (아래 6번 스크립트가 비로그인으로 더 빠르고, 계정에 흔적도 안 남는다)

---

## 9. 절대 금지

- **한국어 문구를 창작하지 말 것.** 제목·캡션은 원문 복사만 한다. 요약, 의역, 다시쓰기, "이런 뜻입니다" 설명 전부 금지. 판단이 필요한 건 전부 enum으로만 표현한다
- `research/references/` 밖의 파일 수정 금지. 이 저장소는 여러 에이전트가 같은 워크트리에서 동시에 작업한다
- `scripts/`, `workflows/`, `.n8n/`, n8n 워크플로·DB 건드리지 말 것
- `git add`, `git commit`, `git push` 금지. 파일만 남기면 된다
- 계정 생성, 봇 차단 우회, CAPTCHA 풀기 금지 (8번 참조)
- 영상·이미지 파일 다운로드 금지. 메타데이터(제목·조회수·URL)만 모은다

---

## 10. 완료 판정

이 명령이 `ok:true` 를 뱉으면 끝이다. 중간에도 계속 돌려 진행률을 확인한다.

```bash
node -e "const fs=require('fs');const L=p=>fs.existsSync(p)?fs.readFileSync(p,'utf8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l)):[];const c=L('research/references/channels.jsonl'),i=L('research/references/items.jsonl');const u=a=>new Set(a).size;const yt=c.filter(x=>x.platform==='youtube').length,ig=c.filter(x=>x.platform==='instagram').length;const iy=i.filter(x=>x.platform==='youtube').length,ii=i.filter(x=>x.platform==='instagram').length;console.log(JSON.stringify({channels_youtube:yt,channels_instagram:ig,items_youtube:iy,items_instagram:ii,items_total:i.length,unique_ids:u(i.map(x=>x.item_id)),ok:yt>=40&&ig>=30&&iy>=700&&ii>=300&&i.length>=1000&&u(i.map(x=>x.item_id))===i.length},null,1));"
```

`unique_ids` 가 `items_total` 과 다르면 중복이 들어간 것이다. `item_id` 기준으로 중복을 지우고 다시 확인한다.

작업 중간에 끊겨도 JSONL은 append 전용이라 이어서 하면 된다. 새로 수집하기 전에 기존 `item_id` 를 먼저 읽어 중복을 건너뛴다.
