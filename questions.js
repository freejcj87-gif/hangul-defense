/* 7~10세 문제은행: 데이터·출제 순서·검사(DOM 없음). 생성 문항은 questions-gen.js(QUESTIONS_GEN)에서 합침 */
(function(root){
  /* 0.11: 듣고 고르기(sound) 모드와 문항은 폐쇄했다(game-plan §10). 모드는 읽고 고르기(story) 하나이고, mode 인자는 호출부 호환용으로만 받는다 */
  const AGES=[7,8,9,10],MODES=['story'];
  const LEVELS={
    7:{story:'낱말과 그림'},
    8:{story:'한 문장 읽기'},
    9:{story:'두 문장 읽기'},
    10:{story:'짧은 글 이해'}
  };
  const WORD_PROMPT='낱말을 읽고 알맞은 그림을 찾아주세요';

  /* story 7세 [낱말, 그림 보기, answer] · 8~10세 [지문, 질문, 보기, answer](오답 하나 이상은 지문 속 말).
     0.12 생성 문항(questions-gen.js): 7세는 그림 → 낱말(지문이 그림, 보기가 낱말)도 있고, 9·10세는 한 지문에 질문 여러 개(문항은 질문마다 따로) */
  const DATA={7:{},8:{},9:{},10:{}};

  DATA[7].story=[
    ['나무',['🌳','🦋','🍄'],0],
    ['사과',['🍌','🍎','🍇'],1],
    ['오이',['🥕','🦆','🥒'],2],
    ['바나나',['🍓','🍌','🍉'],1],
    ['포도',['🍇','🍑','🍋'],0],
    ['고구마',['🌽','🥕','🍠'],2],
    ['나비',['🦋','🐝','🐞'],0],
    ['여우',['🐻','🦊','🐰'],1],
    ['바지',['👟','👕','👖'],2],
    ['기차',['🚂','🚌','🚲'],0],
    ['우유',['🍞','🥛','🧀'],1],
    ['피자',['🍰','🍪','🍕'],2],
    ['오리',['🦆','🐔','🦉'],0],
    ['바다',['🌈','🌊','🌙'],1],
    ['토마토',['🍒','🍑','🍅'],2],
    ['개미',['🐜','🐌','🐛'],0]
  ];

  DATA[8].story=[
    ['꼬꼬가 마당에서 모이를 먹어요.','꼬꼬는 어디에서 모이를 먹나요?',['마당','모이','지붕'],0],
    ['농부가 밭에 씨앗을 심었어요.','농부가 심은 것은 무엇인가요?',['밭','씨앗','꽃'],1],
    ['병아리가 오리를 따라 걸어요.','병아리는 누구를 따라 걷나요?',['병아리','엄마','오리'],2],
    ['늑대가 언덕에서 낮잠을 자요.','누가 낮잠을 자나요?',['늑대','꼬꼬','언덕'],0],
    ['오리는 저녁마다 노래를 불러요.','오리는 언제 노래를 부르나요?',['노래','저녁마다','아침마다'],1],
    ['아이가 강에서 물고기를 보았어요.','아이는 어디에서 물고기를 보았나요?',['바다','물고기','강'],2],
    ['토끼가 감자를 맛있게 먹어요.','토끼가 먹는 것은 무엇인가요?',['감자','당근','토끼'],0],
    ['할머니가 울타리를 고쳐 주셨어요.','누가 울타리를 고쳐 주셨나요?',['울타리','아빠','할머니'],2],
    ['병아리 세 마리와 오리 두 마리가 놀아요.','병아리는 몇 마리인가요?',['두 마리','세 마리','네 마리'],1],
    ['가을에 마을 나무에 빨간 감이 열렸어요.','나무에 무엇이 열렸나요?',['감','밤','마을'],0],
    ['꼬꼬는 타워 위에서 마을을 지켜요.','꼬꼬는 어디에서 마을을 지키나요?',['울타리 뒤','타워 위','꼬꼬'],1],
    ['동생이 우유를 한 컵 마셨어요.','동생이 마신 것은 무엇인가요?',['동생','주스','우유'],2],
    ['봄에 마을에 하얀 꽃잎이 내려요.','꽃잎은 언제 내리나요?',['봄','겨울','마을'],0],
    ['고양이가 지붕 위에서 하품을 해요.','고양이는 어디에 있나요?',['하품','지붕 위','방 안'],1]
  ];

  DATA[9].story=[
    ['꼬꼬는 아침 일찍 일어나 마당을 쓸었어요.\n그다음에 병아리들에게 모이를 나누어 주었어요.','꼬꼬가 마당을 쓴 다음에 한 일은 무엇인가요?',['모이를 나누어 주었어요','마당을 쓸었어요','아침 일찍 일어났어요','울타리를 고쳐 주었어요'],0],
    ['농부 아저씨가 밭에서 당근을 뽑았어요.\n당근을 바구니에 담아 염소네 집에 가져다주었어요.','농부 아저씨는 당근을 어디에 가져다주었나요?',['밭','염소네 집','토끼네 집','창고'],1],
    ['바람이 세게 불어서 울타리가 넘어졌어요.\n마을 친구들이 모두 나와 울타리를 다시 세웠어요.','울타리는 왜 넘어졌나요?',['비가 많이 내려서','친구들이 세게 밀어서','바람이 세게 불어서','늑대가 세게 밀어서'],2],
    ['병아리 삐삐는 노란 장화를 신고 밖으로 나갔어요.\n물웅덩이에서 첨벙첨벙 뛰며 놀았어요.','삐삐는 어디에서 놀았나요?',['모래 언덕','장화 속','풀밭 가운데','물웅덩이'],3],
    ['늑대는 배가 고파서 마을에 내려왔어요.\n꼬꼬가 따뜻한 옥수수죽을 나누어 주자 늑대는 고맙다고 인사했어요.','꼬꼬가 늑대에게 나누어 준 것은 무엇인가요?',['감자죽','옥수수죽','호박죽','따뜻한 물'],1],
    ['오늘은 마을 장터가 열리는 날이에요.\n꼬꼬는 달걀을 팔아서 빨간 목도리를 샀어요.','꼬꼬는 장터에서 무엇을 샀나요?',['달걀','빨간 장갑','빨간 목도리','노란 목도리'],2],
    ['여름밤에 반딧불이가 반짝반짝 날아다녔어요.\n병아리들은 그 불빛을 따라 풀밭을 걸었어요.','병아리들은 무엇을 따라 걸었나요?',['반딧불이 불빛','풀밭 옆 개울','마을 등불 불빛','둥근 달님 불빛'],0],
    ['가을이 되자 밤나무에서 밤이 떨어졌어요.\n다람쥐는 밤을 주워 나무 구멍에 모아 두었어요.','다람쥐는 밤을 어디에 모아 두었나요?',['밤나무 아래','바위 틈','땅속 굴','나무 구멍'],3],
    ['꼬꼬는 타워 꼭대기에 올라가 종을 쳤어요.\n종소리를 듣고 친구들이 광장으로 모였어요.','친구들은 무엇을 듣고 모였나요?',['꼬꼬의 노랫소리','종소리','북소리','빗소리'],1],
    ['눈이 많이 내린 날 아이들은 눈사람을 만들었어요.\n눈사람에게 당근 코와 단추 눈을 붙여 주었어요.','눈사람의 코는 무엇으로 만들었나요?',['단추','돌멩이','당근','나뭇가지'],2],
    ['할머니는 병아리들에게 옛날이야기를 들려주셨어요.\n이야기가 끝나기도 전에 병아리들은 모두 잠이 들었어요.','병아리들은 언제 잠이 들었나요?',['이야기가 끝나기 전에','할머니가 오시기 전에','이야기가 끝난 뒤에','저녁을 다 먹은 뒤에'],0],
    ['비가 그치자 하늘에 무지개가 떴어요.\n꼬꼬와 병아리는 언덕에 올라가 무지개를 구경했어요.','꼬꼬와 병아리는 어디에서 무지개를 구경했나요?',['지붕','하늘','강가','언덕'],3],
    ['병아리 콩이는 길에 떨어진 모자를 주웠어요.\n모자에 적힌 이름을 보고 주인인 염소 아저씨에게 돌려주었어요.','모자의 주인은 누구인가요?',['콩이','염소 아저씨','농부 아저씨','꼬꼬'],1],
    ['마을 도서관에 새 그림책이 다섯 권 들어왔어요.\n꼬꼬는 그림책을 세 권 빌려서 집으로 갔어요.','꼬꼬는 그림책을 몇 권 빌렸나요?',['한 권','다섯 권','세 권','네 권'],2]
  ];

  DATA[10].story=[
    ['밤새 비가 와서 다리가 물에 잠겼어요.\n꼬꼬는 친구를 만나러 언덕길로 돌아갔어요.\n조금 늦었지만 친구는 반갑게 맞아 주었어요.','꼬꼬는 왜 언덕길로 갔나요?',['다리가 물에 잠겨서','언덕길이 더 짧아서','친구를 만나기 싫어서','비를 피하려고','친구가 이사해서'],0],
    ['꼬꼬는 꽃에 물을 주었어요.\n다음 날 작은 꽃이 활짝 피었어요.\n꼬꼬는 꽃을 보며 기쁘게 노래했어요.','꼬꼬가 꽃을 위해 한 일은 무엇인가요?',['꽃을 꺾었어요','그늘에 숨겼어요','물을 주었어요','꽃을 친구에게 주었어요','물을 마셨어요'],2],
    ['병아리 노랑이는 울타리 옆에 해바라기 씨앗을 심었어요.\n날마다 물을 주고 풀도 뽑아 주었어요.\n여름이 되자 노랑이 키보다 큰 해바라기가 피었어요.\n노랑이는 씨앗을 받아 친구들과 나누었어요.','노랑이가 가장 먼저 한 일은 무엇인가요?',['풀을 뽑았어요','씨앗을 심었어요','씨앗을 나누었어요','물을 주었어요','해바라기를 그렸어요'],1],
    ['늑대 누리는 마을 잔치에 가고 싶었어요.\n하지만 친구들이 무서워할까 봐 문 앞에서 망설였어요.\n꼬꼬가 문을 활짝 열고 어서 오라고 손짓했어요.\n누리의 꼬리가 살랑살랑 흔들렸어요.','꼬리를 흔드는 누리의 마음은 어떠했을까요?',['화가 났어요','망설였어요','배가 고팠어요','기뻤어요','심심했어요'],3],
    ['오늘은 마을 타워를 새로 칠하는 날이에요.\n꼬꼬는 빨간색, 병아리들은 노란색 물감을 들고 왔어요.\n그런데 갑자기 소나기가 내려 물감이 모두 씻겨 내려갔어요.\n친구들은 내일 다시 칠하기로 했어요.','친구들이 내일 다시 칠하기로 한 까닭은 무엇인가요?',['물감이 모두 모자라서','타워가 너무 높아서','물감이 비에 씻겨서','날이 너무 어두워져서','꼬꼬가 갑자기 아파서'],2],
    ['닭은 아침 일찍 일어나 울어요.\n모이를 먹을 때에는 발로 땅을 파헤쳐요.\n밤에는 높은 곳에 올라가 잠을 자요.','이 글은 무엇에 대해 쓴 글인가요?',['닭이 하루를 지내는 모습','닭이 밤에 잠을 자는 곳','닭이 땅을 파헤치는 까닭','닭과 병아리의 다른 점','닭이 아침에 우는 까닭'],0],
    ['농부 아주머니는 마을 잔치에 낼 빵을 만들었어요.\n먼저 밀가루에 달걀과 우유를 넣고 잘 섞었어요.\n그다음 반죽을 틀에 부어 오븐에 넣었어요.\n마지막으로 다 구워진 빵에 꿀을 발랐어요.','반죽을 오븐에 넣은 다음에 한 일은 무엇인가요?',['밀가루를 샀어요','달걀과 우유를 섞었어요','우유를 마셨어요','빵에 꿀을 발랐어요','틀을 깨끗이 씻었어요'],3],
    ['농부 아저씨가 창밖을 보니 먹구름이 몰려오고 있었어요.\n아저씨는 마당에 널어 둔 고추를 서둘러 걷었어요.\n잠시 뒤 지붕 위로 후드득 소리가 들렸어요.','지붕 위에서 난 소리는 무엇일까요?',['비가 내리는 소리','새가 걷는 소리','바람이 부는 소리','고추가 떨어지는 소리','눈이 쌓이는 소리'],0],
    ['병아리 삐약이는 달리기 시합에서 꼴찌를 했어요.\n그래도 넘어진 친구를 일으켜 주고 끝까지 달렸어요.\n마을 친구들은 삐약이에게 가장 큰 박수를 보냈어요.','친구들이 삐약이에게 큰 박수를 보낸 까닭은 무엇인가요?',['달리기 시합에서 일등을 해서','넘어진 친구를 놀려서','가장 빨리 끝까지 달려서','시합에 나가지 않아서','친구를 돕고 끝까지 달려서'],4],
    ['울타리는 마을을 든든하게 지켜 줍니다.\n바람이 세게 불어도 밭의 새싹이 다치지 않게 막아 줍니다.\n또 병아리들이 길을 잃지 않도록 도와줍니다.','이 글에서 가장 중요한 내용은 무엇인가요?',['바람이 밭에 세게 불어옵니다','밭의 새싹은 아주 빨리 자랍니다','울타리는 마을에 도움을 줍니다','병아리는 길을 자주 잃어버립니다','울타리는 나무로 튼튼하게 만듭니다'],2],
    ['가을걷이 날 아침, 마을 친구들이 밭에 모였어요.\n토끼는 고구마를 캐고 다람쥐는 수레에 실었어요.\n꼬꼬는 수레를 끌어 창고로 옮겼어요.\n저녁에는 다 함께 군고구마를 먹었어요.','수레에 실은 고구마는 그다음에 어떻게 되었나요?',['밭에 다시 심었어요','창고로 옮겨졌어요','시장에 팔았어요','강물에 씻었어요','이웃 마을에 보냈어요'],1],
    ['아침에 일어나 보니 마당이 온통 하얗게 변해 있었어요.\n병아리들은 목도리를 두르고 밖으로 뛰어나갔어요.\n발자국이 콕콕 찍힐 때마다 뽀드득 소리가 났어요.','밤사이에 어떤 일이 있었을까요?',['마당에 꽃이 피었어요','비가 왔어요','바람이 불었어요','낙엽이 떨어졌어요','눈이 내렸어요'],4],
    ['꼬꼬는 타워 꼭대기에 작은 등불을 달았어요.\n밤에 길을 잃은 친구가 마을을 찾을 수 있게 하려는 것이었어요.\n그날 밤 길을 헤매던 아기 염소가 불빛을 보고 무사히 돌아왔어요.','꼬꼬가 타워에 등불을 단 까닭은 무엇인가요?',['타워 꼭대기를 예쁘게 꾸미려고','밤에 늦게까지 책을 읽으려고','마을에 오는 늑대를 쫓으려고','길 잃은 친구를 도우려고','아기 염소와 함께 놀려고'],3],
    ['병아리 셋이 큰 호박을 옮기려고 했어요.\n혼자서는 아무리 밀어도 호박이 꿈쩍도 하지 않았어요.\n셋이 함께 영차 하고 밀자 호박이 데굴데굴 굴러갔어요.','이 글에서 알 수 있는 것은 무엇인가요?',['큰 호박은 셋이 들어야 해요','병아리는 혼자서도 힘이 세요','혼자 하는 것이 더 빨라요','호박은 아무리 밀어도 굴러가지 않아요','함께 힘을 모으면 해낼 수 있어요'],4]
  ];

  /* 퀴즈 [cat, prompt, passage(식·그림), choices, answer, speak(한글만), say?(정답 읽기)]: 논란 없는 교과 사실, 7·8세 영어는 영어 보기 없이, 그림 한 줄 4개, 시계 그림 금지.
     0.12: 음성이 없으므로 7세는 되도록 그림·수 줄만 보고도 풀리게(지문에 실마리 그림), 7세 영어는 한글 소리를 함께 적는다 */
  const CATS={common:'상식',math:'수학',english:'영어'};
  DATA[7].quiz=[
    ['common','밤에 뜨는 것은?','',['🌙','🌞','🌈'],0,'밤하늘에 뜨는 것은 무엇일까요?'],
    ['math','사과는 몇 개?','🍎🍎🍎🍎',['4','5','6'],0,'사과는 모두 몇 개일까요?'],
    ['common','비 올 때 쓰는 것은?','🌧️',['🎈','⛄','☔'],2,'비가 올 때 쓰는 것은 무엇일까요?'],
    ['english','알맞은 그림은?','dog 도그',['🐱','🐶','🐷'],1,'영어 도그는 어떤 그림일까요?'],
    ['math','모두 몇 개일까요?','🍓🍓\n+ 🍓🍓🍓',['4','5','6'],1,'딸기 두 개와 딸기 세 개를 더하면 모두 몇 개일까요?'],
    ['common','멍멍! 누구일까요?','',['🐱','🐷','🐶'],2,'멍멍 짖는 동물은 무엇일까요?'],
    ['math','남은 별은 몇 개?','⭐⭐⭐⭐\n− ⭐',['1','2','3'],2,'별 네 개에서 한 개를 빼면 몇 개가 남을까요?'],
    ['english','알맞은 그림은?','apple 애플',['🍌','🍎','🥚'],1,'영어 애플은 어떤 그림일까요?'],
    ['common','손가락은 몇 개?','✋',['4','5','6'],1,'한 손에 손가락은 몇 개일까요?'],
    ['math','얼마일까요?','3 + 4',['7','8','9'],0,'삼 더하기 사는 얼마일까요?'],
    ['common','무슨 색일까요?','🍌',['💙','💜','💛'],2,'잘 익은 바나나는 무슨 색일까요?'],
    ['english','알맞은 그림은?','cat 캣',['🐱','🐶','🐰'],0,'영어 캣은 어떤 그림일까요?'],
    ['math','병아리는 몇 마리?','🐥🐥🐥\n🐥🐥🐥',['5','6','7'],1,'병아리는 모두 몇 마리일까요?'],
    ['common','물에 사는 것은?','🌊',['🐔','🐘','🐟'],2,'물속에 사는 동물은 무엇일까요?'],
    ['math','남은 과자는 몇 개?','🍪🍪🍪🍪\n− 🍪🍪',['1','2','3'],1,'과자 네 개 중에서 두 개를 먹으면 몇 개가 남을까요?'],
    ['english','알맞은 그림은?','egg 에그',['🥚','🥛','🍰'],0,'영어 에그는 어떤 그림일까요?'],
    ['common','하늘을 나는 것은?','',['🐦','🐢','🐷'],0,'하늘을 날 수 있는 동물은 무엇일까요?'],
    ['math','얼마일까요?','5 + 5',['8','9','10'],2,'오 더하기 오는 얼마일까요?'],
    ['common','언제 만들까요?','⛄',['🌸','🍉','❄️'],2,'눈사람은 어느 계절에 만들까요?'],
    ['english','알맞은 그림은?','sun 선',['🌙','🌞','⭐'],1,'영어 썬은 어떤 그림일까요?'],
    ['math','얼마일까요?','9 − 3',['6','7','12'],0,'구 빼기 삼은 얼마일까요?'],
    ['common','냄새는 어디로 맡아요?','',['👂','👃','👀'],1,'냄새는 몸의 어디로 맡을까요?'],
    ['math','가장 큰 수는?','',['5','8','3'],1,'보기 중에서 가장 큰 수는 무엇일까요?'],
    ['english','알맞은 그림은?','fish 피시',['🐟','🐦','🐝'],0,'영어 피시는 어떤 그림일까요?'],
    ['common','빨간불이면?','🔴',['🚶','🛑','🏃'],1,'신호등에 빨간불이 켜지면 어떻게 할까요?'],
    ['math','□에 알맞은 수는?','1, 2, 3, □',['2','4','5'],1,'삼 다음에 오는 수는 무엇일까요?'],
    ['common','꿀을 만드는 것은?','',['🐞','🦋','🐝'],2,'꿀을 만드는 곤충은 무엇일까요?'],
    ['english','알맞은 그림은?','car 카',['🚗','🚲','🚢'],0,'영어 카는 어떤 그림일까요?'],
    ['math','풍선은 모두 몇 개?','🎈🎈🎈🎈\n+ 🎈🎈🎈🎈',['6','7','8'],2,'풍선 네 개와 풍선 네 개를 더하면 모두 몇 개일까요?'],
    ['common','알을 낳는 것은?','🥚',['🐔','🐶','🐱'],0,'알을 낳는 동물은 무엇일까요?'],
    ['math','얼마일까요?','8 − 5',['3','4','13'],0,'팔 빼기 오는 얼마일까요?'],
    ['english','알맞은 색은?','red 레드',['🔵','🔴','⚫'],1,'영어 레드는 어떤 색일까요?']
  ];
  DATA[8].quiz=[
    ['common','봄에 피는 노란 꽃은 무엇일까요?','',['개나리','코스모스','국화'],0,'봄에 피는 노란 꽃은 무엇일까요?'],
    ['math','얼마일까요?','23 + 18',['31','41','42'],1,'이십삼 더하기 십팔은 얼마일까요?'],
    ['common','올챙이가 자라면 무엇이 될까요?','',['물고기','거북','개구리'],2,'올챙이가 자라면 무엇이 될까요?'],
    ['english','무슨 뜻일까요?','three',['셋','하나','다섯'],0,'영어 쓰리는 무슨 뜻일까요?'],
    ['math','얼마일까요?','52 − 27',['25','29','35'],0,'오십이 빼기 이십칠은 얼마일까요?'],
    ['common','나뭇잎이 붉게 물드는 계절은 언제일까요?','',['봄','여름','가을'],2,'나뭇잎이 붉게 물드는 계절은 언제일까요?'],
    ['math','사탕 15개 중 7개를 먹으면 몇 개가 남을까요?','',['7','8','9'],1,'사탕 열다섯 개 중에서 일곱 개를 먹으면 몇 개가 남을까요?'],
    ['english','무슨 색일까요?','yellow',['초록색','보라색','노란색'],2,'영어 옐로는 무슨 색일까요?'],
    ['common','불이 나면 몇 번으로 전화할까요?','',['112','114','119'],2,'불이 나면 몇 번으로 전화해야 할까요?','일일구'],
    ['math','긴바늘이 12를, 짧은바늘이 3을 가리키면 몇 시일까요?','',['12시','3시','4시'],1,'긴바늘이 십이를, 짧은바늘이 삼을 가리키면 몇 시일까요?'],
    ['common','음식을 씹을 때 쓰는 것은 무엇일까요?','',['치아','코','귀'],0,'음식을 씹을 때 쓰는 것은 무엇일까요?'],
    ['english','무슨 뜻일까요?','book',['공','책','컵'],1,'영어 북은 무슨 뜻일까요?'],
    ['math','1시간은 몇 분일까요?','',['30분','60분','100분'],1,'한 시간은 몇 분일까요?'],
    ['common','겨울잠을 자는 동물은 무엇일까요?','',['강아지','닭','곰'],2,'겨울잠을 자는 동물은 무엇일까요?'],
    ['math','닭 34마리에 9마리가 더 왔어요. 모두 몇 마리일까요?','',['42','43','44'],1,'닭 서른네 마리가 있는데 아홉 마리가 더 왔어요. 모두 몇 마리일까요?'],
    ['english','무슨 뜻일까요?','water',['물','불','밥'],0,'영어 워터는 무슨 뜻일까요?'],
    ['common','식물이 자라려면 꼭 필요한 것은 무엇일까요?','',['우유','사탕','물'],2,'식물이 자라려면 꼭 필요한 것은 무엇일까요?'],
    ['math','10개씩 묶음 4개와 낱개 7개는 어떤 수일까요?','',['47','11','74'],0,'열 개씩 묶음 네 개와 낱개 일곱 개는 어떤 수일까요?'],
    ['common','횡단보도는 무슨 불이 켜졌을 때 건널까요?','',['빨간불','초록불','노란불'],1,'횡단보도는 무슨 불이 켜졌을 때 건널까요?'],
    ['english','무슨 뜻일까요?','rabbit',['호랑이','말','토끼'],2,'영어 래빗은 무슨 뜻일까요?'],
    ['math','짝수는 어느 것일까요?','',['12','7','15'],0,'칠, 십이, 십오 중에서 짝수는 어느 것일까요?'],
    ['common','거미의 다리는 몇 개일까요?','',['6개','8개','10개'],1,'거미의 다리는 몇 개일까요?'],
    ['math','얼마일까요?','68 − 30',['28','38','48'],1,'육십팔 빼기 삼십은 얼마일까요?'],
    ['english','무슨 색일까요?','blue',['빨간색','초록색','파란색'],2,'영어 블루는 무슨 색일까요?'],
    ['common','해가 지는 쪽은 어느 쪽일까요?','',['서쪽','동쪽','북쪽'],0,'해가 지는 쪽은 어느 쪽일까요?'],
    ['math','얼마일까요?','46 + 37',['73','83','84'],1,'사십육 더하기 삼십칠은 얼마일까요?'],
    ['common','일주일은 며칠일까요?','',['5일','7일','10일'],1,'일주일은 며칠일까요?'],
    ['english','무슨 뜻일까요?','ten',['열','둘','여섯'],0,'영어 텐은 무슨 뜻일까요?'],
    ['math','연필 20자루 중 6자루를 주면 몇 자루가 남을까요?','',['14','16','26'],0,'연필 스무 자루 중에서 여섯 자루를 친구에게 주면 몇 자루가 남을까요?'],
    ['common','젖소에게서 얻을 수 있는 것은 무엇일까요?','',['달걀','꿀','우유'],2,'젖소에게서 얻을 수 있는 것은 무엇일까요?'],
    ['math','5씩 뛰어 세었어요. 빈칸에 알맞은 수는 무엇일까요?','5, 10, 15, □',['16','20','25'],1,'오씩 뛰어 세었어요. 오, 십, 십오, 그다음에 올 수는 무엇일까요?'],
    ['english','무슨 뜻일까요?','flower',['꽃','새','별'],0,'영어 플라워는 무슨 뜻일까요?'],
    ['common','우리나라 국기의 이름은 무엇일까요?','',['무궁화','애국가','태극기'],2,'우리나라 국기의 이름은 무엇일까요?'],
    ['common','추석에 빚어 먹는 떡은 무엇일까요?','',['송편','떡국','팥죽'],0,'추석에 빚어 먹는 떡은 무엇일까요?'],
    ['common','모르는 사람이 문을 열어 달라고 하면?','',['바로 열어요','열지 않아요','같이 나가요'],1,'모르는 사람이 문을 열어 달라고 하면 어떻게 할까요?']
  ];
  DATA[9].quiz=[
    ['common','우리나라의 수도는 어디일까요?','',['서울','부산','인천','대구'],0,'우리나라의 수도는 어디일까요?'],
    ['math','얼마일까요?','7 × 8',['49','56','63','64'],1,'칠 곱하기 팔은 얼마일까요?'],
    ['common','한글을 만든 임금은 누구일까요?','',['이순신','광개토대왕','세종대왕','신사임당'],2,'한글을 만든 임금은 누구일까요?'],
    ['english','무슨 뜻일까요?','Thank you.',['미안해요.','안녕히 주무세요.','생일 축하해요.','고마워요.'],3,'땡큐는 무슨 뜻일까요?'],
    ['math','얼마일까요?','340 + 280',['520','610','720','620'],3,'삼백사십 더하기 이백팔십은 얼마일까요?'],
    ['common','태극기의 바탕은 무슨 색일까요?','',['노란색','흰색','초록색','검은색'],1,'태극기의 바탕은 무슨 색일까요?'],
    ['math','1 m는 몇 cm일까요?','',['1 cm','10 cm','100 cm','1000 cm'],2,'일 미터는 몇 센티미터일까요?'],
    ['english','영어로 무엇일까요?','🐯',['tiger','lion','monkey','bear'],0,'호랑이를 영어로 하면 무엇일까요?'],
    ['common','우리나라를 상징하는 꽃은 무엇일까요?','',['장미','무궁화','해바라기','튤립'],1,'우리나라를 상징하는 꽃은 무엇일까요?'],
    ['math','피자 한 판을 똑같이 4조각으로 나누었어요. 한 조각은 전체의 얼마일까요?','',['2분의 1','3분의 1','4분의 1','4분의 3'],2,'피자 한 판을 똑같이 네 조각으로 나누었어요. 한 조각은 전체의 얼마일까요?'],
    ['common','물이 얼면 무엇이 될까요?','',['수증기','구름','비','얼음'],3,'물이 얼면 무엇이 될까요?'],
    ['english','무슨 뜻일까요?','Good morning!',['좋은 아침이에요.','잘 자요.','미안해요.','잘 먹겠습니다.'],0,'굿모닝은 무슨 뜻일까요?'],
    ['math','한 상자에 사과가 6개씩 들어 있어요. 4상자에는 모두 몇 개일까요?','',['10','24','30','36'],1,'한 상자에 사과가 여섯 개씩 들어 있어요. 네 상자에는 사과가 모두 몇 개일까요?'],
    ['common','물이 끓으면 무엇으로 변할까요?','',['얼음','모래','수증기','소금'],2,'물이 끓으면 무엇으로 변할까요?'],
    ['math','얼마일까요?','500 − 160',['340','360','440','460'],0,'오백 빼기 백육십은 얼마일까요?'],
    ['english','무슨 색일까요?','green',['빨간색','노란색','검은색','초록색'],3,'영어 그린은 무슨 색일까요?'],
    ['common','식물이 잘 자라려면 무엇이 필요할까요?','',['햇빛','소금','연기','설탕'],0,'식물이 잘 자라려면 무엇이 필요할까요?'],
    ['math','책이 425권 있었는데 138권을 더 샀어요. 책은 모두 몇 권일까요?','',['287','553','563','573'],2,'책이 사백이십오 권 있었는데 백삼십팔 권을 더 샀어요. 책은 모두 몇 권일까요?'],
    ['common','불을 끄고 위험에 빠진 사람을 구하는 사람은 누구일까요?','',['집배원','농부','화가','소방관'],3,'불을 끄고 위험에 빠진 사람을 구하는 사람은 누구일까요?'],
    ['english','무슨 뜻일까요?','I\'m sorry.',['미안해요.','고마워요.','괜찮아요.','반가워요.'],0,'아임 쏘리는 무슨 뜻일까요?'],
    ['math','얼마일까요?','9 × 7',['56','63','72','81'],1,'구 곱하기 칠은 얼마일까요?'],
    ['common','곤충의 다리는 모두 몇 개일까요?','',['4개','6개','8개','10개'],1,'곤충의 다리는 모두 몇 개일까요?'],
    ['math','2 m 30 cm는 몇 cm일까요?','',['23 cm','203 cm','230 cm','2030 cm'],2,'이 미터 삼십 센티미터는 몇 센티미터일까요?'],
    ['english','무슨 동물일까요?','elephant',['기린','하마','사자','코끼리'],3,'영어 엘리펀트는 무슨 동물일까요?'],
    ['common','하늘을 나는 비행기를 모는 사람은 누구일까요?','',['조종사','선장','기관사','택배 기사'],0,'하늘을 나는 비행기를 모는 사람은 누구일까요?'],
    ['math','꼭짓점이 4개인 도형은 무엇일까요?','',['삼각형','사각형','오각형','원'],1,'꼭짓점이 네 개인 도형은 무엇일까요?'],
    ['common','우리나라에서 낮이 가장 긴 계절은 언제일까요?','',['봄','여름','가을','겨울'],1,'우리나라에서 낮이 가장 긴 계절은 언제일까요?'],
    ['english','무슨 뜻일까요?','Good night.',['좋은 아침이에요.','배고파요.','축하해요.','잘 자요.'],3,'굿나잇은 무슨 뜻일까요?'],
    ['math','얼마일까요?','300 − 120',['180','280','220','120'],0,'삼백 빼기 백이십은 얼마일까요?'],
    ['common','한글날은 몇 월 며칠일까요?','',['3월 1일','8월 15일','10월 3일','10월 9일'],3,'한글날은 몇 월 며칠일까요?'],
    ['math','1시간의 반은 몇 분일까요?','',['20분','30분','40분','60분'],1,'한 시간의 반은 몇 분일까요?'],
    ['english','영어로 무엇일까요?','검은색',['white','brown','black','pink'],2,'검은색을 영어로 하면 무엇일까요?'],
    ['common','담는 그릇에 따라 모양이 바뀌는 것은 무엇일까요?','',['주스','돌멩이','연필','나무 블록'],0,'담는 그릇에 따라 모양이 바뀌는 것은 무엇일까요?'],
    ['common','옛날 사람들이 불을 밝히던 도구는 무엇일까요?','',['전구','손전등','형광등','호롱불'],3,'옛날 사람들이 불을 밝히던 도구는 무엇일까요?'],
    ['common','애벌레가 번데기를 거쳐 자라면 무엇이 될까요?','',['개구리','나비','거미','달팽이'],1,'애벌레가 번데기를 거쳐 자라면 무엇이 될까요?']
  ];
  DATA[10].quiz=[
    ['common','자석에서 끌어당기는 힘이 가장 센 부분을 무엇이라고 할까요?','',['극','가운데','손잡이','옆면'],0,'자석에서 끌어당기는 힘이 가장 센 부분을 무엇이라고 할까요?'],
    ['math','얼마일까요?','56 ÷ 7',['6','7','8','9'],2,'오십육 나누기 칠은 얼마일까요?'],
    ['common','젖은 빨래가 마르는 것은 물이 어떻게 되기 때문일까요?','',['얼어서','녹아서','증발해서','끓어서'],2,'젖은 빨래가 마르는 것은 물이 어떻게 되기 때문일까요?'],
    ['english','무슨 뜻일까요?','What is your name?',['몇 살이에요?','어디에 살아요?','기분이 어때요?','이름이 뭐예요?'],3,'왓 이즈 유어 네임은 무슨 뜻일까요?'],
    ['math','얼마일까요?','23 × 4',['82','92','96','812'],1,'이십삼 곱하기 사는 얼마일까요?'],
    ['common','임진왜란 때 바다에서 왜군을 크게 물리친 장군은 누구일까요?','',['을지문덕','강감찬','김유신','이순신'],3,'임진왜란 때 바다에서 왜군을 크게 물리친 장군은 누구일까요?'],
    ['math','연필 54자루를 6명이 똑같이 나누면 한 명이 몇 자루씩 가질까요?','',['8','9','10','48'],1,'연필 쉰네 자루를 여섯 명이 똑같이 나누면 한 명이 몇 자루씩 가질까요?'],
    ['english','무슨 뜻일까요?','where',['어디','언제','누구','왜'],0,'영어 웨어는 무슨 뜻일까요?'],
    ['common','피를 온몸으로 보내는 일을 하는 기관은 무엇일까요?','',['위','심장','폐','뇌'],1,'피를 온몸으로 보내는 일을 하는 기관은 무엇일까요?'],
    ['math','가장 큰 분수는 무엇일까요?','',['7분의 4','7분의 2','7분의 5','7분의 3'],2,'분모가 칠로 같은 분수 중에서 가장 큰 분수는 무엇일까요?'],
    ['common','세종대왕 때 비의 양을 재려고 만든 기구는 무엇일까요?','',['해시계','나침반','망원경','측우기'],3,'세종대왕 때 비의 양을 재려고 만든 기구는 무엇일까요?'],
    ['english','무슨 뜻일까요?','How old are you?',['몇 살이에요?','이름이 뭐예요?','어디에 살아요?','몇 시예요?'],0,'하우 올드 아 유는 무슨 뜻일까요?'],
    ['math','가장 작은 분수는 무엇일까요?','',['2분의 1','8분의 1','3분의 1','5분의 1'],1,'분자가 일인 분수 중에서 가장 작은 분수는 무엇일까요?'],
    ['common','크고 뚜렷한 고리로 유명한 행성은 무엇일까요?','',['지구','화성','토성','금성'],2,'크고 뚜렷한 고리로 유명한 행성은 무엇일까요?'],
    ['math','삼각형의 세 각의 크기를 모두 더하면 몇 도일까요?','',['90도','180도','270도','360도'],1,'삼각형의 세 각의 크기를 모두 더하면 몇 도일까요?'],
    ['english','무슨 뜻일까요?','when',['어디','무엇','어떻게','언제'],3,'영어 웬은 무슨 뜻일까요?'],
    ['common','물건을 만들거나 기르는 경제활동을 무엇이라고 할까요?','',['생산','소비','저축','교환'],0,'물건을 만들거나 기르는 경제활동을 무엇이라고 할까요?'],
    ['math','1시 40분에서 50분이 지나면 몇 시 몇 분일까요?','',['2시 20분','1시 90분','2시 30분','3시 30분'],2,'한 시 사십 분에서 오십 분이 지나면 몇 시 몇 분일까요?'],
    ['common','세종대왕이 만든 한글의 처음 이름은 무엇일까요?','',['팔만대장경','동의보감','삼국유사','훈민정음'],3,'세종대왕이 만든 한글의 처음 이름은 무엇일까요?'],
    ['english','무슨 뜻일까요?','I like apples.',['나는 사과를 좋아해요.','나는 사과가 싫어요.','나는 바나나를 좋아해요.','사과는 빨개요.'],0,'아이 라이크 애플스는 무슨 뜻일까요?'],
    ['math','2시간 15분은 모두 몇 분일까요?','',['115분','125분','135분','215분'],2,'두 시간 십오 분은 모두 몇 분일까요?'],
    ['common','땅속의 마그마가 땅 위로 나와 생긴 산을 무엇이라고 할까요?','',['화산','언덕','들판','골짜기'],0,'땅속의 마그마가 땅 위로 나와 생긴 산을 무엇이라고 할까요?'],
    ['math','몫과 나머지를 구해 보세요.','23 ÷ 4',['몫 5, 나머지 2','몫 4, 나머지 7','몫 6, 나머지 1','몫 5, 나머지 3'],3,'이십삼 나누기 사의 몫과 나머지는 무엇일까요?'],
    ['english','무슨 뜻일까요?','who',['무엇','누구','언제','어디'],1,'영어 후는 무슨 뜻일까요?'],
    ['common','물체의 무게를 정확히 비교할 때 쓰는 도구는?','',['저울','자','온도계','돋보기'],0,'물체의 무게를 정확히 비교할 때 쓰는 도구는 무엇일까요?'],
    ['math','얼마일까요?','35 × 6',['180','210','240','245'],1,'삼십오 곱하기 육은 얼마일까요?'],
    ['common','자석에 붙는 물체는 무엇일까요?','',['나무젓가락','유리컵','쇠못','지우개'],2,'자석에 붙는 물체는 무엇일까요?'],
    ['english','무슨 뜻일까요?','It\'s raining.',['눈이 와요.','날씨가 맑아요.','바람이 불어요.','비가 와요.'],3,'잇츠 레이닝은 무슨 뜻일까요?'],
    ['math','오후 3시 20분에 시작한 영화가 1시간 50분 뒤에 끝났어요. 끝난 시각은?','',['오후 5시 10분','오후 4시 10분','오후 4시 70분','오후 5시 20분'],0,'오후 세 시 이십 분에 시작한 영화가 한 시간 오십 분 뒤에 끝났어요. 끝난 시각은 몇 시 몇 분일까요?'],
    ['common','스스로 빛을 내는 천체는 무엇일까요?','',['달','태양','지구','화성'],1,'스스로 빛을 내는 천체는 무엇일까요?'],
    ['math','둔각은 어느 것일까요?','',['30도','90도','120도','180도'],2,'삼십 도, 구십 도, 백이십 도, 백팔십 도 중에서 둔각은 어느 것일까요?'],
    ['english','영어로 알맞은 것은 무엇일까요?','나는 열 살이에요.',['I am two years old.','I have ten books.','You are ten years old.','I am ten years old.'],3,'나는 열 살이에요. 이 말을 영어로 하면 무엇일까요?']
  ];

  /* ---------- 한글 음절 분해 ---------- */
  const DOUBLE_JONG=[3,5,6,9,10,11,12,13,14,15,18];// ㄳㄵㄶㄺㄻㄼㄽㄾㄿㅀㅄ
  const TENSE_CHO=[1,4,8,10,13];// ㄲㄸㅃㅆㅉ
  const DIPHTHONG_JUNG=[3,7,9,10,11,14,15,16,19];// ㅒㅖㅘㅙㅚㅝㅞㅟㅢ
  const HANGUL_RE=/[ᄀ-ᇿㄱ-ㆎ가-힣]/;
  const chars=s=>Array.from(String(s));
  const off=ch=>ch.charCodeAt(0)-0xAC00;
  const hangul={
    isSyllable(ch){return typeof ch==='string'&&ch.length===1&&off(ch)>=0&&off(ch)<=11171;},
    cho(ch){return hangul.isSyllable(ch)?Math.floor(off(ch)/588):-1;},
    jung(ch){return hangul.isSyllable(ch)?Math.floor(off(ch)%588/28):-1;},
    jong(ch){return hangul.isSyllable(ch)?off(ch)%28:-1;},
    hasBatchim(ch){return hangul.jong(ch)>0;},
    hasDoubleBatchim(ch){return DOUBLE_JONG.includes(hangul.jong(ch));},
    hasTenseInitial(ch){return TENSE_CHO.includes(hangul.cho(ch));},
    hasDiphthong(ch){return DIPHTHONG_JUNG.includes(hangul.jung(ch));},
    isWord(s){const c=chars(s);return typeof s==='string'&&c.length>0&&c.every(hangul.isSyllable);},
    syllables(s){return chars(s).filter(hangul.isSyllable).length;},
    sentences(s){return (String(s).match(/[.?!]/g)||[]).length;},
    compactLength(s){return chars(String(s).replace(/\s/g,'')).length;}
  };

  /* ---------- 은행 조립(손 문항) ---------- */
  const pad=n=>(n<10?'0':'')+n,pad3=n=>('00'+n).slice(-3);
  const BANK={};
  for(const age of AGES){
    BANK[age]={
      story:DATA[age].story.map((r,i)=>age===7
        ?{id:'a7-story-'+pad(i+1),age,mode:'story',prompt:WORD_PROMPT,passage:r[0],speak:r[0],choices:r[1],answer:r[2],note:''}
        :{id:'a'+age+'-story-'+pad(i+1),age,mode:'story',prompt:r[1],passage:r[0],speak:r[0],choices:r[2],answer:r[3],note:''}),
      quiz:DATA[age].quiz.map((r,i)=>{const q={id:'a'+age+'-quiz-'+pad(i+1),age,mode:'quiz',cat:r[0],prompt:r[1],passage:r[2],speak:r[5],choices:r[3],answer:r[4],note:''};if(r[6])q.say=r[6];return q})
    };
  }
  const normAge=age=>AGES.includes(age)?age:8;
  const normMode=()=>'story';/* 예전 호출('sound' 포함)도 언제나 읽기 문항 */
  const copy=(q,withNote)=>{
    const o={id:q.id,age:q.age,mode:q.mode};
    if(q.mode==='quiz')o.cat=q.cat;
    Object.assign(o,{prompt:q.prompt,passage:q.passage,speak:q.speak,choices:q.choices.slice(),answer:q.answer});
    if(q.say)o.say=q.say;
    if(withNote)o.note=q.note;
    return o;
  },qcopy=copy;

  /* ---------- 수준 규칙 ---------- */
  const CHOICE_COUNT={7:{story:3},8:{story:3},9:{story:4},10:{story:5}};
  /* 지문 속 말: 통째로 있거나 첫 어절 줄기(조사 뗌)가 지문에 있음 */
  const PART=/(에서|에게|으로|이에요|예요|은|는|이|가|을|를|에|의|와|과|로|도)$/;
  const stem=w=>{const s=w.replace(/[^가-힣]/g,''),t=s.replace(PART,'');return t||s};
  const stems=s=>String(s).split(/\s+/).map(stem).filter(Boolean);
  const inPassage=(c,p)=>p.includes(c)||stems(p).includes(stems(c)[0]);
  const soleLongest=q=>{const L=q.choices.map(x=>hangul.compactLength(x)),m=Math.max(...L);return L[q.answer]===m&&L.filter(v=>v===m).length===1};
  function checkLevel(age,mode,q){
    if(mode==='quiz'||q&&q.mode==='quiz')return quizLevel(age,q);
    const e=[],H=hangul,c=Array.isArray(q.choices)?q.choices:[],ans=String(c[q.answer]===undefined?'':c[q.answer]),p=String(q.passage);
    const want=CHOICE_COUNT[age]&&CHOICE_COUNT[age][mode];
    if(!want)return ['알 수 없는 수준 '+age+'/'+mode];
    if(c.length!==want)e.push('보기 '+want+'개여야 함(현재 '+c.length+'개)');
    if(age===7){
      /* 낱말 → 그림, 또는 그림 → 낱말(보기 낱말도 받침 없는 1~3음절) */
      const word=x=>H.isWord(x)&&chars(x).length<=3&&!chars(x).some(H.hasBatchim),pic=x=>typeof x==='string'&&x.length>0&&!HANGUL_RE.test(x);
      if(pic(p)&&chars(p).length<=3){if(!c.every(word))e.push('그림 지문의 보기는 받침 없는 한글 1~3음절이어야 함')}
      else{
        if(!word(p))e.push('지문이 받침 없는 한글 1~3음절이어야 함');
        if(!c.every(pic))e.push('보기는 한글이 아닌 그림 문자여야 함');
      }
    }else{
      if(age===8){
        const n=H.compactLength(p);
        if(H.sentences(p)!==1)e.push('지문이 한 문장이어야 함');
        if(n<10||n>20)e.push('지문이 공백 제외 10~20자여야 함(현재 '+n+'자)');
        if(ans&&String(q.prompt).includes(ans))e.push('질문에 정답이 들어 있으면 안 됨');
      }else if(age===9){
        if(H.sentences(p)!==2)e.push('지문이 두 문장이어야 함(현재 '+H.sentences(p)+')');
      }else{
        const s=H.sentences(p);
        if(s<3||s>4)e.push('지문이 3~4문장이어야 함(현재 '+s+')');
      }
      if(!c.some((x,i)=>i!==q.answer&&typeof x==='string'&&inPassage(x,p)))e.push('오답 하나 이상은 지문 속 말이어야 함');
    }
    return e;
  }
  /* 공통 형식(생성 문항 id는 a8-story-g001 꼴) */
  function checkCommon(q){
    if(q&&q.mode==='quiz')return quizCommon(q);
    const e=[];
    if(typeof q.id!=='string'||!/^a(7|8|9|10)-story-(\d{2,}|g\d{3,})$/.test(q.id))e.push('id 형식 오류');
    if(typeof q.prompt!=='string'||!q.prompt.trim())e.push('prompt가 비어 있음');
    if(!Array.isArray(q.choices)||!q.choices.every(x=>typeof x==='string'&&x.trim().length>0)){e.push('choices는 비어 있지 않은 문자열 배열이어야 함');return e;}
    if(new Set(q.choices).size!==q.choices.length)e.push('보기 중복');
    if(!Number.isInteger(q.answer)||q.answer<0||q.answer>=q.choices.length){e.push('answer 범위 오류');return e;}
    if(q.mode==='story'){
      if(typeof q.passage!=='string'||!q.passage.trim())e.push('story는 passage가 비어 있으면 안 됨');
      if(q.speak!==q.passage)e.push('story는 speak가 passage와 같아야 함');
    }else e.push('mode 오류');
    return e;
  }
  /* 같은 문항 판정: 지문 + 질문(7세는 보기까지). 한 지문에 질문이 여럿이면 문항도 여럿 */
  const keyOf=q=>q.passage+'\n'+q.prompt+(q.age===7&&Array.isArray(q.choices)?'\n'+q.choices.slice().sort().join('|'):'');

  /* ---------- 퀴즈 규칙 ---------- */
  const QUIZ_CHOICES={7:3,8:3,9:4,10:4},QUIZ_PROMPT_MAX={7:10,8:20,9:30,10:40},QUIZ_MIN={};
  for(const a of AGES)QUIZ_MIN[a]={common:12,math:12,english:8};
  const has=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  function quizCommon(q){
    const e=[];
    if(typeof q.id!=='string'||!/^a(7|8|9|10)-quiz-(\d{2,}|g\d{3,})$/.test(q.id))e.push('id 형식 오류');
    if(q.mode!=='quiz')e.push("mode는 'quiz'여야 함");
    if(!has(CATS,q.cat))e.push('cat은 common·math·english 중 하나여야 함');
    if(typeof q.prompt!=='string'||!q.prompt.trim())e.push('prompt가 비어 있음');
    if(typeof q.passage!=='string')e.push('passage는 문자열이어야 함');
    if(typeof q.speak!=='string'||!q.speak.trim()||!HANGUL_RE.test(q.speak))e.push('speak는 한글이 든 문장이어야 함');
    if(q.say!==undefined&&(typeof q.say!=='string'||!HANGUL_RE.test(q.say)||/[0-9A-Za-z]/.test(q.say)))e.push('say는 한글로 적은 읽기여야 함');
    if(!Array.isArray(q.choices)||!q.choices.length||!q.choices.every(x=>typeof x==='string'&&x.trim().length>0)){e.push('choices는 비어 있지 않은 문자열 배열이어야 함');return e;}
    if(new Set(q.choices).size!==q.choices.length)e.push('보기 중복');
    if(!Number.isInteger(q.answer)||q.answer<0||q.answer>=q.choices.length)e.push('answer 범위 오류');
    return e;
  }
  function quizLevel(age,q){
    const want=QUIZ_CHOICES[age],max=QUIZ_PROMPT_MAX[age];
    if(!want)return ['알 수 없는 수준 '+age+'/quiz'];
    const e=[],c=Array.isArray(q.choices)?q.choices:[],n=hangul.syllables(q.prompt);
    if(c.length!==want)e.push('보기 '+want+'개여야 함(현재 '+c.length+'개)');
    if(n>max)e.push('prompt는 한글 '+max+'음절 이하여야 함(현재 '+n+'음절)');
    if(age===7&&!c.every(x=>chars(x).length<=6))e.push('7세 보기는 6자 이하여야 함');
    return e;
  }
  function checkQuiz(age,q){
    if(!q||typeof q!=='object')return ['문항이 객체가 아님'];
    return quizCommon(q).concat(quizLevel(age,q));
  }

  /* ---------- 생성 문항 합치기(규칙에 어긋나거나 겹치면 genRejected) ---------- */
  let GEN=null;
  if(typeof module!=='undefined'&&typeof require==='function'){try{GEN=require('./questions-gen.js')}catch(err){if(!err||err.code!=='MODULE_NOT_FOUND')throw err}}
  else GEN=root.QUESTIONS_GEN||null;
  const genRejected=[];
  if(GEN&&typeof GEN==='object')for(const age of AGES)for(const mode of ['story','quiz']){
    const src=GEN[age]&&GEN[age][mode],list=BANK[age][mode];
    if(!Array.isArray(src))continue;
    const k7=q=>mode==='quiz'?q.prompt+'\n'+q.passage:keyOf(q);
    const keys=new Set(list.map(k7));
    for(const g of src){
      if(!g||typeof g!=='object'){genRejected.push(age+'/'+mode+': 객체 아님');continue}
      const q={id:g.id,age:g.age,mode:g.mode,prompt:g.prompt,passage:g.passage,speak:g.speak,choices:Array.isArray(g.choices)?g.choices.slice():g.choices,answer:g.answer,note:g.note||''};
      if(mode==='quiz')q.cat=g.cat;
      if(g.say)q.say=g.say;
      if([1,2,3].includes(g.level))q.level=g.level;
      let e=g.age!==age||g.mode!==mode?['age/mode가 묶음과 다름']:mode==='quiz'?checkQuiz(age,q):checkCommon(q);
      if(!e.length&&mode!=='quiz')e=checkLevel(age,mode,q);
      if(!e.length&&keys.has(k7(q)))e=['중복'];
      if(e.length){genRejected.push(q.id+': '+e.join(', '));continue}
      keys.add(k7(q));
      list.push(q);
    }
  }
  const QPOOL={};
  for(const a of AGES){QPOOL[a]={};for(const c of Object.keys(CATS))QPOOL[a][c]=BANK[a].quiz.filter(q=>q.cat===c);}

  /* 전체 검사(인자 없으면 내장 은행). 손 문항 뒤 생성 문항, 정답 위치 3연속은 구간별 */
  function validate(bank){
    bank=bank||BANK;
    const errors=[],ids=new Set(),E=(id,m)=>errors.push(id+': '+m);
    const listCheck=(list,age,mode,tag)=>{
      let hand=0,gen=0,pos=[],prevGen=false;const tally={};
      list.forEach((q,i)=>{
        if(!q||typeof q!=='object'){errors.push(tag+' #'+i+': 문항이 객체가 아님');return}
        const g=/-g\d+$/.test(String(q.id));
        if(g)gen++;else hand++;
        const want='a'+age+'-'+mode+'-'+(g?'g'+pad3(gen):pad(hand));
        if(q.id!==want)E(q.id,'id는 '+want+'여야 함');
        if(!g&&gen)E(q.id,'손 문항은 생성 문항 앞에');
        if(ids.has(q.id))E(q.id,'id 중복');
        ids.add(q.id);
        if(g!==prevGen)pos=[];
        prevGen=g;
        const p=pos.push(q.answer);
        if(p>=3&&pos[p-1]===pos[p-2]&&pos[p-1]===pos[p-3])E(q.id,'정답 위치가 3문항 연속 같음');
        tally[q.answer]=(tally[q.answer]||0)+1;
      });
      Object.keys(tally).forEach(v=>{if(tally[v]*2>list.length)errors.push(tag+': 정답 위치 '+v+'가 50%를 넘음');});
    };
    for(const mode of MODES){
      const seen=new Map();
      for(const age of AGES){
        const list=bank[age]&&bank[age][mode],tag=age+'세 '+mode;
        if(!Array.isArray(list)){errors.push(tag+': 묶음 없음');continue;}
        if(list.length<12)errors.push(tag+': 12문항 이상이어야 함(현재 '+list.length+')');
        listCheck(list,age,mode,tag);
        const keys=new Map();let longest=0;
        list.forEach(q=>{
          if(!q||typeof q!=='object')return;
          if(q.age!==age||q.mode!==mode)E(q.id,'age/mode가 묶음과 다름');
          const ce=checkCommon(q);
          ce.concat(ce.length?[]:checkLevel(age,mode,q)).forEach(m=>E(q.id,m));
          if(ce.length)return;
          const k=keyOf(q),o=seen.get(q.passage);
          if(o&&o.age!==age)E(q.id,'지문이 '+o.id+'와 중복');else if(!o)seen.set(q.passage,{age,id:q.id});
          if(keys.has(k))E(q.id,'지문이 '+keys.get(k)+'와 중복');else keys.set(k,q.id);
          if(age>=9&&soleLongest(q))longest++;
        });
        if(longest>list.length*(1/CHOICE_COUNT[age][mode]+.1))errors.push(tag+': 정답=가장 긴 보기 과다('+longest+')');
      }
    }
    for(const age of AGES){
      const list=bank[age]&&bank[age].quiz,tag=age+'세 quiz';
      if(!Array.isArray(list)){errors.push(tag+': 묶음 없음');continue;}
      listCheck(list,age,'quiz',tag);
      const seen=new Map(),cats={common:0,math:0,english:0};
      list.forEach(q=>{
        if(!q||typeof q!=='object')return;
        if(q.age!==age||q.mode!=='quiz')E(q.id,'age/mode가 묶음과 다름');
        checkQuiz(age,q).forEach(m=>E(q.id,m));
        if(has(cats,q.cat))cats[q.cat]++;
        const k=q.prompt+'\n'+q.passage;
        if(seen.has(k))E(q.id,'질문·지문이 '+seen.get(k)+'와 중복');else seen.set(k,q.id);
      });
      const min=QUIZ_MIN[age];
      Object.keys(min).forEach(c=>{if(cats[c]<min[c])errors.push(tag+': '+CATS[c]+' '+min[c]+'문항 이상이어야 함(현재 '+cats[c]+')');});
    }
    return errors;
  }

  /* ---------- 출제 순서 ----------
     칸 종류는 (나이, 번호)로만: 20칸마다 퀴즈 칸 수 QUIZ_PHASE([시작 묶음, 칸 수]), 고르게·연속 없음. 분류는 QUIZ_MIX 순환(시드로 시작 자리).
     묶음마다 (시드, 바퀴) 순열: 바퀴 안 반복 0, level 낮은 것 앞쪽, 같은 지문의 다른 질문은 뒤 구간으로, 바퀴 경계는 같은 문항·지문을 min(GAP, 크기/4)칸 띄움 */
  const QUIZ_PHASE={7:[[0,2]],8:[[0,3]],9:[[0,5],[2,6],[5,7]],10:[[0,7],[2,8],[4,9],[6,10]]};
  const QUIZ_MIX={7:{math:13,common:6,english:1},8:{math:10,common:8,english:2},9:{math:8,common:8,english:4},10:{math:7,common:9,english:4}};
  const qIn=(age,b)=>{let q=0;for(const [s,n] of QUIZ_PHASE[age])if(b>=s)q=n;return q};
  const slotsOf=q=>Array.from({length:q},(_,j)=>Math.floor(20*(j+1)/q)-1);
  const normIndex=i=>Math.max(0,Number.isFinite(i)?Math.floor(i):0);
  const normSeed=s=>Number.isFinite(s)&&s>0?Math.floor(s)%4294967296:0;
  const isQuiz=(age,i)=>slotsOf(qIn(age,Math.floor(i/20))).includes(i%20);
  function quizBefore(age,i){
    const b=Math.floor(i/20),ph=QUIZ_PHASE[age];let n=0;
    ph.forEach(([s,q],k)=>{const e=k+1<ph.length?ph[k+1][0]:Infinity;n+=q*Math.max(0,Math.min(b,e)-s)});
    return n+slotsOf(qIn(age,b)).filter(p=>p<i%20).length;
  }
  const CYCLE={};
  for(const a of AGES){
    const w=QUIZ_MIX[a],cur={math:0,common:0,english:0},out=[];
    for(let k=0;k<20;k++){let best=null;for(const c of ['math','common','english']){cur[c]+=w[c];if(best===null||cur[c]>cur[best])best=c}cur[best]-=20;out.push(best)}
    CYCLE[a]=out;
  }
  const hash=str=>{let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0};
  const rng=a=>()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
  const GAP=10,STEP=.5,MEMO=new Map();
  /* 같은 묶음(한 판에서 멀리 띄울 문항): 같은 지문의 질문들, 7세는 같은 낱말(낱말 → 그림, 그림 → 낱말) */
  const grp=q=>q.mode!=='story'?q.id:q.age===7?(HANGUL_RE.test(q.passage)?q.passage:q.choices[q.answer]):q.passage;
  const TIER=8;
  const memo=(key,f)=>{if(MEMO.has(key))return MEMO.get(key);if(MEMO.size>96)MEMO.clear();const v=f();MEMO.set(key,v);return v};
  function rawOrder(age,pool,list,seed,lap){
    return memo('r|'+age+'|'+pool+'|'+seed+'|'+lap,()=>{
      const r=rng(hash(age+'|'+pool+'|'+seed+'|'+lap)),n=list.length,w=list.map(q=>r()+((q.level||2)-1)*STEP);
      /* 같은 묶음의 둘째·셋째 문항은 첫째 자리 + TIER씩 뒤로: 묶음마다 하나씩 다 나온 뒤에야 둘째가 나온다 */
      const first=new Map();
      [...Array(n).keys()].sort((x,y)=>w[x]-w[y]||x-y).forEach(x=>{const g=grp(list[x]),f=first.get(g);if(f)w[x]=f[0]+TIER*f[1]++;else first.set(g,[w[x],1])});
      return [...Array(n).keys()].sort((x,y)=>w[x]-w[y]||x-y);
    });
  }
  function lapOrder(age,pool,list,seed,lap){
    if(!lap)return rawOrder(age,pool,list,seed,0);
    return memo('l|'+age+'|'+pool+'|'+seed+'|'+lap,()=>{
      const c=rawOrder(age,pool,list,seed,lap).slice(),n=c.length,G=Math.min(GAP,n>>2);
      const tail=new Set(rawOrder(age,pool,list,seed,lap-1).slice(n-G).map(x=>grp(list[x])));
      for(let h=0;h<G;h++)if(tail.has(grp(list[c[h]])))for(let j=G;j<n-G;j++)if(!tail.has(grp(list[c[j]]))){[c[h],c[j]]=[c[j],c[h]];break}
      return c;
    });
  }
  /* index번째 칸: kind, cat, 묶음 안 순번 seq, 바퀴 lap, 순열 자리 pos, 묶음 크기 size */
  function slot(age,mode,index,seed){
    const a=normAge(age),m=normMode(mode),i=normIndex(index),s=normSeed(seed);
    if(isQuiz(a,i)){
      const k=quizBefore(a,i),cy=CYCLE[a],off=hash('o|'+s)%20;
      let cat=cy[(k+off)%20],c=Math.floor(k/20)*QUIZ_MIX[a][cat];
      for(let t=0;t<k%20;t++)if(cy[(off+t)%20]===cat)c++;
      if(!QPOOL[a][cat].length){cat=Object.keys(CATS).find(x=>QPOOL[a][x].length);c=k}
      const n=QPOOL[a][cat].length;
      return {kind:'quiz',cat,seq:c,lap:Math.floor(c/n),pos:c%n,size:n};
    }
    const j=i-quizBefore(a,i),n=BANK[a][m].length;
    return {kind:m,seq:j,lap:Math.floor(j/n),pos:j%n,size:n};
  }

  const api={
    AGES:AGES.slice(),MODES:MODES.slice(),LEVELS,
    count(age,mode){return BANK[normAge(age)][normMode(mode)].length;},
    /* 은행 순서 조회, index는 내림·순환(숫자 아니면 0) */
    get(age,mode,index){
      const list=BANK[normAge(age)][normMode(mode)],n=list.length;
      const i=Number.isFinite(index)?Math.floor(index):0;
      return copy(list[((i%n)+n)%n],false);
    },
    validate,
    CATS:Object.assign({},CATS),
    quizCount(age){return BANK[normAge(age)].quiz.length;},
    quiz(age,index){
      const list=BANK[normAge(age)].quiz,n=list.length;
      const i=Number.isFinite(index)?Math.floor(index):0;
      return qcopy(list[((i%n)+n)%n],false);
    },
    /* 게임 문제(seed는 0 이상 정수, 기본 0): 같은 입력 = 같은 문항, lap = 몇 바퀴째(보기 돌리기). mode는 무엇을 넣어도 읽기(story) */
    at(age,mode,index,seed){
      const a=normAge(age),m=normMode(mode),s=normSeed(seed),t=slot(a,m,index,s);
      if(t.kind==='quiz'){const list=QPOOL[a][t.cat],q=qcopy(list[lapOrder(a,'q-'+t.cat,list,s,t.lap)[t.pos]],false);q.lap=t.lap;return q}
      const list=BANK[a][m],q=copy(list[lapOrder(a,m,list,s,t.lap)[t.pos]],false);q.lap=t.lap;return q;
    },
    /* 퀴즈 칸인지(모드·시드 무관), 그 20칸 묶음의 퀴즈 칸 수 */
    isQuiz(age,index){return isQuiz(normAge(age),normIndex(index));},
    quizPer20(age,index){return qIn(normAge(age),Math.floor(normIndex(index)/20));},
    QUIZ_PHASE,QUIZ_MIX,slot,
    hangul,checkLevel,checkCommon,checkQuiz,genRejected,
    snapshot(){const o={};for(const a of AGES){o[a]={};for(const m of MODES)o[a][m]=BANK[a][m].map(q=>copy(q,true));o[a].quiz=BANK[a].quiz.map(q=>qcopy(q,true));}return o;}
  };
  if(typeof module!=='undefined')module.exports=api;
  else root.Questions=api;
})(typeof window!=='undefined'?window:globalThis);
