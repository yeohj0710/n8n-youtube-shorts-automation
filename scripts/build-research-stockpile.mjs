// Builds the ready-to-run topic stockpile under research/queue/<channel>/.
// Each emitted file carries the finished card copy (final_pack) and is rendered
// verbatim: the legacy workflow skips text generation entirely.
//
// Evidence is OPTIONAL. A pack that declares `sources` and `facts` gets a
// research_source_pack attached; a pack without them ships as plain everyday
// copy. This is deliberate — these are entertaining shorts, not clinical
// education, and requiring a citation per item drags every topic toward
// material that reads like a clinic handout. Write from ordinary life first.
import fs from 'node:fs';
import path from 'node:path';

const root = 'C:/dev/n8n-youtube-shorts-automation';
const outDir = path.join(root, 'research', 'queue');

const CHANNELS = {
  haru: { dir: '하루건강약사', profile: 'haru_health_literacy' },
  longevity: { dir: '건강장수비결', profile: 'longevity_daily_function' },
};

export const PACKS = [
  {
    channel: 'haru',
    slug: '03-sock-body-signals',
    pillar: 'body_signals',
    lane: 'body_signal_selfcheck',
    queries: [
      '질병관리청 국가건강정보포털 노인 부종 다리 붓기',
      '국민체력100 앉아윗몸앞으로굽히기 유연성 측정 항목',
      '서울아산병원 말초신경병증 발 감각 둔해짐',
      '발톱 색 두께 변화 조갑백선 무좀',
    ],
    sources: [
      { id: 'S1', title: '노인 부종', publisher: '질병관리청 국가건강정보포털', url: 'https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=2827', published_at: '', source_type: 'government_health_agency' },
      { id: 'S2', title: '낙상', publisher: '질병관리청 국가건강정보포털', url: 'https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=1743', published_at: '', source_type: 'government_health_agency' },
      { id: 'S3', title: '체력측정 항목 안내 - 앉아윗몸앞으로굽히기', publisher: '국민체력100 (국민체육진흥공단)', url: 'https://nfa.kspo.or.kr/reserve/0/selectMeasureItemListByAgeSe.kspo', published_at: '', source_type: 'government_health_agency' },
      { id: 'S4', title: '당뇨병성 말초신경병증', publisher: '서울아산병원 질환백과', url: 'https://www.amc.seoul.kr/asan/healthinfo/disease/diseaseDetail.do?contentId=32274', published_at: '', source_type: 'hospital_health_info' },
      { id: 'S5', title: '조갑백선', publisher: '서울아산병원 질환백과', url: 'https://www.amc.seoul.kr/asan/healthinfo/disease/diseaseDetail.do?contentId=31678', published_at: '', source_type: 'hospital_health_info' },
    ],
    facts: [
      ['F1', ['S1'], '양말 자국이 오래 남는 것은 다리가 부었다는 신호일 수 있다.',
        '질병관리청 자료는 부종을 혈관 밖에 체액이 쌓여 몸이 붓는 현상으로 설명하고, 노인의 양쪽 다리 부종은 정맥순환 저하 등과 관련될 수 있다고 안내한다.',
        '매일 신는 양말이 그날의 몸 상태를 알려준다는 점은 잘 알려져 있지 않다.', '양말은 누구나 매일 신는다.',
        '자국이 오래 남는 날이 잦으면 다리를 올려 쉬어 본다.', '자국이 오래 남을 때에 해당한다.', '잠깐 남았다 사라지는 자국은 그냥 눌린 흔적이다.', 'moderate_high'],
      ['F2', ['S2'], '한 발로 서서 양말 신기가 전보다 힘들면 균형 잡는 힘이 떨어진 것이다.',
        '질병관리청 낙상 자료는 나이가 들수록 균형 감각이 떨어지고 이것이 낙상 위험으로 이어지며, 균형 감각은 꾸준한 운동으로 유지할 수 있다고 안내한다.',
        '균형은 넘어져 봐야 아는 줄 알지만 아침마다 확인하고 있었다.', '매일 아침 겪는 동작이다.',
        '힘들면 벽을 짚고 신되 서서 신는 연습을 이어간다.', '전과 비교해 달라졌을 때에 해당한다.', '한두 번 휘청인 것은 균형 문제라고 볼 수 없다.', 'moderate_high'],
      ['F3', ['S3'], '앉아서 발끝으로 손을 뻗는 동작은 실제로 몸의 유연성을 보는 방법이다.',
        '국민체력100은 앉아윗몸앞으로굽히기를 건강체력 네 요소 중 유연성 측정 항목으로 두고 있다.',
        '체력 검사에 쓰는 동작을 매일 양말 신으며 하고 있었다는 점이 뜻밖이다.', '앉아서 양말 신는 자세와 같다.',
        '손이 멀어졌으면 자기 전 다리 뒤를 늘여 준다.', '앉아서 상체를 숙일 때에 해당한다.', '팔다리 길이에 따라 닿는 정도가 원래 다르다.', 'high'],
      ['F4', ['S4'], '발바닥이나 발가락 감각이 둔해지는 것은 신경 문제의 신호일 수 있다.',
        '서울아산병원 자료는 말초신경병증에서 발의 감각이 둔해져 압력이나 자극을 잘 못 느끼게 되고, 심하면 상처가 나도 모를 수 있다고 설명한다.',
        '감각이 둔해지면 아픈 게 아니라 아무 느낌이 없어서 놓친다.', '양말을 신을 때 발을 직접 만지게 된다.',
        '둔한 느낌이 이어지면 발을 눈으로도 살펴본다.', '느낌이 계속되거나 심해질 때에 해당한다.', '오래 접고 있던 다리가 잠깐 저린 것은 흔한 일이다.', 'high'],
      ['F5', ['S5'], '발톱 색이나 두께가 달라진 것은 발톱 상태가 변했다는 신호다.',
        '서울아산병원 자료는 발톱무좀에서 발톱이 하얗게 변하고 두꺼워지며 잘 부스러진다고 설명한다.',
        '발톱은 늘 신발과 양말에 가려져 있어 변한 줄도 모르고 지낸다.', '양말 신을 때가 발톱을 보는 거의 유일한 순간이다.',
        '달라졌으면 그대로 두지 말고 한 번 진료로 확인한다.', '전과 비교해 달라졌을 때에 해당한다.', '신발에 눌리거나 부딪혀도 색과 두께는 변한다.', 'high'],
    ],
    angle: '양말 신는 짧은 순간에 몸은 부기, 균형, 유연성, 감각, 발톱까지 다섯 가지를 한꺼번에 보여 준다.',
    rejected: ['부종의 원인 질환 분류 - 임상 영역이라 시청자가 할 행동이 없음', '당뇨 발 관리 지침 - 특정 질환자 대상이라 채널 범위를 벗어남', '균형 검사 초 단위 기준 - 임상 검사 수치라 눈높이를 벗어남'],
    topicKey: 'sock_moment_body_signals',
    card: {
      hook: '양말 신을 때 그냥 넘기면 안 되는 몸의 신호 5',
      sub: '매일 아침 몇 초 사이에 다 드러나거든요',
      visualProfile: 'morning_light',
      mood: '아침 침대 맡에 앉아 양말을 신는 발과 손, 창으로 들어오는 부드러운 햇살, 크림색과 따뜻한 베이지 팔레트, 면 이불 질감',
      bgm: 'warm gentle felt piano with soft strings, calm unhurried morning mood',
      script: '양말 신는 순간에 몸이 다 알려줘요.',
      desc: '양말 신을 때 몸이 알려주는 신호를 정리했어요.',
      comment: '양말 신는 짧은 순간에 부기, 균형, 유연성, 감각, 발톱까지 한꺼번에 보여요. 따로 시간 낼 것도 없이 내일 아침에 그대로 확인해 보세요. 구독하시고 성분과 몸의 원리를 쉽게 이해하는 건강 정보를 받아보세요.',
      tags: ['건강정보', '시니어건강', '몸의신호'],
      items: [
        ['F1', ['S1'], '양말 자국이 오래 남기', '양말 자국이 오래 남기', '고무줄 자국이 한참 안 없어지는 날이 잦으면 다리가 부은 신호일 수 있어요', '고무줄 자국이 한참 안 없어지면 다리가 부은 거예요'],
        ['F2', ['S2'], '한 발로 서서 신기 힘들기', '서서 못 신고 앉게 되기', '전에는 서서 신던 양말을 앉아야만 신게 됐다면 균형 잡는 힘이 줄어든 거예요', '서서 신던 양말을 앉아야 신게 됐다면 균형이 떨어진 거예요'],
        ['F3', ['S3'], '발끝까지 손이 안 닿기', '발끝에 손이 안 닿기', '앉아서 발끝으로 손을 뻗는 자세는 체력 검사에서 유연성을 보는 동작과 같아요', '앉아서 발끝에 손을 뻗는 자세가 유연성 검사 동작이에요'],
        ['F4', ['S4'], '발 감각이 둔해지기', '발 감각이 둔해지기', '양말이 닿는 느낌이 예전 같지 않은 날이 이어지면 발 감각이 둔해진 거예요', '양말 닿는 느낌이 계속 둔하면 발을 눈으로도 살펴봐요'],
        ['F5', ['S5'], '발톱 색과 두께가 달라지기', '발톱 색과 두께가 달라지기', '발톱은 늘 가려져 있어서 색이 흐려지고 두꺼워진 걸 이때 처음 보게 돼요', '양말 신을 때 말고는 발톱이 흐려지고 두꺼워진 걸 볼 일이 없어요'],
      ],
    },
  },

  {
    channel: 'haru',
    slug: '04-tv-volume-hearing',
    pillar: 'daily_health_choices',
    lane: 'daily_health_lifestyle',
    queries: [
      '질병관리청 국가건강정보포털 노인성난청 고음 말소리 구별',
      '질병관리청 외이도염 귀지 면봉 파내기',
      '대한이비인후과학회 소음성난청 청각세포 손상 영구',
      'unilateral hearing loss turn up volume TV',
    ],
    sources: [
      { id: 'S1', title: '외이도염', publisher: '질병관리청 국가건강정보포털', url: 'https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=1587', published_at: '2020-03-22', source_type: 'government_health_agency' },
      { id: 'S2', title: '노인성난청', publisher: '질병관리청 국가건강정보포털', url: 'https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=5489', published_at: '2020-07-22', source_type: 'government_health_agency' },
      { id: 'S3', title: 'Unilateral Hearing Loss (Single-Sided Deafness)', publisher: 'Cleveland Clinic', url: 'https://my.clevelandclinic.org/health/diseases/21625-unilateral-hearing-loss-single-sided-deafness', published_at: '', source_type: 'hospital_health_info' },
      { id: 'S4', title: '소음성난청', publisher: '대한이비인후과학회', url: 'https://www.korl.or.kr/info/sub01_13.php', published_at: '', source_type: 'professional_society' },
    ],
    facts: [
      ['F1', ['S1'], '귀지가 귓길을 막으면 소리가 덜 들어오고, 면봉으로 파면 더 밀려 들어간다.',
        '질병관리청 자료는 귀지가 저절로 밀려 나오므로 억지로 파낼 필요가 없고 면봉으로 파다가 상처를 내는 경우가 많다고 안내하며, 귓길이 막혀 생긴 먹먹함은 막힘이 풀리면 회복된다고 설명한다.',
        '잘 안 들려서 파낸 귀지가 오히려 더 막고 있었다는 점이 뜻밖이다.', '안 들리면 귀부터 후비는 습관이 흔하다.',
        '면봉으로 파는 대신 그대로 둔다.', '귀지로 막힌 경우에 해당한다.', '아프거나 진물이 나면 진료로 확인해야 한다.', 'high'],
      ['F2', ['S2'], '나이가 들면 높은 소리부터 안 들려서 소리는 들려도 말이 또렷하지 않다.',
        '질병관리청 자료는 노인성 난청에서 고음 영역이 먼저 나빠지면 밥과 밤처럼 비슷한 말을 구별하기 어려워진다고 설명한다.',
        '안 들리는 게 아니라 말이 뭉개지는 것이라는 점이 잘 안 알려져 있다.', '가족이 소리가 크다고 말하는 상황에 해당한다.',
        '소리를 키우는 대신 말하는 사람을 마주 본다.', '고음부터 나빠진 경우에 해당한다.', '진행 속도와 모양은 사람마다 다르다.', 'high'],
      ['F3', ['S2'], '주변에 소음이 있으면 말소리가 묻혀 더 알아듣기 어렵다.',
        '질병관리청 자료는 노인성 난청이 있으면 시끄러운 곳에서 말을 알아듣기 어렵다고 명시한다.',
        '귀가 아니라 방 안 소리 환경 때문일 수 있다는 점은 잘 생각하지 않는다.', '주방 물소리와 환풍기는 저녁마다 켜져 있다.',
        '볼륨을 올리기 전에 환풍기부터 끈다.', '주변 소음이 있을 때에 해당한다.', '청력이 좋아도 소음 속에서는 누구나 덜 들린다.', 'high'],
      ['F4', ['S3'], '한쪽 귀만 나빠지면 본인은 잘 모르고 볼륨만 키우게 된다.',
        '클리블랜드클리닉 자료는 한쪽 귀 난청의 증상으로 텔레비전이나 휴대전화의 볼륨을 키우는 것을 들고, 나빠진 쪽 소리를 덜 인식하게 된다고 설명한다.',
        '양쪽이 같이 나빠질 것이라는 생각과 달리 한쪽만 조용히 나빠진다.', '리모컨을 자꾸 누르는 상황에 해당한다.',
        '한쪽 귀를 막고 소리를 들어 좌우를 비교해 본다.', '한쪽만 나빠진 경우에 해당한다.', '좌우 차이는 검사로 확인해야 정확하다.', 'moderate_high'],
      ['F5', ['S4'], '크게 오래 듣는 습관 자체가 귀를 더 나쁘게 만든다.',
        '대한이비인후과학회 자료는 소음에 반복해서 노출되면 청각세포가 손상되어 영구적인 청력 장해로 남는다고 설명한다.',
        '안 들려서 키운 볼륨이 다시 귀를 깎는 되돌이가 된다는 점이 핵심이다.', '볼륨을 올린 채로 저녁 내내 켜 둔다.',
        '한 칸씩이라도 낮추고 오래 켜 두지 않는다.', '크게 오래 듣는 경우에 해당한다.', '손상 정도는 소리 크기와 듣는 시간에 따라 다르다.', 'high'],
    ],
    angle: '텔레비전 볼륨은 귀가 나빠져서만 올라가는 게 아니라, 귀지·소음·좌우 차이·습관까지 다섯 갈래에서 올라간다.',
    rejected: ['데시벨 기준과 청력검사 단계 설명 - 임상 수치라 눈높이를 벗어남', '보청기 종류 비교 - 구매 상담 영역이라 채널 범위를 벗어남', '자막 켜기 - 근거가 생활 관찰 수준이라 항목으로 세우지 않음'],
    topicKey: 'tv_volume_hearing_causes',
    card: {
      hook: '보청기 값 쓰기 전에 꼭 확인할 것 5',
      sub: '귀가 나빠서만 TV 소리를 키우는 게 아니거든요',
      visualProfile: 'magazine_cover',
      mood: '저녁 거실 소파 앞에 놓인 텔레비전과 리모컨, 따뜻한 스탠드 조명, 짙은 남색과 크림색 팔레트, 패브릭 소파 질감',
      bgm: 'warm calm piano with soft strings, quiet evening living room mood',
      script: '볼륨이 올라가는 이유부터 확인해요.',
      desc: '텔레비전 소리를 자꾸 키우게 되는 이유를 정리했어요.',
      comment: '볼륨이 올라가는 건 귀 하나 때문이 아니에요. 귀지, 주변 소음, 좌우 차이까지 확인하면 굳이 안 키워도 되는 경우가 있어요. 구독하시고 성분과 몸의 원리를 쉽게 이해하는 건강 정보를 받아보세요.',
      tags: ['건강정보', '시니어건강', '귀건강'],
      items: [
        ['F1', ['S1'], '귀지가 귓길을 막고 있기', '귀지가 귓길을 막기', '면봉으로 파내면 오히려 안쪽으로 밀려 들어가 더 막히게 돼요', '면봉으로 파낼수록 귀지가 안쪽으로 더 들어가 버려요'],
        ['F2', ['S2'], '높은 소리부터 안 들리기', '높은 소리부터 안 들리기', '소리는 들리는데 말이 뭉개져 들리면 높은 소리부터 안 들리는 거예요', '소리는 들리는데 말만 뭉개져요. 높은 소리부터 빠지거든요'],
        ['F3', ['S2'], '주변 소음이 말소리를 덮기', '주변이 시끄럽기', '환풍기나 물소리가 켜져 있으면 말소리가 묻혀서 더 안 들려요', '환풍기랑 물소리 때문에 말이 안 들리는 거예요'],
        ['F4', ['S3'], '한쪽 귀만 나빠지기', '한쪽 귀만 나빠지기', '한쪽만 나빠지면 본인은 잘 모르고 리모컨만 자꾸 누르게 돼요', '한쪽만 나빠진 건 본인이 몰라요. 볼륨만 자꾸 올리죠'],
        ['F5', ['S4'], '크게 오래 듣는 습관', '크게 오래 듣기', '크게 오래 듣는 것 자체가 귀를 더 나쁘게 만들어 다시 키우게 돼요', '크게 오래 들을수록 귀가 더 나빠져서 또 키우게 돼요'],
      ],
    },
  },

  {
    channel: 'haru',
    slug: '05-glasses-eye-strain',
    pillar: 'skin_vitality',
    lane: 'body_signal_selfcheck',
    queries: [
      'American Academy of Ophthalmology cleaning eyeglasses dry rub scratch',
      '안경 렌즈 관리 물로 헹군 뒤 닦기 흠집',
      '안경 광학중심 이탈 눈 피로 두통',
      '질병관리청 굴절이상 정기 눈 검사 40세 이상',
    ],
    sources: [
      { id: 'S1', title: 'Cleaning Eyeglasses - Tips & Prevention', publisher: 'American Academy of Ophthalmology', url: 'https://www.aao.org/eye-health/tips-prevention/cleaning-eyeglasses', published_at: '', source_type: 'professional_society' },
      { id: 'S2', title: '안경 렌즈를 어떻게 관리해야 할까요?', publisher: 'ZEISS Vision Care Korea', url: 'https://www.zeiss.co.kr/vision-care/eye-health-care/health-prevention/how-should-i-take-care-of-my-prescription-spectacle-lenses.html', published_at: '', source_type: 'professional_society' },
      { id: 'S3', title: 'Prescribing and fitting spectacles: the role of pupillary distance and the optical centre', publisher: 'Community Eye Health Journal', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11141121/', published_at: '2024', source_type: 'clinical_guideline' },
      { id: 'S4', title: '굴절이상(근시, 원시, 난시)', publisher: '질병관리청 국가건강정보포털', url: 'https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=5217', published_at: '', source_type: 'government_health_agency' },
    ],
    facts: [
      ['F1', ['S1', 'S2'], '옷자락으로 닦으면 옷에 붙은 먼지가 렌즈를 긁어 잔흠집이 남는다.',
        '안과학회와 렌즈 제조사 자료는 옷이나 티슈로 닦으면 눈에 안 보이는 먼지와 섬유가 사포처럼 작용해 흠집을 낸다고 설명한다.',
        '깨끗이 하려던 행동이 렌즈를 깎고 있었다는 점이 뜻밖이다.', '안경 쓰는 사람 대부분이 옷자락으로 닦는다.',
        '옷자락 대신 전용 천을 쓴다.', '먼지가 묻은 상태에서 문지를 때에 해당한다.', '옅은 흠집은 바로 느껴지지 않는다.', 'high'],
      ['F2', ['S1', 'S2'], '먼지가 묻은 채로 마른 천에 문지르는 것보다 물로 먼저 헹구는 편이 안전하다.',
        '안과학회 자료는 마른 상태로 문지르지 말고 미지근한 물로 씻은 뒤 닦으라고 권한다.',
        '닦는 방법보다 닦기 전 순서가 더 중요하다는 점은 잘 알려져 있지 않다.', '주머니에서 꺼내 바로 문지르는 습관이 흔하다.',
        '문지르기 전에 물로 먼저 헹군다.', '먼지가 묻어 있을 때에 해당한다.', '뜨거운 물은 코팅과 테를 상하게 한다.', 'high'],
      ['F3', ['S1', 'S2'], '기름때와 김서림 자국을 그대로 두면 사물이 덜 또렷하게 보인다.',
        '안과학회와 제조사 자료는 렌즈에 오염물이 남아 있으면 렌즈 본래의 선명도가 떨어진다고 안내한다.',
        '눈이 침침한 줄 알았는데 렌즈가 흐린 것이었던 경우가 많다.', '국물 김과 손자국은 매일 묻는다.',
        '흐릿하면 눈보다 렌즈를 먼저 본다.', '오염이 남아 있을 때에 해당한다.', '얼마나 떨어지는지 수치로 정해진 것은 아니다.', 'moderate_high'],
      ['F4', ['S3'], '안경이 흘러내려 눈과 어긋나면 눈이 더 애써서 피로해질 수 있다.',
        '국제 안과 교육지는 안경테가 맞지 않거나 조정되지 않으면 렌즈 중심이 눈과 어긋나 시야 흐림과 눈의 피로, 두통이 생길 수 있다고 설명한다.',
        '렌즈가 아니라 안경이 놓인 위치가 눈을 피곤하게 만든다는 점이 뜻밖이다.', '코받침이 벌어진 안경을 그냥 쓰는 경우가 많다.',
        '흘러내리면 닦지 말고 안경원에서 맞춘다.', '눈과 어긋난 정도가 클 때에 해당한다.', '어긋난 정도와 도수에 따라 영향이 다르다.', 'moderate_high'],
      ['F5', ['S4'], '안 보이는 것을 닦기로만 해결하려 하면 도수나 다른 원인을 놓친다.',
        '질병관리청 자료는 난시와 원시로 생기는 눈의 피로가 시력 저하와 두통으로 이어질 수 있다며 정기적인 눈 검사를 권한다.',
        '문제를 닦는 습관으로 덮고 지나가는 기간이 길어진다.', '안경만 닦고 검사는 미루는 경우가 흔하다.',
        '닦아도 그대로면 검사를 받는다.', '닦아도 나아지지 않을 때에 해당한다.', '검사 주기는 사람마다 다르다.', 'high'],
    ],
    angle: '안경이 흐린 것은 렌즈 탓만이 아니라 닦는 순서, 놓인 위치, 미룬 검사까지 다섯 갈래에서 온다.',
    rejected: ['렌즈 코팅 종류 비교 - 구매 상담 영역이라 채널 범위를 벗어남', '광학중심 이탈 수치 - 전문 용어와 수치라 눈높이를 벗어남', '안질환 목록 나열 - 겁주기이고 오늘 할 행동이 없음'],
    topicKey: 'glasses_cleaning_eye_strain',
    card: {
      hook: '안경을 닦아도 계속 침침한 진짜 이유 5',
      sub: '눈 나빠진 게 아니라 닦는 방법 때문일 수 있어요',
      visualProfile: 'myth_fact',
      mood: '책상 위에 놓인 안경과 극세사 천, 창가에서 들어오는 맑은 오후 빛, 크림색과 부드러운 회청색 팔레트, 나무 책상 질감',
      bgm: 'calm clear piano with light acoustic guitar, quiet focused afternoon mood',
      script: '안경부터 다시 보고 눈을 탓해요.',
      desc: '안경 닦는 습관이 눈을 피곤하게 만드는 이유를 정리했어요.',
      comment: '눈이 침침해졌다고 느낄 때 안경이 원인인 경우가 많아요. 닦는 순서와 안경이 놓인 위치만 바꿔도 하루가 덜 피곤해져요. 구독하시고 성분과 몸의 원리를 쉽게 이해하는 건강 정보를 받아보세요.',
      tags: ['건강정보', '시니어건강', '눈건강'],
      items: [
        ['F1', ['S1', 'S2'], '옷자락으로 닦기', '옷자락으로 닦기', '옷에 붙은 먼지가 사포처럼 렌즈를 긁어서 잔흠집이 남아요', '옷에 붙은 먼지에 긁혀서 렌즈에 잔흠집이 남아요'],
        ['F2', ['S1', 'S2'], '먼지째 마른 천으로 문지르기', '먼지째 마른 천으로 문지르기', '문지르기 전에 물로 먼저 헹궈서 먼지를 없애는 편이 안전해요', '물로 안 헹구고 문지르면 붙은 먼지가 그대로 긁어요'],
        ['F3', ['S1', 'S2'], '기름때와 김을 그대로 두기', '기름때를 그대로 두기', '국물 김이나 손자국이 남아 있으면 사물이 덜 또렷하게 보여요', '눈이 침침한 게 아니라 렌즈에 기름때가 남은 거예요'],
        ['F4', ['S3'], '흘러내리는 안경 그냥 쓰기', '흘러내려도 그냥 쓰기', '안경이 눈과 어긋난 자리에 있으면 눈이 더 애써서 피곤해져요', '안경이 흘러내린 자리에서 보면 눈이 더 애써서 피곤해져요'],
        ['F5', ['S4'], '닦기로만 해결하려 하기', '닦기로만 버티기', '닦아도 그대로면 도수나 다른 원인일 수 있어서 검사를 받아야 해요', '닦아도 흐리면 도수가 안 맞는 거라 검사를 받아야 해요'],
      ],
    },
  },

  {
    channel: 'longevity',
    slug: '04-overhead-reach-fall',
    pillar: 'daily_function',
    lane: 'home_kitchen_living',
    queries: [
      'NIA preventing falls at home room by room reach high shelf chair',
      '질병관리청 낙상 예방 어두운 곳 조명 밝게',
      'head neck extension standing balance older adults',
      'holding objects fall head impact long-term care',
    ],
    sources: [
      { id: 'S1', title: 'Preventing Falls at Home: Room by Room', publisher: 'National Institute on Aging (NIH)', url: 'https://www.nia.nih.gov/health/falls-and-falls-prevention/preventing-falls-home-room-room', published_at: '', source_type: 'government_health_agency' },
      { id: 'S2', title: '낙상', publisher: '질병관리청 국가건강정보포털', url: 'https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=1743', published_at: '', source_type: 'government_health_agency' },
      { id: 'S3', title: 'Head and neck extension more than 30 degrees may disturb standing balance in healthy older adults', publisher: 'Geriatric Nursing (PubMed, NIH)', url: 'https://pubmed.ncbi.nlm.nih.gov/32145993/', published_at: '2020-03-04', source_type: 'clinical_guideline' },
      { id: 'S4', title: 'Effect of Holding Objects on the Occurrence of Head Impact in Falls by Older Adults', publisher: 'The Journals of Gerontology (PMC, NIH)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8277085/', published_at: '2020-07-05', source_type: 'clinical_guideline' },
    ],
    facts: [
      ['F1', ['S1'], '의자나 침대에 올라서서 높은 곳 물건을 꺼내지 말라고 권한다.',
        '미국 국립노화연구소 자료는 의자나 탁자에 올라서서 높은 곳 물건을 꺼내지 말고 집게형 도구를 쓰거나 다른 사람에게 도움을 청하라고 안내한다.',
        '사다리 대신 쓰는 식탁 의자가 가장 흔한 위험이다.', '높은 장은 집집마다 있다.',
        '올라서는 대신 사람을 부르거나 집게를 쓴다.', '올라서서 꺼낼 때에 해당한다.', '흔들리는 의자와 푹신한 침대는 특히 불안정하다.', 'high'],
      ['F2', ['S3'], '고개를 오래 젖히고 위를 올려다보면 균형이 흔들린다.',
        '해외 학술지 연구는 건강한 고령자도 목을 뒤로 젖히는 각도가 커지면 몸의 흔들림이 뚜렷하게 커진다고 보고했다.',
        '팔이 아니라 젖힌 고개가 몸을 흔든다는 점은 잘 알려져 있지 않다.', '장롱 위를 볼 때는 늘 고개를 젖힌다.',
        '올려다보는 시간을 짧게 끊는다.', '고개를 젖히고 오래 볼 때에 해당한다.', '어지러운 정도는 사람마다 다르다.', 'moderate_high'],
      ['F3', ['S1'], '자주 쓰는 물건은 손이 쉽게 닿는 곳에 두라고 권한다.',
        '미국 국립노화연구소 자료는 자주 쓰는 물건을 손이 쉽게 닿는 위치에 보관하도록 안내한다.',
        '위험은 꺼내는 순간이 아니라 거기에 올려둔 날 만들어졌다.', '무거운 그릇을 높은 칸에 두는 집이 많다.',
        '무겁고 자주 쓰는 것부터 아래 칸으로 내린다.', '높은 곳에 둔 경우에 해당한다.', '보관 높이를 정한 국내 지침은 없다.', 'moderate_high'],
      ['F4', ['S4'], '넘어질 때 손이 비어 있어야 붙잡아 몸을 지킬 수 있다.',
        '요양시설의 실제 낙상 영상을 분석한 연구는 넘어지는 중에 가구나 손잡이처럼 고정된 것을 붙잡으면 머리를 부딪칠 위험이 크게 줄었고, 손에 들고 있던 물건은 그런 보호가 되지 않았다고 보고했다.',
        '두 손으로 받쳐 드는 조심스러운 동작이 정작 몸을 못 지키게 만든다.', '꺼낸 물건은 두 손으로 받게 된다.',
        '한 손은 비워 두고 한 번에 하나씩 내린다.', '넘어지는 순간에 해당한다.', '균형을 잃는 원인 자체를 다룬 연구는 아니다.', 'moderate_high'],
      ['F5', ['S2'], '어두운 곳은 밝게 하라고 낙상 예방 수칙이 권한다.',
        '질병관리청 낙상 자료는 어두운 곳과 계단, 침실, 욕실, 모서리를 밝게 하도록 안내한다.',
        '보이지 않는 상태로 손만 넣는 순간이 가장 위험하다.', '장롱 위는 원래 잘 안 보인다.',
        '불을 켜고 눈으로 본 뒤에 손을 넣는다.', '어두운 곳에서 꺼낼 때에 해당한다.', '조명 외의 위험 요인도 함께 작용한다.', 'high'],
    ],
    angle: '장롱 위 물건은 꺼내는 힘이 아니라 올라선 자리, 젖힌 고개, 막힌 두 손, 어두운 시야에서 사고가 난다.',
    rejected: ['낙상 사고 통계 - 겁주기이고 오늘 할 행동이 없음', '골절 부위별 회복 기간 - 진단·치료 영역이라 채널 범위를 벗어남', '균형 검사 각도 수치 - 임상 수치라 눈높이를 벗어남'],
    topicKey: 'overhead_storage_fall_moments',
    card: {
      hook: '장롱 위 물건 꺼내다 다치는 순간 5',
      sub: '꺼내는 힘보다 서 있는 자리가 문제예요',
      visualProfile: 'clinic_checklist',
      mood: '안방 장롱 위 선반과 아래에 놓인 나무 의자, 커튼 사이로 들어오는 낮은 오후 빛, 따뜻한 베이지와 짙은 갈색 팔레트, 원목 질감',
      bgm: 'calm warm piano with soft low strings, steady and careful mood',
      script: '장롱 위는 서 있는 자리부터 봐요.',
      desc: '장롱 위 물건 꺼내다 다치는 순간을 정리했어요.',
      comment: '장롱 위 물건은 꺼내는 힘이 아니라 올라선 자리와 막힌 두 손에서 사고가 나요. 무겁고 자주 쓰는 것부터 아래 칸으로 내려 두면 그 순간 자체가 없어져요. 구독하시고 건강한 노년을 지키는 습관을 함께 이어가요.',
      tags: ['건강정보', '시니어건강', '낙상예방'],
      items: [
        ['F1', ['S1'], '의자나 침대에 올라서기', '의자나 침대에 올라서기', '올라서서 꺼내는 대신 집게를 쓰거나 사람을 부르라고 권해요', '의자와 침대는 흔들려서 발 디딜 곳이 못 돼요'],
        ['F2', ['S3'], '고개를 젖히고 오래 올려다보기', '고개 젖히고 오래 보기', '목을 뒤로 젖히는 각도가 커질수록 몸의 흔들림도 커져요', '고개를 뒤로 젖힌 채로 오래 보면 몸이 휘청거려요'],
        ['F3', ['S1'], '무거운 것을 높은 칸에 두기', '무거운 것을 높은 칸에 두기', '자주 쓰는 물건은 손이 쉽게 닿는 곳에 두라고 안내해요', '높은 칸에 둔 무거운 그릇은 꺼낼 때마다 위험해요'],
        ['F4', ['S4'], '두 손으로 받아 들기', '두 손으로 받아 들기', '넘어질 때 손이 비어 있어야 붙잡아 몸을 지킬 수 있어요', '두 손이 막히면 넘어질 때 붙잡을 손이 없어요'],
        ['F5', ['S2'], '어두운 데서 더듬어 꺼내기', '어두운 데서 더듬어 꺼내기', '낙상 예방 수칙은 어두운 곳과 모서리를 밝게 하라고 안내해요', '안 보이는 데서 더듬다가 헛짚고 휘청하기 쉬워요'],
      ],
    },
  },

  {
    channel: 'longevity',
    slug: '05-dishwashing-back-posture',
    pillar: 'daily_function',
    lane: 'home_kitchen_living',
    queries: [
      'KOSHA 근골격계질환 예방 작업환경개선 지침 작업대 높이 팔꿈치',
      '한국산업안전보건공단 서서 일하는 근로자 발 받침대 피로예방매트',
      'KOSHA 무거운 물건 들기 무릎 굽히고 등을 반듯이',
      '질병관리청 요통 바른 자세',
    ],
    sources: [
      { id: 'S1', title: 'KOSHA GUIDE H-66-2012 근골격계질환 예방을 위한 작업환경개선 지침', publisher: '한국산업안전보건공단', url: 'https://oshri.kosha.or.kr/kosha/business/musculoskeletalPreventionData.do?mode=download&articleNo=296732&attachNo=167397', published_at: '2012-08-27', source_type: 'occupational_safety_agency' },
      { id: 'S2', title: '서서 일하는 근로자의 건강을 보호합시다', publisher: '한국산업안전보건공단 근골격계질환예방팀', url: 'https://oshri.kosha.or.kr/kosha/data/musculoskeletalPreventionData.do?mode=download&articleNo=296625&attachNo=167206', published_at: '', source_type: 'occupational_safety_agency' },
      { id: 'S3', title: '요통', publisher: '질병관리청 국가건강정보포털', url: 'https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=3796', published_at: '2026-05-11', source_type: 'government_health_agency' },
    ],
    facts: [
      ['F1', ['S1', 'S3'], '작업대가 낮으면 계속 허리를 숙이게 되어 부담이 쌓인다.',
        '산업안전보건공단 지침은 작업대 높이를 팔꿈치 높이에 맞춰 허리를 굽히고 일하지 않도록 하라고 하고, 질병관리청 요통 자료도 곧은 자세를 강조한다.',
        '허리가 아픈 이유가 설거지 시간이 아니라 싱크대 높이였다는 점이 뜻밖이다.', '집집마다 싱크대 높이는 정해져 있다.',
        '숙여진다면 그릇을 받쳐 높이를 올린다.', '숙인 자세로 오래 있을 때에 해당한다.', '가정 싱크대를 직접 다룬 지침은 아니다.', 'high'],
      ['F2', ['S1', 'S2'], '한자리에 오래 설 때 한쪽 발을 받침대에 올리면 허리가 덜 힘들다.',
        '산업안전보건공단 자료는 오래 서서 일할 때 발 받침대를 두고 다리를 번갈아 올려놓으면 척추를 곧게 유지하고 통증을 줄여 준다고 설명한다.',
        '오래 서 있는 문제를 자세가 아니라 발밑 물건 하나로 푼다.', '설거지는 늘 선 채로 한다.',
        '낮은 상자 하나를 발밑에 두고 번갈아 올린다.', '오래 서 있을 때에 해당한다.', '작업 현장 기준의 권고다.', 'high'],
      ['F3', ['S1'], '무거운 것은 허리만 숙여 들지 말고 무릎을 굽혀 들어야 한다.',
        '산업안전보건공단 지침은 무거운 물건을 들 때 무릎을 굽히고 등을 반듯이 유지한 채 무릎 힘으로 일어나며, 몸을 물건에 가깝게 붙이라고 명시한다.',
        '가장 위험한 순간은 씻을 때가 아니라 솥을 드는 그 한 번이다.', '국솥과 찜통은 매번 들어 옮긴다.',
        '솥은 무릎을 굽혀 몸에 붙여 든다.', '무거운 것을 들 때에 해당한다.', '무게 기준은 작업 현장 기준이다.', 'high'],
      ['F4', ['S1'], '팔만 뻗어 꺼내면 허리가 비틀리므로 몸을 가까이 붙여야 한다.',
        '같은 지침은 몸의 중심을 물체에 가깝게 하라고 하고, 허리를 갑자기 비트는 동작이 생기지 않도록 따로 규정한다.',
        '숙인 자세와 비트는 동작은 서로 다른 위험이라는 점이 잘 구분되지 않는다.', '싱크대 안쪽 그릇은 매번 팔을 뻗어 꺼낸다.',
        '한 발 다가서서 몸을 붙이고 꺼낸다.', '멀리 있는 것을 꺼낼 때에 해당한다.', '숙인 자세와는 다른 문제다.', 'high'],
      ['F5', ['S2'], '딱딱한 바닥에 오래 서 있으면 발과 다리에 피로가 쌓인다.',
        '산업안전보건공단 자료는 바닥에 양탄자나 피로예방매트를 깔아 딱딱한 바닥에 서 있지 않도록 하라고 안내하며, 딱딱한 바닥에 오래 서 있으면 통증과 불편이 생긴다고 설명한다.',
        '자세를 아무리 고쳐도 발밑이 그대로면 남는 피로가 있다.', '주방 바닥은 대개 타일이다.',
        '개수대 앞에 매트를 한 장 깐다.', '오래 서 있을 때에 해당한다.', '허리보다 발과 다리에 더 직접 해당한다.', 'moderate_high'],
    ],
    angle: '설거지에서 허리에 남는 것은 시간이 아니라 싱크대 높이, 발밑, 드는 방법, 팔 뻗는 거리에서 갈린다.',
    rejected: ['작업대 높이 수치와 중량 기준 - 산업안전 수치라 눈높이를 벗어남', '요통 검사와 치료 단계 - 진단 영역이라 채널 범위를 벗어남', '허리 근력 운동 나열 - 설거지 상황을 벗어난 별개 주제'],
    topicKey: 'dishwashing_posture_back_load',
    card: {
      hook: '허리 아픈 게 설거지 시간 탓이 아닌 이유 5',
      sub: '발밑에 받침 하나만 놓아도 허리가 편해지거든요',
      visualProfile: 'calendar_streak',
      mood: '주방 개수대 앞에 선 사람의 허리와 발, 발밑에 놓인 낮은 발판, 창으로 들어오는 저녁 빛, 크림색과 차분한 청록 팔레트, 타일과 스테인리스 질감',
      bgm: 'warm calm nylon guitar with soft piano, steady evening kitchen mood',
      script: '설거지는 서 있는 방법부터 봐요.',
      desc: '설거지하는 자세가 허리에 남기는 것을 정리했어요.',
      comment: '설거지로 허리가 아픈 건 오래 해서가 아니라 서 있는 방법 때문이에요. 발밑에 낮은 받침 하나만 놓아도 저녁 설거지가 한결 편해져요. 구독하시고 건강한 노년을 지키는 습관을 함께 이어가요.',
      tags: ['건강정보', '시니어건강', '허리건강'],
      items: [
        ['F1', ['S1', 'S3'], '낮은 싱크대에 계속 숙이기', '낮은 싱크대에 계속 숙이기', '작업대가 낮으면 허리를 굽힌 채로 오래 있게 돼서 부담이 쌓여요', '싱크대가 몸에 비해 낮으면 허리를 계속 굽히게 돼요'],
        ['F2', ['S1', 'S2'], '두 발을 바닥에만 두기', '두 발을 바닥에만 두기', '한쪽 발을 낮은 받침에 번갈아 올리면 척추를 곧게 유지하는 데 도움이 돼요', '두 발을 나란히 두고 오래 서면 허리가 금방 뻐근해져요'],
        ['F3', ['S1'], '솥을 허리만 숙여 들기', '솥을 허리만 숙여 들기', '무거운 건 무릎을 굽히고 몸에 붙여서 무릎 힘으로 들어 올려야 해요', '허리만 숙여 들다가 그 한 번에 삐끗하기 쉬워요'],
        ['F4', ['S1'], '팔만 뻗어 안쪽 꺼내기', '팔만 뻗어 안쪽 꺼내기', '멀리 있는 그릇을 팔만 뻗어 꺼내면 허리가 비틀리게 돼요', '안쪽 그릇을 팔만 뻗어 꺼내다 허리가 비틀려요'],
        ['F5', ['S2'], '딱딱한 바닥에 오래 서기', '딱딱한 바닥에 오래 서기', '타일 바닥에 오래 서 있으면 발과 다리에 피로가 쌓여요', '맨 타일 바닥은 발과 다리에 피로가 그대로 쌓여요'],
      ],
    },
  },

  // ---------------------------------------------------------------------------
  // Packs below carry no evidence on purpose. These are entertaining shorts for
  // people over 50, and the topics come from ordinary life across money, family,
  // appliances, shopping, and errands — not from one narrow "be careful at home"
  // lane. Items are [name, cardName, reason, cardReason].
  // ---------------------------------------------------------------------------
  {
    channel: 'haru',
    slug: '06-manual-unread-appliances',
    pillar: 'daily_health_choices',
    lane: 'practical_life_common_sense',
    angle: '집에 있는 기계는 고장 나서 바꾸는 게 아니라, 있는 기능을 모른 채로 반만 쓰다 바뀐다.',
    topicKey: 'unused_appliance_functions',
    card: {
      hook: '설명서를 안 봐서 평생 반만 쓰고 버리는 물건 5',
      sub: '고장 나서가 아니라 몰라서 바꾸는 거예요',
      visualProfile: 'broadcast_countdown',
      mood: '주방 선반에 나란히 놓인 전기밥솥과 전자레인지, 그 옆에 접힌 설명서와 리모컨, 따뜻한 오후 빛, 크림색과 짙은 남색 팔레트, 매트한 가전 질감',
      bgm: 'light warm piano with soft marimba, curious and friendly mood',
      script: '있는 기능부터 꺼내 써요.',
      desc: '설명서를 안 봐서 반만 쓰는 물건을 정리했어요.',
      comment: '집에 있는 기계는 고장 나서가 아니라 있는 기능을 모른 채로 바뀌는 경우가 많아요. 오늘 저녁에 버튼 하나만 눌러 봐도 새로 산 기분이 들어요. 구독하시고 성분과 몸의 원리를 쉽게 이해하는 건강 정보를 받아보세요.',
      tags: ['건강정보', '시니어건강', '생활상식'],
      items: [
        ['전기밥솥의 백미 말고 다른 버튼', '밥솥의 백미 말고 다른 버튼', '잡곡과 찜 버튼이 따로 있는데 평생 백미 하나만 누르고 지내요', '잡곡과 찜 버튼이 따로 있는데 평생 백미만 눌러요'],
        ['세탁기의 통세척 코스', '세탁기의 통세척 코스', '빨래에서 냄새가 나는 건 옷이 아니라 안 돌린 통세척 때문이에요', '빨래 냄새는 옷이 아니라 안 씻은 세탁조 때문이에요'],
        ['전자레인지의 해동 버튼', '전자레인지의 해동 버튼', '해동 버튼 대신 시간만 돌리니까 겉은 익고 속은 얼어 있어요', '해동 버튼 대신 시간만 돌리면 겉은 익고 속은 얼어요'],
        ['냉장고의 냉기 조절 다이얼', '냉장고의 냉기 조절 다이얼', '여름과 겨울에 같은 세기로 두면 얼거나 무르는 칸이 생겨요', '여름과 겨울을 같은 세기로 두면 얼거나 무르는 칸이 생겨요'],
        ['리모컨의 안 눌러본 버튼', '리모컨의 안 눌러본 버튼', '글씨를 키우거나 소리를 또렷하게 하는 버튼이 대개 들어 있어요', '자막 글씨를 키우는 버튼이 리모컨에 대개 들어 있어요'],
      ],
    },
  },

  {
    channel: 'haru',
    slug: '07-clinic-visit-prep',
    pillar: 'medicine_literacy',
    lane: 'daily_health_lifestyle',
    angle: '진료 시간이 짧은 게 아니라, 준비 없이 들어가서 짧게 끝난다.',
    topicKey: 'clinic_visit_preparation',
    card: {
      hook: '가방에 넣어만 가도 진료가 달라지는 것 5',
      sub: '준비 없이 가면 3분이 그냥 지나가거든요',
      visualProfile: 'clinic_checklist',
      mood: '현관 앞 탁자에 놓인 손가방과 약봉지, 수첩과 안경, 나가기 직전의 밝은 아침 빛, 크림색과 부드러운 청록 팔레트, 종이와 천 질감',
      bgm: 'calm clear piano with light strings, prepared and steady morning mood',
      script: '들어가기 전에 챙길 것부터요.',
      desc: '병원 갈 때 챙겨가면 진료가 빨라지는 것을 정리했어요.',
      comment: '진료 시간이 짧은 게 아니라 준비 없이 들어가서 짧게 끝나요. 약봉지와 메모 한 장만 챙겨도 물어볼 걸 다 물어보고 나올 수 있어요. 구독하시고 성분과 몸의 원리를 쉽게 이해하는 건강 정보를 받아보세요.',
      tags: ['건강정보', '시니어건강', '병원이용'],
      items: [
        ['먹는 약을 봉지째', '먹는 약을 봉지째', '이름을 외워 가려다 결국 못 대니까 봉지째 들고 가는 게 빨라요', '약 이름을 외워 가려다 못 대니 봉지째 들고 가요'],
        ['언제부터인지 적은 메모', '언제부터인지 적은 메모', '언제부터냐는 질문에 헤매느라 정작 할 말을 못 하고 나와요', '언제부터 아팠는지 헤매다 할 말을 못 하고 나와요'],
        ['증상이 있을 때 찍은 사진', '증상이 있을 때 찍은 사진', '붓기나 발진은 병원 갈 때쯤 가라앉아서 말로만 남게 돼요', '붓기나 발진은 병원 갈 때쯤이면 가라앉아 있어요'],
        ['다른 병원에서 받은 검사지', '다른 병원에서 받은 검사지', '가지고 가면 같은 검사를 처음부터 다시 하지 않아도 돼요', '검사지를 가져가면 같은 검사를 또 받지 않아도 돼요'],
        ['물어볼 것 세 가지', '물어볼 것 세 가지', '진료실에 들어가면 이상하게 궁금하던 게 하나도 생각이 안 나요', '진료실에 들어가면 궁금하던 게 하나도 생각이 안 나요'],
      ],
    },
  },

  {
    channel: 'haru',
    slug: '08-freezer-tastes-better',
    pillar: 'nutrition_food_choices',
    lane: 'food_nutrition_table',
    angle: '냉동실은 오래 두려고 넣는 곳인 줄 알지만, 넣었다 꺼내야 제맛이 나는 것도 있다.',
    topicKey: 'freezer_improves_food',
    card: {
      hook: '두부를 왜 얼리나 했는데, 얼리면 맛이 사는 것 5',
      sub: '냉동실은 오래 두려고만 쓰는 칸이 아니거든요',
      visualProfile: 'kitchen_table',
      mood: '열린 냉동실 서랍 안에 가지런히 담긴 유리통과 종이봉투, 하얀 냉기와 따뜻한 주방 조명이 만나는 장면, 크림색과 맑은 하늘색 팔레트, 성에 질감',
      bgm: 'bright gentle piano with soft bells, light and pleasant kitchen mood',
      script: '냉동실은 맛을 살리는 칸이에요.',
      desc: '냉동실에 넣으면 오히려 맛이 사는 것을 정리했어요.',
      comment: '냉동실은 오래 두려고만 넣는 칸이 아니에요. 얼렸다 꺼내야 제맛이 나는 것들이 있어서 알고 나면 자리부터 달라져요. 구독하시고 성분과 몸의 원리를 쉽게 이해하는 건강 정보를 받아보세요.',
      tags: ['건강정보', '시니어건강', '주방살림'],
      items: [
        ['두부', '두부', '얼렸다 녹이면 물이 빠지면서 씹는 맛이 고기처럼 쫄깃해져요', '얼렸다 녹인 두부는 물이 빠져서 고기처럼 쫄깃해요'],
        ['익은 바나나', '익은 바나나', '무르기 전에 얼려 두면 갈아서 그대로 아이스크림처럼 먹어요', '까매지기 직전 바나나를 얼려 뒀다 갈아 드세요'],
        ['식빵', '식빵', '상온에 두면 금방 마르지만 얼려 두면 구울 때마다 갓 산 맛이에요', '상온에 둔 식빵은 금방 마르고, 얼린 건 구울 때마다 갓 산 맛이에요'],
        ['다져 둔 대파와 마늘', '다져 둔 대파와 마늘', '한 번에 다져 얼려 두면 필요할 때 숟가락으로 떠서 바로 써요', '한 번에 다져 얼려 두고 쓸 때마다 숟가락으로 떠서 써요'],
        ['국물용 멸치와 다시마', '국물용 멸치와 다시마', '상온에 두면 눅눅해지고 비린내가 나는데 얼려 두면 맛이 그대로예요', '상온에 둔 멸치는 눅눅해지고 비린내까지 나거든요'],
      ],
    },
  },

  {
    channel: 'longevity',
    slug: '06-boundaries-with-children',
    pillar: 'daily_function',
    lane: 'senior_life_relationship',
    angle: '자식과 틀어지는 건 큰일 때문이 아니라, 정해두지 않은 작은 선들이 쌓여서다.',
    topicKey: 'boundaries_with_grown_children',
    card: {
      hook: '자식과 멀어지고 후회하기 전에 정해둘 선 5',
      sub: '큰일이 아니라 작은 것들이 쌓여서 멀어지거든요',
      visualProfile: 'magazine_cover',
      mood: '거실 창가 탁자에 놓인 찻잔 두 개와 반쯤 접힌 신문, 늦은 오후의 낮은 햇살, 따뜻한 베이지와 짙은 갈색 팔레트, 원목과 리넨 질감',
      bgm: 'warm calm piano with soft cello, gentle and dignified mood',
      script: '서운해지기 전에 정해 둬요.',
      desc: '자식한테 서운해지기 전에 미리 정해둘 선을 정리했어요.',
      comment: '자식과 틀어지는 건 큰일 때문이 아니라 정해두지 않은 작은 것들이 쌓여서예요. 미리 정해두면 서운할 일 자체가 줄어들어요. 구독하시고 건강한 노년을 지키는 습관을 함께 이어가요.',
      tags: ['건강정보', '시니어건강', '노후생활'],
      items: [
        ['전화 횟수를 세지 않기', '전화 횟수를 세지 않기', '먼저 안 했다고 세기 시작하면 통화 자체가 숙제처럼 변해요', '전화 횟수를 세기 시작하면 통화가 부담스러워져요'],
        ['말을 며느리나 사위 편에 전하지 않기', '며느리나 사위 편에 말 전하기', '건너 전한 말은 뜻이 달라져서 결국 두 사람 사이가 어색해져요', '며느리나 사위를 거쳐 전한 말은 뜻이 달라져요'],
        ['돈은 빌려주지 말고 줄 만큼만 주기', '빌려주는 것으로 하기', '돌려받을 생각으로 주면 액수보다 기다리는 마음이 사람을 상하게 해요', '돌려받기를 기다리는 동안 사이가 더 상해요'],
        ['손주는 맡는 게 아니라 돕는 것으로', '손주를 통째로 맡아 주기', '한 번 맡으면 당연해져서 나중에 거절할 자리가 없어져요', '한 번 맡으면 당연해져서 나중에 거절하기 어려워요'],
        ['오는 날짜를 내가 못 박지 않기', '오는 날짜를 못 박기', '날짜를 정해 두면 오는 게 반가움이 아니라 확인이 되어 버려요', '오는 날짜를 정해 두면 반가움이 아니라 확인이 돼요'],
      ],
    },
  },

  {
    channel: 'longevity',
    slug: '07-bank-trip-prep',
    pillar: 'daily_function',
    lane: 'money_smart_living',
    angle: '은행에서 헛걸음하는 건 절차가 복잡해서가 아니라, 집에 두고 온 것 하나 때문이다.',
    topicKey: 'bank_errand_preparation',
    card: {
      hook: '은행 갈 때 그냥 가면 두 번 걸음 하는 것 5',
      sub: '집에 두고 온 것 하나 때문이에요',
      visualProfile: 'calendar_streak',
      mood: '현관 신발장 위에 놓인 지갑과 신분증, 통장과 도장, 나가기 직전의 맑은 아침 빛, 크림색과 차분한 남색 팔레트, 가죽과 종이 질감',
      bgm: 'light steady piano with soft acoustic guitar, brisk and tidy morning mood',
      script: '나가기 전에 지갑부터 열어요.',
      desc: '은행 갈 때 두 번 걸음 하게 되는 것을 정리했어요.',
      comment: '은행에서 헛걸음하는 건 절차가 복잡해서가 아니라 집에 두고 온 것 하나 때문이에요. 나가기 전에 지갑만 한 번 열어 봐도 걸음을 아껴요. 구독하시고 건강한 노년을 지키는 습관을 함께 이어가요.',
      tags: ['건강정보', '시니어건강', '생활정보'],
      items: [
        ['기한이 지난 신분증', '기한이 지난 신분증', '가지고 갔어도 기한이 지나 있으면 그 자리에서 다시 돌아와야 해요', '신분증 기한이 지나 있으면 그 자리에서 돌아와야 해요'],
        ['가족 일인데 위임장 없이 가기', '가족 일에 위임장 없이 가기', '자식이나 배우자 일은 본인이 아니면 서류가 따로 있어야 처리돼요', '자식이나 배우자 일은 위임장이 있어야 처리돼요'],
        ['오래돼서 안 맞는 도장', '계좌에 등록한 것과 다른 도장', '만들 때 쓴 도장이 아니면 다시 등록부터 해야 해서 시간이 갑절이에요', '계좌 만들 때 쓴 도장이 아니면 등록부터 다시 해야 해요'],
        ['보안카드나 기계를 두고 가기', '보안카드를 두고 가기', '인터넷으로 쓰던 것을 창구에서 바꾸려면 그 물건이 있어야 해요', '보안카드는 창구에서 바꿀 때도 손에 있어야 해요'],
        ['점심시간에 맞춰 가기', '점심시간에 맞춰 가기', '직원이 번갈아 식사하는 시간이라 창구가 줄고 대기가 길어져요', '직원이 번갈아 식사해서 점심에는 창구가 줄어들어요'],
      ],
    },
  },

  {
    channel: 'longevity',
    slug: '08-holiday-food-waste',
    pillar: 'longevity_meals',
    lane: 'food_nutrition_table',
    angle: '명절 선물은 받을 때 반갑고 두 달 뒤에 버리게 되는 것들이 정해져 있다.',
    topicKey: 'holiday_gift_food_waste',
    card: {
      hook: '명절에 사 오면 끝까지 안 먹고 버리는 것 5',
      sub: '받을 땐 반갑고 두 달 뒤에 버려요',
      visualProfile: 'market_receipt',
      mood: '거실 한쪽에 쌓인 명절 선물 상자와 아직 안 뜯은 포장, 창으로 들어오는 오후 빛, 따뜻한 베이지와 붉은 갈색 팔레트, 골판지와 보자기 질감',
      bgm: 'warm gentle piano with soft plucked strings, calm and homely mood',
      script: '명절 상자부터 다시 봐요.',
      desc: '명절에 사 오면 끝까지 안 먹고 버리는 것을 정리했어요.',
      comment: '명절 선물은 받을 때 반갑고 두 달 뒤에 버리게 되는 것이 정해져 있어요. 큰 통 하나보다 작은 것 여러 개가 끝까지 먹게 돼요. 구독하시고 건강한 노년을 지키는 습관을 함께 이어가요.',
      tags: ['건강정보', '시니어건강', '장보기'],
      items: [
        ['큰 통으로 든 기름 세트', '큰 통으로 든 기름 세트', '두 식구가 큰 통을 다 쓰기 전에 냄새부터 변해서 결국 버리게 돼요', '큰 통은 다 쓰기도 전에 냄새부터 변해 버려요'],
        ['통조림 여러 개 묶음', '통조림 여러 개 묶음', '한두 개만 뜯고 나머지는 찬장 안쪽에서 기한을 넘겨요', '한두 개만 뜯고 나머지는 찬장 안쪽에서 기한을 넘겨요'],
        ['대용량 건강즙 상자', '대용량 건강즙 상자', '처음 며칠만 챙겨 먹고 상자째 베란다로 밀려나기 쉬워요', '처음 며칠만 먹고 상자째 베란다로 밀려나요'],
        ['박스째 들어온 과일', '박스째 들어온 과일', '아래쪽이 눌린 채로 며칠 지나면 한 번에 물러서 반은 못 먹어요', '박스 아래쪽 과일이 눌려서 한 번에 물러 버려요'],
        ['한가득 받은 떡', '한가득 받은 떡', '그날 다 못 먹고 상온에 두면 다음 날 딱딱해져서 손이 안 가요', '그날 못 먹은 떡은 다음 날 딱딱해져서 손이 안 가요'],
      ],
    },
  },

  // ---------------------------------------------------------------------------
  // Ranking and versus packs. The draw is that the card settles the question
  // instead of hedging, so the subtitle always states the basis the order is
  // built on — an order with no stated basis reads as arbitrary and invites
  // "왜 그게 1위야" with no answer.
  // ---------------------------------------------------------------------------
  {
    channel: 'haru',
    // 90-series: the user plans to produce these themselves with an image model,
    // so they sort behind everything else. If their version publishes first, the
    // duplicate guard skips the queued copy automatically.
    slug: '90-summer-spoils-first',
    pillar: 'nutrition_food_choices',
    lane: 'food_nutrition_table',
    angle: '여름에 상하는 순서는 값이나 종류가 아니라 물기와 양념에서 갈린다.',
    topicKey: 'summer_spoilage_order',
    card: {
      hook: '여름에 먼저 상하는 순서 5',
      sub: '물기와 양념이 많은 순서예요',
      visualProfile: 'market_receipt',
      mood: '여름 부엌 조리대에 놓인 자른 수박과 반찬통, 창밖의 뜨거운 햇빛과 서늘한 실내가 대비되는 장면, 크림색과 시원한 청록 팔레트, 물기 맺힌 유리 질감',
      bgm: 'light calm piano with soft strings, cool and steady summer mood',
      script: '여름엔 상하는 순서가 정해져 있어요.',
      desc: '여름에 먼저 상하는 순서를 정리했어요.',
      comment: '여름에 상하는 순서는 물기와 양념에서 갈려요. 자른 과일과 무친 나물부터 챙기면 버리는 게 확 줄어요. 구독하시고 성분과 몸의 원리를 쉽게 이해하는 건강 정보를 받아보세요.',
      tags: ['건강정보', '시니어건강', '식품보관'],
      items: [
        ['자른 수박과 참외', '자른 수박과 참외', '자른 단면에 물기가 그대로 드러나서 제일 먼저 쉬어요', '자른 단면에 물기가 드러나 제일 먼저 쉬어요'],
        ['무쳐 놓은 나물 반찬', '무쳐 놓은 나물 반찬', '양념이 묻은 나물은 상온에서 반나절이면 시큼해져요', '양념 묻은 나물은 반나절이면 시큼해져요'],
        ['한 번 끓인 국과 찌개', '한 번 끓인 국과 찌개', '끓였다고 안심하고 상온에 두면 그날 저녁에 쉬어요', '끓였어도 상온에 두면 그날 저녁에 쉬어요'],
        ['뚜껑 딴 우유와 두유', '뚜껑 딴 우유와 두유', '뚜껑을 딴 뒤로는 냉장고 문 칸 온도로도 버티기 어려워요', '뚜껑 딴 뒤로는 문 칸 온도로도 못 버텨요'],
        ['지어 놓은 밥', '지어 놓은 밥', '밥은 물기가 적어 제일 늦게 상하지만 하루면 냄새가 나요', '제일 늦게 상해도 하루 지나면 냄새가 나요'],
      ],
    },
  },

  {
    channel: 'haru',
    slug: '91-same-price-better-pick',
    pillar: 'daily_health_choices',
    lane: 'practical_life_common_sense',
    angle: '같은 값에 놓인 두 물건은 오래 쓰는 쪽과 금방 버리는 쪽으로 갈린다.',
    topicKey: 'same_price_better_choice',
    card: {
      hook: '같은 값이면 무조건 이쪽이 나은 것 5',
      sub: '오래 쓰는 쪽을 기준으로 골랐어요',
      visualProfile: 'myth_fact',
      mood: '마트 진열대 앞에 나란히 놓인 두 가지 물건과 가격표, 밝고 균일한 매장 조명, 크림색과 선명한 남색 팔레트, 종이 가격표 질감',
      bgm: 'bright light piano with soft plucked strings, clear and decisive mood',
      script: '같은 값이면 고를 쪽이 정해져 있어요.',
      desc: '같은 값이면 어느 쪽이 나은지 정리했어요.',
      comment: '값이 같을 때는 오래 쓰는 쪽이 정해져 있어요. 다음 장 볼 때 이 다섯 가지만 기억하셔도 돈이 덜 나가요. 구독하시고 성분과 몸의 원리를 쉽게 이해하는 건강 정보를 받아보세요.',
      tags: ['건강정보', '시니어건강', '생활상식'],
      items: [
        ['얇은 도마보다 두꺼운 도마', '두꺼운 도마', '얇은 도마는 휘어서 칼자국 사이에 물이 고여 냄새가 배요', '얇은 건 휘어서 칼자국에 물이 고여요'],
        ['좁은 손잡이보다 넓은 손잡이', '넓은 손잡이', '손아귀 힘이 줄어드는 나이에는 넓은 손잡이가 훨씬 안전해요', '손아귀 힘이 줄면 넓은 쪽이 안전해요'],
        ['미끄러운 바닥보다 고무 바닥', '고무 바닥 신발', '욕실 슬리퍼는 바닥 무늬가 굵고 고무인 쪽이 덜 미끄러워요', '바닥 무늬가 굵은 고무가 덜 미끄러워요'],
        ['얇은 유리컵보다 두꺼운 컵', '두꺼운 컵', '얇은 컵은 뜨거운 물을 부을 때 금이 가기 쉬워요', '얇은 컵은 뜨거운 물에 금이 잘 가요'],
        ['작은 글씨보다 큰 글씨 표시', '큰 글씨 표시', '눈금이나 버튼 글씨가 큰 쪽은 불 켜지 않고도 읽을 수 있어요', '글씨 큰 쪽은 불 안 켜고도 읽어요'],
      ],
    },
  },

  {
    channel: 'longevity',
    slug: '90-fridge-shelf-assignments',
    pillar: 'daily_function',
    lane: 'home_kitchen_living',
    angle: '냉장고는 칸마다 온도가 달라서 넣을 자리가 정해져 있다.',
    topicKey: 'fridge_shelf_assignment',
    card: {
      hook: '냉장고 칸마다 정해진 자리 5',
      sub: '칸마다 온도가 달라서 자리가 갈려요',
      visualProfile: 'clinic_checklist',
      mood: '문을 연 냉장고 안 선반들이 위아래로 보이는 장면, 칸마다 다른 음식이 정리된 모습, 차가운 흰빛과 크림색 팔레트, 유리 선반 질감',
      bgm: 'calm clean piano with light bells, tidy and orderly mood',
      script: '냉장고는 칸마다 자리가 달라요.',
      desc: '냉장고 칸마다 정해진 자리를 정리했어요.',
      comment: '냉장고는 칸마다 온도가 달라서 넣을 자리가 정해져 있어요. 자리만 바꿔도 버리는 음식이 줄어들어요. 구독하시고 건강한 노년을 지키는 습관을 함께 이어가요.',
      tags: ['건강정보', '시니어건강', '주방살림'],
      items: [
        ['문 칸에는 잘 안 상하는 것만', '문 칸', '여닫을 때마다 온도가 오르내려서 우유를 두기에는 위험해요', '여닫을 때마다 온도가 오르내리는 자리예요'],
        ['맨 위 칸에는 바로 먹을 것', '맨 위 칸', '눈에 바로 들어오는 자리라 남은 음식과 먹을 반찬을 둬요', '눈에 바로 들어와서 남은 음식 자리예요'],
        ['가운데 칸에는 달걀', '가운데 칸', '달걀은 온도가 일정한 가운데 칸이 제자리예요', '온도가 일정해서 달걀 제자리예요'],
        ['맨 아래 칸에는 고기와 생선', '맨 아래 칸', '핏물이 떨어져도 아래 칸이면 다른 음식에 닿지 않아요', '핏물이 떨어져도 다른 데 안 닿아요'],
        ['채소 칸에는 물기를 닦고', '채소 칸', '젖은 채로 넣은 채소는 서로 닿은 자리부터 무르기 시작해요', '젖은 채 넣으면 닿은 자리부터 물러요'],
      ],
    },
  },

  {
    channel: 'longevity',
    slug: '91-spending-order-after-fifty',
    pillar: 'daily_function',
    lane: 'money_smart_living',
    angle: '나이 들어 돈을 쓰는 순서는 몸이 매일 닿는 것부터로 바뀌어야 한다.',
    topicKey: 'spending_priority_after_fifty',
    card: {
      hook: '나이 들수록 돈 쓰는 순서를 바꿔야 할 것 5',
      sub: '몸이 매일 닿는 것부터 순서를 잡았어요',
      visualProfile: 'calendar_streak',
      mood: '현관에 놓인 편한 신발과 그 옆의 안경집, 창으로 들어오는 차분한 낮 빛, 따뜻한 베이지와 짙은 청색 팔레트, 가죽과 원목 질감',
      bgm: 'warm steady piano with soft cello, calm and grounded mood',
      script: '돈은 몸에 닿는 것부터 써요.',
      desc: '나이 들수록 돈 쓰는 순서를 정리했어요.',
      comment: '돈 쓰는 순서는 몸이 매일 닿는 것부터로 바꾸는 편이 좋아요. 신발과 안경을 미루면 결국 더 큰 돈이 나가요. 구독하시고 건강한 노년을 지키는 습관을 함께 이어가요.',
      tags: ['건강정보', '시니어건강', '노후생활'],
      items: [
        ['신발이 첫 번째', '신발', '하루 종일 몸무게를 받는 물건이라 제일 먼저 좋은 걸로 바꿔요', '하루 종일 몸무게를 받는 물건이거든요'],
        ['안경이 두 번째', '안경', '도수가 안 맞는 안경을 버티면 눈과 어깨가 같이 피곤해져요', '안 맞는 걸 버티면 눈과 어깨가 피곤해요'],
        ['베개와 매트리스가 세 번째', '베개와 매트리스', '하루 여섯 시간을 닿아 있는 물건인데 제일 오래 미뤄요', '여섯 시간을 닿는데 제일 오래 미뤄요'],
        ['조명은 네 번째', '집 안 조명', '어두운 계단과 욕실 조명은 넘어지는 값에 비하면 싼 편이에요', '어두운 계단은 넘어지는 값이 더 커요'],
        ['큰 가전은 마지막', '큰 가전', '멀쩡히 돌아가는 냉장고와 세탁기는 급할 때 바꿔도 늦지 않아요', '멀쩡히 돌아가면 급할 때 바꿔도 돼요'],
      ],
    },
  },

  // A by-interval card is not a ranking, so labelMode turns off the N위 numbering.
  {
    channel: 'longevity',
    slug: '92-replacement-intervals',
    pillar: 'daily_function',
    lane: 'household_saving_tricks',
    angle: '집안 물건은 고장 나서 바꾸는 게 아니라 바꿀 때를 몰라서 계속 쓴다.',
    topicKey: 'household_replacement_intervals',
    card: {
      hook: '고장 안 나도 바꿀 때가 정해진 것 5',
      sub: '고장 안 나도 바꿔야 하는 것들이에요',
      visualProfile: 'calendar_streak',
      mood: '욕실 선반과 주방 개수대에 놓인 칫솔과 수세미, 개어 둔 수건이 함께 보이는 정갈한 장면, 크림색과 맑은 민트 팔레트, 면과 플라스틱 질감',
      bgm: 'light clean piano with soft bells, tidy and refreshing mood',
      labelMode: 'none',
      script: '바꿀 때를 정해 드릴게요.',
      desc: '집안 물건을 얼마나 자주 바꿔야 하는지 정리했어요.',
      comment: '집안 물건은 고장 나서 바꾸는 게 아니라 바꿀 때를 몰라서 계속 쓰게 돼요. 오늘 하나만 정해 두셔도 다음부터 훨씬 편해져요. 구독하시고 건강한 노년을 지키는 습관을 함께 이어가요.',
      tags: ['건강정보', '시니어건강', '살림정보'],
      items: [
        ['칫솔은 석 달', '칫솔 - 석 달', '석 달을 넘기지 않되 솔이 옆으로 눕기 시작하면 그 전에 바꿔요', '솔이 옆으로 눕기 시작하면 그 전에 바꿔요'],
        ['수세미는 한 달', '수세미 - 한 달', '기름때가 밴 수세미는 아무리 헹궈도 냄새가 남아요', '기름때가 배면 헹궈도 냄새가 남거든요'],
        ['행주는 하루', '행주 - 하루', '하루만 지나도 젖은 채로 둔 행주에서는 쉰내가 올라와요', '젖은 채 하루만 지나도 쉰내가 올라와요'],
        ['베개는 두어 해', '베개 - 두어 해', '속이 눌려 납작해진 베개는 목이 꺾인 자세로 자게 만들어요', '납작해진 베개는 목이 꺾인 채로 자게 해요'],
        ['욕실 슬리퍼는 한 해', '욕실 슬리퍼 - 한 해', '바닥 무늬가 닳아 매끈해진 슬리퍼는 젖은 바닥에서 미끄러져요', '바닥 무늬가 닳으면 젖은 데서 미끄러져요'],
      ],
    },
  },

];

function expand(pack) {
  const channel = CHANNELS[pack.channel];
  // An evidence-backed pack carries `sources` + `facts`; a plain everyday pack
  // carries neither and its card items are written as [name, cardName, reason, cardReason].
  const grounded = Boolean(pack.sources?.length && pack.facts?.length);
  const items = pack.card.items.map((item) => (grounded
    ? { factId: item[0], sourceIds: item[1], name: item[2], cardName: item[3], reason: item[4], cardReason: item[5] }
    : { factId: null, sourceIds: [], name: item[0], cardName: item[1], reason: item[2], cardReason: item[3] }));

  if (grounded) {
    const factById = new Map(pack.facts.map((f) => [f[0], f]));
    const usedFacts = new Set();
    for (const item of items) {
      if (!factById.has(item.factId)) throw new Error(`${pack.slug}: card item cites unknown fact ${item.factId}`);
      // One fact per item: splitting a single finding across two ranks is padding.
      if (usedFacts.has(item.factId)) throw new Error(`${pack.slug}: fact ${item.factId} is used by more than one ranked item`);
      usedFacts.add(item.factId);
    }
  }
  for (const item of items) {
    if (!item.name || !item.cardName || !item.reason || !item.cardReason) {
      throw new Error(`${pack.slug}: a ranked item is missing visible copy`);
    }
  }
  if (!pack.topicKey) throw new Error(`${pack.slug}: topicKey is required for cross-channel duplicate detection`);
  if (!pack.card.mood) throw new Error(`${pack.slug}: card.mood is required or the image falls back to a flat layout`);
  if (!pack.card.visualProfile) throw new Error(`${pack.slug}: card.visualProfile is required to keep the design on-brand`);
  if (items.length < 4 || items.length > 7) throw new Error(`${pack.slug}: ${items.length} items, must be 4-7`);

  const researchSourcePack = grounded ? {
    channel_profile: channel.profile,
    researched_at: '2026-07-21',
    search_queries: pack.queries || [],
    sources: pack.sources.map((s) => ({
      source_id: s.id, title: s.title, publisher: s.publisher, url: s.url,
      published_at: s.published_at || '', source_type: s.source_type,
    })),
    candidate_facts: pack.facts.map(([id, sids, claim, evidence, why, relevance, decision, condition, limit, confidence]) => ({
      fact_id: id, claim, source_ids: sids, evidence_summary: evidence,
      why_interesting: why, viewer_relevance: relevance, viewer_decision: decision,
      necessary_condition: condition, limitation_or_boundary: limit, confidence,
    })),
    selected_angle: pack.angle,
    rejected_angles: pack.rejected || [],
  } : null;

  return {
    title: pack.card.hook,
    lane: pack.lane,
    notes: pack.angle,
    ...(researchSourcePack ? { research_source_pack: researchSourcePack } : {}),
    topic_key: pack.topicKey,
    final_pack: {
      channel_editorial_profile: channel.profile,
      channel_content_pillar: pack.pillar,
      topic_key: pack.topicKey,
      hook_title: pack.card.hook,
      subtitle: pack.card.sub,
      visual_profile: pack.card.visualProfile,
      visual_mood_hint: pack.card.mood,
      // 'rank' numbers the rows 1위/2위/…; 'none' drops the numbering for cards
      // that are a list rather than a ranking (this-instead-of-that, by-part,
      // by-shelf). Numbering a non-ranking makes the card claim an order it
      // does not have.
      ...(pack.card.labelMode ? { rank_label_mode: pack.card.labelMode } : {}),
      rank_items: items.map((item, index) => ({
        rank: index + 1,
        ...(grounded ? { fact_id: item.factId, source_ids: item.sourceIds } : {}),
        name: item.name, card_name: item.cardName, reason: item.reason, card_reason: item.cardReason,
      })),
      video_script: pack.card.script,
      description: pack.card.desc,
      pinned_comment: pack.card.comment,
      tags: pack.card.tags,
      bgm_prompt: pack.card.bgm,
    },
  };
}

export function buildAll() {
  return PACKS.map((pack) => ({
    channel: pack.channel,
    dir: CHANNELS[pack.channel].dir,
    slug: pack.slug,
    content: expand(pack),
  }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.slice(1))) {
  const built = buildAll();
  for (const entry of built) {
    const dir = path.join(outDir, entry.dir);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${entry.slug}.json`), JSON.stringify(entry.content, null, 2) + '\n', 'utf8');
  }
  console.log(JSON.stringify({
    ok: true,
    written: built.length,
    byChannel: built.reduce((acc, e) => ({ ...acc, [e.dir]: (acc[e.dir] || 0) + 1 }), {}),
    outDir,
  }, null, 2));
}
