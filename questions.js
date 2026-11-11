/* Age-graded question bank (7~10세 x sound/story). Pure data + lookup + validation. No DOM dependency. */
(function(root){
  const AGES=[7,8,9,10],MODES=['sound','story'];
  const LEVELS={
    7:{sound:'받침 없는 글자',story:'낱말과 그림'},
    8:{sound:'받침 있는 낱말',story:'한 문장 읽기'},
    9:{sound:'헷갈리는 낱말',story:'두 문장 읽기'},
    10:{sound:'문장 받아쓰기',story:'짧은 글 이해'}
  };
  const SOUND_PROMPT={
    7:'소리를 듣고 맞는 글자를 찾아주세요',
    8:'소리를 듣고 맞는 낱말을 찾아주세요',
    9:'소리를 듣고 바르게 쓴 낱말을 찾아주세요',
    10:'소리를 듣고 바르게 쓴 문장을 찾아주세요'
  };
  const WORD_PROMPT='낱말을 읽고 알맞은 그림을 찾아주세요';
  const NOTE_SPELL='소리≠표기';

  /* Row shapes
     sound          : [choices, answerIndex, note?]
     story (7세)    : [word, choices(emoji), answerIndex]
     story (8~10세) : [passage, question, choices, answerIndex] */
  const DATA={7:{},8:{},9:{},10:{}};

  DATA[7].sound=[
    [['나','마','다'],0],
    [['무','모','마'],1],
    [['나','다','가'],2],
    [['바','파','다'],0],
    [['수','소','서'],1],
    [['나','아','하'],2],
    [['도','토','두'],0],
    [['니','리','디'],1],
    [['추','수','주'],2],
    [['고','거','커'],1],
    [['비','피','미'],0],
    [['노','나','너'],2],
    [['보','포','푸'],1],
    [['키','기','치'],0]
  ];
  DATA[7].story=[
    ['나무',['🌳','🌸','🍄'],0],
    ['사과',['🍌','🍎','🍇'],1],
    ['오이',['🥕','🌽','🥒'],2],
    ['바나나',['🍓','🍌','🍉'],1],
    ['포도',['🍇','🍑','🍋'],0],
    ['고구마',['🌽','🥕','🍠'],2],
    ['나비',['🦋','🐝','🐞'],0],
    ['여우',['🐻','🦊','🐰'],1],
    ['모자',['👟','🧤','🎩'],2],
    ['기차',['🚂','🚌','🚲'],0],
    ['우유',['🍞','🥛','🧀'],1],
    ['피자',['🍰','🍪','🍕'],2],
    ['오리',['🦆','🐔','🦉'],0],
    ['바다',['🌈','🌊','🌙'],1],
    ['토마토',['🍒','🍑','🍅'],2],
    ['개미',['🐜','🐌','🐛'],0]
  ];

  DATA[8].sound=[
    [['곰','공','곳'],0],
    [['담','달','단'],1],
    [['벌','볼','별'],2],
    [['물','문','묵'],1],
    [['수박','수방','소박'],0],
    [['삼','상','산'],2],
    [['강','감','간'],0],
    [['논','눈','눌'],1],
    [['짐','징','집'],2],
    [['밤','밥','방'],1],
    [['손','솜','솔'],0],
    [['언필','연필','연핀'],1],
    [['강자','간자','감자'],2],
    [['풍선','품선','풍성'],0],
    [['척','책','챙'],1],
    [['우산','우삼','오산'],0]
  ];
  DATA[8].story=[
    ['꼬꼬가 마당에서 모이를 먹어요.','꼬꼬는 어디에서 모이를 먹나요?',['마당','지붕','연못'],0],
    ['농부가 밭에 씨앗을 심었어요.','농부가 심은 것은 무엇인가요?',['나무','씨앗','꽃'],1],
    ['병아리가 엄마를 따라 걸어요.','병아리는 누구를 따라 걷나요?',['농부','늑대','엄마'],2],
    ['늑대가 언덕에서 낮잠을 자요.','누가 낮잠을 자나요?',['늑대','꼬꼬','병아리'],0],
    ['꼬꼬는 아침마다 노래를 불러요.','꼬꼬는 언제 노래를 부르나요?',['저녁마다','아침마다','밤마다'],1],
    ['아이가 강에서 물고기를 보았어요.','아이는 어디에서 물고기를 보았나요?',['산','집','강'],2],
    ['토끼가 당근을 맛있게 먹어요.','토끼가 먹는 것은 무엇인가요?',['당근','사과','감자'],0],
    ['할머니가 울타리를 고쳐 주셨어요.','누가 울타리를 고쳐 주셨나요?',['아빠','농부','할머니'],2],
    ['병아리 세 마리가 풀밭에서 놀아요.','병아리는 몇 마리인가요?',['두 마리','세 마리','네 마리'],1],
    ['가을에 마을 감나무에 감이 열렸어요.','감나무에 열린 것은 무엇인가요?',['감','밤','배'],0],
    ['꼬꼬는 타워 위에서 마을을 지켜요.','꼬꼬는 어디에서 마을을 지키나요?',['울타리 뒤','타워 위','나무 아래'],1],
    ['동생이 우유를 한 컵 마셨어요.','동생이 마신 것은 무엇인가요?',['물','주스','우유'],2],
    ['겨울에 마을에 하얀 눈이 내려요.','글에서 눈은 언제 내리나요?',['겨울','여름','봄'],0],
    ['고양이가 지붕 위에서 하품을 해요.','고양이는 어디에 있나요?',['마당','지붕 위','방 안'],1]
  ];

  DATA[9].sound=[
    [['토끼','토기','톡기','토키'],0],
    [['가치','까치','깍치','까지'],1],
    [['닥장','닭짱','닭장','닥짱'],2],
    [['으자','이자','에자','의자'],3],
    [['궁물','국물','국믈','굼물'],1,NOTE_SPELL],
    [['여덟','여덜','여덥','여덞'],0],
    [['안따','앉따','않다','앉다'],3],
    [['가자','과쟈','과자','꽈자'],2],
    [['참외','차뫼','참웨','참왜'],0],
    [['떡복이','떡뽀끼','떡볶기','떡볶이'],3],
    [['엽집','옆집','엽찝','옆찝'],1,NOTE_SPELL],
    [['꼳받','꽃받','꽃밭','꼿밭'],2],
    [['숟가락','숫가락','숙가락','수까락'],0,NOTE_SPELL],
    [['무릅','무룹','므릎','무릎'],3,NOTE_SPELL],
    [['쓰래기','쓰레기','스레기','쓰레키'],1],
    [['괜찬아','괜차나','괜찮아','괸찮아'],2],
    [['학교','학꾜','하꾜','학겨'],0,NOTE_SPELL],
    [['만타','많다','만다','맍다'],1],
    [['널따','넙다','넗다','넓다'],3],
    [['찌게','지개','찌개','찌계'],2]
  ];
  DATA[9].story=[
    ['꼬꼬는 아침 일찍 일어나 마당을 쓸었어요.\n그다음에 병아리들에게 모이를 나누어 주었어요.','꼬꼬가 마당을 쓴 다음에 한 일은 무엇인가요?',['모이를 나누어 주었어요','낮잠을 잤어요','울타리를 고쳤어요','노래를 불렀어요'],0],
    ['농부 아저씨가 밭에서 당근을 뽑았어요.\n당근을 바구니에 담아 토끼네 집에 가져다주었어요.','농부 아저씨는 당근을 어디에 가져다주었나요?',['꼬꼬네 집','토끼네 집','시장','창고'],1],
    ['바람이 세게 불어서 울타리가 넘어졌어요.\n마을 친구들이 모두 나와 울타리를 다시 세웠어요.','울타리는 왜 넘어졌나요?',['비가 많이 와서','늑대가 밀어서','바람이 세게 불어서','눈이 쌓여서'],2],
    ['병아리 삐삐는 노란 장화를 신고 밖으로 나갔어요.\n물웅덩이에서 첨벙첨벙 뛰며 놀았어요.','삐삐는 어디에서 놀았나요?',['모래밭','풀밭','지붕 위','물웅덩이'],3],
    ['늑대는 배가 고파서 마을에 내려왔어요.\n꼬꼬가 따뜻한 옥수수죽을 나누어 주자 늑대는 고맙다고 인사했어요.','꼬꼬가 늑대에게 나누어 준 것은 무엇인가요?',['당근','옥수수죽','사과','고구마'],1],
    ['오늘은 마을 장터가 열리는 날이에요.\n꼬꼬는 달걀을 팔아서 빨간 목도리를 샀어요.','꼬꼬는 장터에서 무엇을 샀나요?',['달걀','노란 모자','빨간 목도리','파란 장갑'],2],
    ['여름밤에 반딧불이가 반짝반짝 날아다녔어요.\n병아리들은 그 불빛을 따라 풀밭을 걸었어요.','병아리들은 무엇을 따라 걸었나요?',['반딧불이의 불빛','엄마 닭','달빛','농부 아저씨'],0],
    ['가을이 되자 밤나무에서 밤이 떨어졌어요.\n다람쥐는 밤을 주워 나무 구멍에 모아 두었어요.','다람쥐는 밤을 어디에 모아 두었나요?',['바구니','땅속','둥지','나무 구멍'],3],
    ['꼬꼬는 타워 꼭대기에 올라가 종을 쳤어요.\n종소리를 듣고 친구들이 광장으로 모였어요.','친구들은 무엇을 듣고 모였나요?',['노랫소리','종소리','북소리','빗소리'],1],
    ['눈이 많이 내린 날 아이들은 눈사람을 만들었어요.\n눈사람에게 당근 코와 단추 눈을 붙여 주었어요.','눈사람의 코는 무엇으로 만들었나요?',['단추','돌멩이','당근','나뭇가지'],2],
    ['할머니는 병아리들에게 옛날이야기를 들려주셨어요.\n이야기가 끝나기도 전에 병아리들은 모두 잠이 들었어요.','병아리들은 언제 잠이 들었나요?',['이야기가 끝나기 전에','저녁을 먹기 전에','이야기가 끝난 뒤에','아침이 된 뒤에'],0],
    ['비가 그치자 하늘에 무지개가 떴어요.\n꼬꼬와 병아리는 언덕에 올라가 무지개를 구경했어요.','꼬꼬와 병아리는 어디에서 무지개를 구경했나요?',['지붕','마당','강가','언덕'],3],
    ['병아리 콩이는 길에 떨어진 모자를 주웠어요.\n모자에 적힌 이름을 보고 주인인 염소 아저씨에게 돌려주었어요.','모자의 주인은 누구인가요?',['콩이','염소 아저씨','농부 아저씨','꼬꼬'],1],
    ['마을 도서관에 새 그림책이 들어왔어요.\n꼬꼬는 그림책을 세 권 빌려서 집으로 갔어요.','꼬꼬는 그림책을 몇 권 빌렸나요?',['한 권','두 권','세 권','네 권'],2]
  ];

  DATA[10].sound=[
    [['우리 같이 그네를 타자.','우리 가치 그네를 타자.','우리 갗이 그네를 타자.','우리 같히 그네를 타자.'],0],
    [['꼬꼬가 알을 나았어요.','꼬꼬가 알을 낳았어요.','꼬꼬가 알을 나앗어요.','꼬꼬가 알을 낫았어요.'],1],
    [['구지 서두르지 않아도 돼요.','굳이 서두르지 안아도 돼요.','굳이 서두르지 않아도 돼요.','굳이 서두르지 않아도 되요.'],2],
    [['병아리가 마니 자랐어요.','병아리가 많이 자랏어요.','병아리가 만이 자랐어요.','병아리가 많이 자랐어요.'],3],
    [['해도지를 보러 언덕에 올라요.','해돋이를 보러 언덕에 올라요.','해돗이를 보러 언덕에 올라요.','해돋이를 보러 언더게 올라요.'],1],
    [['꽃이 예쁘게 피었어요.','꼬치 예쁘게 피었어요.','꽃이 예쁘개 피었어요.','꽃이 예쁘게 피엇어요.'],0],
    [['꼬꼬가 문을 꼭 다닸어요.','꼬꼬가 무늘 꼭 닫았어요.','꼬꼬가 문을 꼭 닫앗어요.','꼬꼬가 문을 꼭 닫았어요.'],3],
    [['밥을 먹고 이를 닥아요.','밥을 먹고 이를 다까요.','밥을 먹고 이를 닦아요.','바블 먹고 이를 닦아요.'],2],
    [['설겆이를 깨끗이 했어요.','설거지를 깨끗이 했어요.','설거지를 깨끗히 했어요.','설거지를 깨끄시 했어요.'],1],
    [['책을 일고 생각을 적어요.','책을 익고 생각을 적어요.','책을 읽고 생가글 적어요.','책을 읽고 생각을 적어요.'],3],
    [['웬일로 일찍 일어났니?','왠일로 일찍 일어났니?','웬일로 일찍 이러났니?','웬일로 일직 일어났니?'],0],
    [['몇일 동안 비가 내렸어요.','몇 일 동안 비가 내렸어요.','며칠 동안 비가 내렸어요.','며칠 동안 비가 내렸써요.'],2],
    [['울타리 여페 씨앗을 심어요.','울타리 옆에 씨아슬 심어요.','울타리 엽에 씨앗을 심어요.','울타리 옆에 씨앗을 심어요.'],3],
    [['어제는 날씨가 무척 좋았어요.','어제는 날씨가 무척 조았어요.','어제는 날씨가 무척 좋앗어요.','어제는 날시가 무척 좋았어요.'],0],
    [['숙제를 끈내고 밖에서 놀아요.','숙제를 끝내고 바께서 놀아요.','숙제를 끝내고 밖에서 놀아요.','숙재를 끝내고 밖에서 놀아요.'],2],
    [['달기 지붕 위로 올라갔어요.','닭이 지붕 위로 올라갔어요.','닭이 지붕 위로 올라갓어요.','닥이 지붕 위로 올라갔어요.'],1]
  ];
  /* 앞의 두 문항은 기존 index.html STORY 문항(지문 앞 두 문장·질문·보기·정답 그대로)에
     3학년 수준 규칙(3~4문장)을 맞추려고 마지막 문장 하나씩만 덧붙인 것. */
  DATA[10].story=[
    ['밤새 비가 와서 다리가 물에 잠겼어요.\n꼬꼬는 친구를 만나러 언덕길로 돌아갔어요.\n조금 늦었지만 친구는 반갑게 맞아 주었어요.','꼬꼬는 왜 언덕길로 갔나요?',['다리가 물에 잠겨서','언덕길이 더 짧아서','친구를 만나기 싫어서','꽃에 물을 주려고','친구가 이사해서'],0],
    ['꼬꼬는 꽃에 물을 주었어요.\n다음 날 작은 꽃이 활짝 피었어요.\n꼬꼬는 꽃을 보며 기쁘게 노래했어요.','꼬꼬가 꽃을 위해 한 일은 무엇인가요?',['꽃을 꺾었어요','그늘에 숨겼어요','물을 주었어요','꽃을 친구에게 주었어요','물을 마셨어요'],2],
    ['병아리 노랑이는 울타리 옆에 해바라기 씨앗을 심었어요.\n날마다 물을 주고 풀도 뽑아 주었어요.\n여름이 되자 노랑이 키보다 큰 해바라기가 피었어요.\n노랑이는 씨앗을 받아 친구들과 나누었어요.','노랑이가 가장 먼저 한 일은 무엇인가요?',['풀을 뽑았어요','씨앗을 심었어요','씨앗을 나누었어요','물을 주었어요','해바라기를 그렸어요'],1],
    ['늑대 누리는 마을 잔치에 가고 싶었어요.\n하지만 친구들이 무서워할까 봐 문 앞에서 망설였어요.\n꼬꼬가 문을 활짝 열고 어서 오라고 손짓했어요.\n누리의 꼬리가 살랑살랑 흔들렸어요.','꼬리를 흔드는 누리의 마음은 어떠했을까요?',['화가 났어요','졸렸어요','배가 고팠어요','기뻤어요','심심했어요'],3],
    ['오늘은 마을 타워를 새로 칠하는 날이에요.\n꼬꼬는 빨간색, 병아리들은 노란색 물감을 들고 왔어요.\n그런데 갑자기 소나기가 내려 물감이 모두 씻겨 내려갔어요.\n친구들은 내일 다시 칠하기로 했어요.','친구들이 내일 다시 칠하기로 한 까닭은 무엇인가요?',['물감이 모자라서','타워가 너무 높아서','소나기에 물감이 씻겨서','날이 어두워져서','꼬꼬가 아파서'],2],
    ['닭은 아침 일찍 일어나 울어요.\n모이를 먹을 때에는 발로 땅을 파헤쳐요.\n밤에는 높은 곳에 올라가 잠을 자요.','이 글은 무엇에 대해 쓴 글인가요?',['닭이 하루를 지내는 모습','닭이 좋아하는 먹이','닭을 잘 키우는 방법','닭과 병아리의 다른 점','닭이 우는 까닭'],0],
    ['농부 아주머니는 마을 잔치에 낼 빵을 만들었어요.\n먼저 밀가루에 달걀과 우유를 넣고 잘 섞었어요.\n그다음 반죽을 틀에 부어 오븐에 넣었어요.\n마지막으로 다 구워진 빵에 꿀을 발랐어요.','반죽을 오븐에 넣은 다음에 한 일은 무엇인가요?',['밀가루를 샀어요','달걀을 섞었어요','우유를 마셨어요','빵에 꿀을 발랐어요','틀을 씻었어요'],3],
    ['농부 아저씨가 창밖을 보니 먹구름이 몰려오고 있었어요.\n아저씨는 마당에 널어 둔 고추를 서둘러 걷었어요.\n잠시 뒤 지붕 위로 후드득 소리가 들렸어요.','지붕 위에서 난 소리는 무엇일까요?',['비가 내리는 소리','새가 걷는 소리','바람이 부는 소리','고추가 떨어지는 소리','눈이 쌓이는 소리'],0],
    ['병아리 삐약이는 달리기 시합에서 꼴찌를 했어요.\n그래도 넘어진 친구를 일으켜 주고 끝까지 달렸어요.\n마을 친구들은 삐약이에게 가장 큰 박수를 보냈어요.','친구들이 삐약이에게 큰 박수를 보낸 까닭은 무엇인가요?',['일등을 해서','가장 빨리 달려서','노래를 잘 불러서','시합에 나가지 않아서','친구를 돕고 끝까지 달려서'],4],
    ['울타리는 마을을 든든하게 지켜 줍니다.\n바람이 세게 불어도 밭의 새싹이 다치지 않게 막아 줍니다.\n또 병아리들이 길을 잃지 않도록 도와줍니다.','이 글에서 가장 중요한 내용은 무엇인가요?',['바람이 세게 붑니다','새싹은 빨리 자랍니다','울타리는 마을에 도움을 줍니다','병아리는 길을 잘 잃습니다','울타리는 나무로 만듭니다'],2],
    ['가을걷이 날 아침, 마을 친구들이 밭에 모였어요.\n토끼는 고구마를 캐고 다람쥐는 수레에 실었어요.\n꼬꼬는 수레를 끌어 창고로 옮겼어요.\n저녁에는 다 함께 군고구마를 먹었어요.','수레에 실은 고구마는 그다음에 어떻게 되었나요?',['밭에 다시 심었어요','창고로 옮겨졌어요','시장에 팔았어요','강물에 씻었어요','이웃 마을에 보냈어요'],1],
    ['아침에 일어나 보니 마당이 온통 하얗게 변해 있었어요.\n병아리들은 목도리를 두르고 밖으로 뛰어나갔어요.\n발자국이 콕콕 찍힐 때마다 뽀드득 소리가 났어요.','밤사이에 어떤 일이 있었을까요?',['꽃이 피었어요','비가 왔어요','바람이 불었어요','낙엽이 떨어졌어요','눈이 내렸어요'],4],
    ['꼬꼬는 타워 꼭대기에 작은 등불을 달았어요.\n밤에 길을 잃은 친구가 마을을 찾을 수 있게 하려는 것이었어요.\n그날 밤 길을 헤매던 아기 염소가 불빛을 보고 무사히 돌아왔어요.','꼬꼬가 타워에 등불을 단 까닭은 무엇인가요?',['타워를 예쁘게 꾸미려고','밤에 책을 읽으려고','늑대를 쫓으려고','길 잃은 친구가 마을을 찾게 하려고','아기 염소와 놀려고'],3],
    ['병아리 셋이 큰 호박을 옮기려고 했어요.\n혼자서는 아무리 밀어도 호박이 꿈쩍도 하지 않았어요.\n셋이 함께 영차 하고 밀자 호박이 데굴데굴 굴러갔어요.','이 글에서 알 수 있는 것은 무엇인가요?',['호박은 맛있어요','병아리는 힘이 세요','혼자 하는 것이 더 좋아요','호박은 굴릴 수 없어요','힘을 모으면 어려운 일도 할 수 있어요'],4]
  ];

  /* ---------- 한글 음절 분해 ---------- */
  const DOUBLE_JONG=[3,5,6,9,10,11,12,13,14,15,18];      // ㄳㄵㄶㄺㄻㄼㄽㄾㄿㅀㅄ
  const TENSE_CHO=[1,4,8,10,13];                           // ㄲㄸㅃㅆㅉ
  const DIPHTHONG_JUNG=[3,7,9,10,11,14,15,16,19];          // ㅒㅖㅘㅙㅚㅝㅞㅟㅢ
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

  /* ---------- 은행 조립 ---------- */
  const pad=n=>(n<10?'0':'')+n;
  const BANK={};
  for(const age of AGES){
    BANK[age]={
      sound:DATA[age].sound.map((r,i)=>({id:'a'+age+'-sound-'+pad(i+1),age,mode:'sound',prompt:SOUND_PROMPT[age],
        passage:'',speak:r[0][r[1]],choices:r[0],answer:r[1],note:r[2]||''})),
      story:DATA[age].story.map((r,i)=>age===7
        ?{id:'a7-story-'+pad(i+1),age,mode:'story',prompt:WORD_PROMPT,passage:r[0],speak:r[0],choices:r[1],answer:r[2],note:''}
        :{id:'a'+age+'-story-'+pad(i+1),age,mode:'story',prompt:r[1],passage:r[0],speak:r[0],choices:r[2],answer:r[3],note:''})
    };
  }
  const normAge=age=>AGES.includes(age)?age:8;
  const normMode=mode=>MODES.includes(mode)?mode:'sound';
  const copy=(q,withNote)=>{
    const o={id:q.id,age:q.age,mode:q.mode,prompt:q.prompt,passage:q.passage,speak:q.speak,choices:q.choices.slice(),answer:q.answer};
    if(withNote)o.note=q.note;
    return o;
  };

  /* ---------- 수준 규칙 ---------- */
  const CHOICE_COUNT={7:{sound:3,story:3},8:{sound:3,story:3},9:{sound:4,story:4},10:{sound:4,story:5}};
  const noteOf=q=>typeof q.note==='string'?q.note:((BANK[q.age]&&BANK[q.age][q.mode]||[]).find(b=>b.id===q.id)||{note:''}).note;
  /* 문항 q가 (age, mode) 수준 규칙에 맞는지. 맞으면 [] */
  function checkLevel(age,mode,q){
    const e=[],H=hangul,c=Array.isArray(q.choices)?q.choices:[],ans=String(c[q.answer]===undefined?'':c[q.answer]),p=String(q.passage);
    const want=CHOICE_COUNT[age]&&CHOICE_COUNT[age][mode];
    if(!want)return ['알 수 없는 수준 '+age+'/'+mode];
    if(c.length!==want)e.push('보기 '+want+'개여야 함(현재 '+c.length+'개)');
    if(mode==='sound'){
      if(age===7){
        if(!c.every(x=>H.isSyllable(x)&&!H.hasBatchim(x)))e.push('모든 보기가 받침 없는 한글 1음절이어야 함');
      }else if(age===8){
        const a=chars(ans);
        if(!H.isWord(ans)||a.length>2)e.push('정답이 한글 1~2음절이어야 함');
        if(!a.some(H.hasBatchim))e.push('정답에 받침 있는 음절이 있어야 함');
        if(a.some(H.hasDoubleBatchim))e.push('정답에 겹받침이 없어야 함');
        if(!c.every(x=>H.isWord(x)&&chars(x).length<=2))e.push('모든 보기가 한글 1~2음절이어야 함');
      }else if(age===9){
        const a=chars(ans);
        if(!H.isWord(ans)||a.length<2||a.length>3)e.push('정답이 한글 2~3음절(공백 없음)이어야 함');
        if(!(a.some(H.hasTenseInitial)||a.some(H.hasDoubleBatchim)||a.some(H.hasDiphthong)||noteOf(q)===NOTE_SPELL))
          e.push('정답에 된소리·겹받침·이중모음 또는 소리≠표기 표시가 있어야 함');
      }else{
        if(!/\S\s+\S/.test(ans))e.push('정답이 공백을 포함한 문장이어야 함');
        const n=H.compactLength(ans);
        if(n<8||n>18)e.push('정답이 공백 제외 8~18자여야 함(현재 '+n+'자)');
      }
    }else if(age===7){
      const w=chars(p);
      if(!H.isWord(p)||w.length>3||w.some(H.hasBatchim))e.push('지문이 받침 없는 한글 1~3음절이어야 함');
      if(!c.every(x=>typeof x==='string'&&x.length>0&&!HANGUL_RE.test(x)))e.push('보기는 한글이 아닌 그림 문자여야 함');
    }else if(age===8){
      const n=H.compactLength(p);
      if(H.sentences(p)!==1)e.push('지문이 한 문장이어야 함');
      if(n<10||n>20)e.push('지문이 공백 제외 10~20자여야 함(현재 '+n+'자)');
    }else if(age===9){
      if(H.sentences(p)!==2)e.push('지문이 두 문장이어야 함(현재 '+H.sentences(p)+')');
    }else{
      const s=H.sentences(p);
      if(s<3||s>4)e.push('지문이 3~4문장이어야 함(현재 '+s+')');
    }
    return e;
  }
  /* 나이·모드와 무관한 공통 형식 규칙 */
  function checkCommon(q){
    const e=[];
    if(typeof q.id!=='string'||!/^a(7|8|9|10)-(sound|story)-\d{2,}$/.test(q.id))e.push('id 형식 오류');
    if(typeof q.prompt!=='string'||!q.prompt.trim())e.push('prompt가 비어 있음');
    if(!Array.isArray(q.choices)||!q.choices.every(x=>typeof x==='string'&&x.trim().length>0)){e.push('choices는 비어 있지 않은 문자열 배열이어야 함');return e;}
    if(new Set(q.choices).size!==q.choices.length)e.push('보기 중복');
    if(!Number.isInteger(q.answer)||q.answer<0||q.answer>=q.choices.length){e.push('answer 범위 오류');return e;}
    if(q.mode==='sound'){
      if(q.passage!=='')e.push("sound는 passage가 ''여야 함");
      if(q.speak!==q.choices[q.answer])e.push('sound는 speak가 정답 표기와 같아야 함');
    }else if(q.mode==='story'){
      if(typeof q.passage!=='string'||!q.passage.trim())e.push('story는 passage가 비어 있으면 안 됨');
      if(q.speak!==q.passage)e.push('story는 speak가 passage와 같아야 함');
    }else e.push('mode 오류');
    return e;
  }
  const keyOf=q=>q.mode==='story'?q.passage:(Array.isArray(q.choices)?q.choices[q.answer]:undefined);

  /* 전체 검사. 인자를 생략하면 내장 은행을 검사한다(snapshot()과 같은 구조를 넘기면 그것을 검사). */
  function validate(bank){
    bank=bank||BANK;
    const errors=[],ids=new Set();
    for(const mode of MODES){
      const seen=new Map();
      for(const age of AGES){
        const list=bank[age]&&bank[age][mode],tag=age+'세 '+mode;
        if(!Array.isArray(list)){errors.push(tag+': 묶음 없음');continue;}
        if(list.length<12)errors.push(tag+': 12문항 이상이어야 함(현재 '+list.length+')');
        const pos=[];
        list.forEach((q,i)=>{
          const id=q&&q.id?q.id:tag+' #'+i,want='a'+age+'-'+mode+'-'+pad(i+1);
          if(!q||typeof q!=='object'){errors.push(id+': 문항이 객체가 아님');return;}
          if(q.id!==want)errors.push(id+': id는 '+want+'여야 함');
          if(ids.has(q.id))errors.push(id+': id 중복');
          ids.add(q.id);
          if(q.age!==age||q.mode!==mode)errors.push(id+': age/mode가 묶음과 다름');
          const ce=checkCommon(q);
          ce.concat(ce.length?[]:checkLevel(age,mode,q)).forEach(m=>errors.push(id+': '+m));
          const k=keyOf(q);
          if(k!==undefined){
            if(seen.has(k))errors.push(id+': 정답/지문이 '+seen.get(k)+'와 중복');else seen.set(k,id);
          }
          pos.push(q.answer);
          if(i>=2&&pos[i]===pos[i-1]&&pos[i]===pos[i-2])errors.push(id+': 정답 위치가 3문항 연속 같음');
        });
        const tally={};
        pos.forEach(v=>{tally[v]=(tally[v]||0)+1;});
        Object.keys(tally).forEach(v=>{if(tally[v]*2>list.length)errors.push(tag+': 정답 위치 '+v+'가 50%를 넘음');});
      }
    }
    return errors;
  }

  const api={
    AGES:AGES.slice(),MODES:MODES.slice(),LEVELS,
    count(age,mode){return BANK[normAge(age)][normMode(mode)].length;},
    /* index는 0 이상의 정수. 그 밖의 값은 내림 후 순환(-1은 마지막 문항, 숫자가 아니면 0). */
    get(age,mode,index){
      const list=BANK[normAge(age)][normMode(mode)],n=list.length;
      const i=Number.isFinite(index)?Math.floor(index):0;
      return copy(list[((i%n)+n)%n],false);
    },
    validate,
    /* 아래는 검사·도구용 보조 API */
    hangul,checkLevel,checkCommon,
    snapshot(){const o={};for(const a of AGES){o[a]={};for(const m of MODES)o[a][m]=BANK[a][m].map(q=>copy(q,true));}return o;}
  };
  if(typeof module!=='undefined')module.exports=api;
  else root.Questions=api;
})(typeof window!=='undefined'?window:globalThis);
