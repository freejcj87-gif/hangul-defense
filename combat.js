/* Deterministic, serializable combat rules. No renderer or clock dependency. */
(function(root){
  const api={
    create(stage=0){
      const tier=Math.min(8,Math.floor(Math.max(0,stage)/3));
      return {version:1,stage,elapsed:0,cooldown:0,leaked:0,kills:0,done:false,
        enemies:Array.from({length:Math.min(5,2+Math.floor(tier/2))},(_,id)=>({
          id,x:92+id*19,hp:22+tier*8,maxHp:22+tier*8,speed:7+tier*.55,escaped:false
        }))};
    },
    valid(b){
      return !!b && b.version===1 && Number.isSafeInteger(b.stage) && b.stage>=0 &&
        Number.isFinite(b.elapsed)&&b.elapsed>=0 && Number.isFinite(b.cooldown)&&b.cooldown>=0 &&
        Number.isSafeInteger(b.kills)&&b.kills>=0 && Number.isSafeInteger(b.leaked)&&b.leaked>=0 &&
        typeof b.done==='boolean'&&Array.isArray(b.enemies)&&b.enemies.length>=2&&b.enemies.length<=5 &&
        b.enemies.every((e,i)=>e.id===i&&Number.isFinite(e.x)&&e.x>=0&&e.x<=200&&
          Number.isFinite(e.hp)&&e.hp>=0&&Number.isFinite(e.maxHp)&&e.maxHp>0&&e.hp<=e.maxHp&&
          Number.isFinite(e.speed)&&e.speed>0&&e.speed<20&&typeof e.escaped==='boolean');
    },
    step(b,level,dt){
      const events=[];
      if(b.done||!Number.isFinite(dt)||dt<=0)return events;
      dt=Math.min(dt,.1);level=Math.max(0,Math.min(5,Math.floor(level)||0));
      b.elapsed+=dt;b.cooldown=Math.max(0,b.cooldown-dt);
      for(const e of b.enemies){
        if(e.hp<=0||e.escaped)continue;
        e.x=Math.max(0,e.x-e.speed*dt);
        if(e.x<=15){e.escaped=true;b.leaked++;events.push({type:'leak',id:e.id,damage:15});}
      }
      const target=b.enemies.filter(e=>e.hp>0&&!e.escaped&&e.x<=67).sort((a,b)=>a.x-b.x)[0];
      if(level>0&&target&&b.cooldown===0){
        const damage=6+level*5;target.hp=Math.max(0,target.hp-damage);
        b.cooldown=Math.max(.45,1.3-level*.15);
        events.push({type:'hit',id:target.id,x:target.x,damage});
        if(target.hp===0){b.kills++;events.push({type:'kill',id:target.id,x:target.x});}
      }
      b.done=b.enemies.every(e=>e.hp<=0||e.escaped);
      if(b.done)events.push({type:'end',won:b.leaked===0});
      return events;
    }
  };
  if(typeof module!=='undefined')module.exports=api;
  else root.Combat=api;
})(typeof window!=='undefined'?window:globalThis);
