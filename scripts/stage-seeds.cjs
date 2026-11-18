/* 0.14.1 테스트 모드 '단계로 바로 가기'의 근거: 시뮬(sim-flow.cjs playEnd, 규칙·숫자 그대로)의 아이가 각 단계에 들어선 순간(단계가 세계에 반영된 때 = 문제 사이)과
   종이 열린 순간의 상태를 찍어 판별 중앙값을 낸다. sim-flow.cjs는 고치지 않고, World.sync·Combat.buy를 감싸 그 순간만 본다.
   node scripts/stage-seeds.cjs [판 수=12] [나이=8] [아이=typ] [한 번에 사는 수=3]
   결과(표·JSON)는 docs/game-plan.md §14.9의 표와 testmode.js JUMP_BASE의 근거다. */
const S=require('./sim-flow.cjs'),{C,W,playEnd,med}=S;
const a=process.argv.slice(2),runs=Number(a[0])||12,age=Number(a[1])||8,kind=a[2]||'typ',buys=Number(a[3])||3,t0=Date.now();
const FIELDS=['level','fence','chickens','farmers','pond','power','hall','gold','index','wins'];
let cur=null;
const snap=(s,w)=>{const o={};for(const k of FIELDS)o[k]=s[k]|0;o.count=C.stageCount(s);o.builtNew=C.builtNew(s);o.min=+(w.t*W.TICK/60).toFixed(2);o.fox=s.run.fox|0;o.foxSaved=s.run.foxSaved|0;o.paceTimes=s.paced|0;return o};
const sync0=W.sync;
W.sync=function(w,s,opt){const st0=Number.isSafeInteger(w.stage)?w.stage:-1,r=sync0.apply(this,arguments);
 if(cur&&!(opt&&opt.hold)&&Number.isSafeInteger(w.stage))for(let k=st0+1;k<=w.stage;k++)if(!cur['s'+k])cur['s'+k]=snap(s,w);cur&&(cur.w=w);return r};
const buy0=C.buy;
C.buy=function(s,key){const b0=s.run.bell,r=buy0.apply(this,arguments);if(cur&&b0===0&&s.run.bell===1&&!cur.bell)cur.bell=snap(s,cur.w||{t:0});return r};
const all=[];
for(let i=0;i<runs;i++){cur={};playEnd(age,kind,1000+7919*i,{buys});all.push(cur);cur=null}
const keys=['s1','s2','s3','s4','s5','bell'],NAME={s1:'마을',s2:'장터 마을',s3:'물레방아 마을',s4:'성곽 마을',s5:'성',bell:'결전 직전(종 열림)'};
const out={};
console.log(`== 단계 진입 상태 중앙값 · ${age}세 ${S.NAME[kind]} · 한 번에 ${buys}개 · ${runs}판 · 문턱 ${JSON.stringify(C.stageAt({age}))} · 종 ${C.bellBuilt({age})}`);
console.log('| 단계 | 판 | 지은 수(회관 뺌) | 타워(level) | 울타리 | 닭 | 농부(산 수) | 연못 | 강화 | 회관 | 금화 | 문제 번호 | 한 번에 맞힘 | 여우 | 분 |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for(const k of keys){const xs=all.map(r=>r[k]).filter(Boolean);if(!xs.length){console.log('| '+NAME[k]+' | 0 |');continue}
 const m={};for(const f of [...FIELDS,'count','builtNew','min','fox','foxSaved'])m[f]=med(xs.map(x=>x[f]));out[k]=m;
 console.log(`| ${NAME[k]} | ${xs.length} | ${m.count} | ${m.level} | ${m.fence} | ${m.chickens} | ${m.farmers} | ${m.pond} | ${m.power} | ${m.hall} | ${m.gold} | ${m.index} | ${m.wins} | ${m.fox} | ${m.min} |`)}
console.log(JSON.stringify(out));
console.log(`(${((Date.now()-t0)/1000).toFixed(0)}초)`);
