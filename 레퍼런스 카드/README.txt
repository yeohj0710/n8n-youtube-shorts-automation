레퍼런스 카드 쇼츠 — 작업 폴더

소재는 이 폴더가 아니라 아래 데이터셋에서 읽습니다. 여기에는 기록만 쌓입니다.

  소재   research\single-screen-references\videos.jsonl   (2,000건)
  회로   하루건강약사 - 레퍼런스 카드 쇼츠

한 번 실행하면 아직 안 쓴 레코드 1건을 무작위로 골라, 사용자가 재가공해 둔
`*_reworked_ko` 문안 그대로 카드 이미지를 만들고 BGM → 5초 MP4 → YouTube 공개
업로드 → 고정 댓글 → 사용기록 체크까지 처리합니다.

이미지 생성·BGM·렌더·업로드 노드는 메인 회로(하루건강약사 - n8n 유튜브 쇼츠 자동화)에서
그대로 복제한 것이라 그림 품질과 음악 규칙이 기존 쇼츠와 같습니다. 카드 마무리 줄에는
카드뉴스처럼 `@haruyaksa`가 붙습니다.


기록 (= 체크리스트)

  기록\사용기록.jsonl    이미 쓴 record_id. 여기 있는 레코드는 다시 뽑히지 않습니다.
  기록\업로드기록.jsonl  업로드까지 성공한 건만.
  기록\reference-card.lock  실행 중 잠금. 30분 지나면 자동으로 풀립니다.

렌더까지 갔으면 업로드 실패 여부와 무관하게 사용기록에 남습니다. 비용이 이미 났고, 같은
레코드를 또 뽑아 쓰는 것이 더 나쁩니다. 다시 쓰려면 사용기록에서 그 줄을 지우세요.

의학 안전 검수에서 막힌 건은 사용기록에 남지 않습니다. 문안을 고치거나 다른 레코드로
다시 실행하면 됩니다.


선별 기준 — selection-gate.json

데이터셋 자체 QA가 2,000건 중 `publish_ready`를 11건만 true로 두고 있습니다.
(`claim_risk` high 1,945건, `fact_check_required` true 1,975건.) high로 잡힌 것은
대부분 낙상·운동·시니어 건강처럼 의학적 주장이 섞인 주제이고, publish_ready 11건은
요리·관계·생활습관 주제입니다.

기본 기준은 그 플래그를 그대로 존중합니다. 넓히려면 이 파일을 고치세요. 회로를 다시
빌드할 필요 없이 다음 실행부터 적용됩니다.

  require_publish_ready      true면 publish_ready=true만 씁니다.
  allowed_claim_risk         ["low"] → ["low","medium"] 처럼 넓힐 수 있습니다.
  allow_fact_check_required  true로 두면 사실확인 필요 건도 씁니다.
  min_items / max_items      카드 항목 수 범위.

의학성 주제를 열 때는 약사 검수를 먼저 거치는 것을 전제로 합니다. 회로의
`Medical Safety Review`는 완치·치료 보장·진료 회피 같은 표현만 막고, 개별 사실의
정확성은 검사하지 않습니다.


Google Sheet 체크박스

원본 시트(`한 화면 정보 카드 레퍼런스 1-2000`, ID 1K6gT9TY_WHuxB3SHEx5VyJK2JunQWJRdkdV4ecNu_fc)의
체크박스는 이 회로가 직접 건드리지 않습니다. n8n에 Google Sheets 자격 증명이 없고,
시트 쓰기는 OAuth 승인이 필요합니다. 지금은 위 `사용기록.jsonl`이 체크리스트입니다.
시트에도 반영하려면 n8n에 Google Sheets 자격 증명을 추가한 뒤 알려주세요.


주의: 실행하면 KIE 비용이 발생하고 YouTube에 공개 영상이 게시됩니다. 회로를 가져오거나
열기만 해서는 실행되지 않습니다.
