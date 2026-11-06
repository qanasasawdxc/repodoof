
// ==UserScript==
// @name         PokeSurvivor AutoBot v1.1 (Doofcraft)
// @namespace    https://github.com/
// @version      1.1.0
// @description  Modular bot for PokeSurvivor Doofcraft
// @match        https://pokesurvivor.doofcraft.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(() => {
  "use strict";

  const VERSION = "1.1.0";
  const KEY = "__PSBOT_V11__";
  if (window[KEY]?.stop) window[KEY].stop();

  const cfg = {
    tickMs: 180,
    checkpointMs: 1400,
    autoMove: true,
    autoAttack: true,
    autoDodge: true,
    avoidCrowds: true,
    autoXP: false,
    autoChest: false,
    autoCards: true,
    antiStuck: true,
    passiveFallback: true,
    manual: false,
    skills: ["psybeam", "thunder-wave", "psycho-cut", "swords-dance"]
  };

  const workers = new Set();
  const meta = new WeakMap();
  let activeWorker = null, state = null, running = false;
  let tickTimer = 0, checkpointTimer = 0, seq = Date.now();
  let lastCheckpoint = 0, lastPickAt = 0, lastChoiceKey = "";
  let lastPos = null, stillSince = 0, stuckTurns = 0, escapeUntil = 0;
  let manualVector = {x:0,y:0}, manualHeld = false;
  let panel, statusEl, statsEl, modeEl;

  const $ = (s, root=document) => root.querySelector(s);
  const clamp = (n,a,b) => Math.max(a,Math.min(b,Number.isFinite(n)?n:0));
  const dist = (a,b) => Math.hypot((a.x||0)-(b.x||0),(a.y||0)-(b.y||0));
  const norm = (x,y) => {
    const m=Math.hypot(x,y);
    return m>1e-6?{x:x/m,y:y/m}:{x:0,y:0};
  };
  const arr = v => Array.isArray(v) ? v : [];
  const alive = e => e && Number.isFinite(e.x) &&
    Number.isFinite(e.y) && (e.hp == null || e.hp > 0) && !e.dead;

  const playerOf = s =>
    arr(s?.players).find(p=>p?.connected&&!p.left&&!p.dead) ||
    arr(s?.players).find(p=>p?.connected&&!p.left) ||
    arr(s?.players)[0] || null;

  const say = t => {
    if(statusEl) statusEl.textContent=t;
  };

  const log = (...a) => console.debug("[PSBot "+VERSION+"]",...a);

  function attachWorker(w) {
    if (!w || workers.has(w)) return;
    workers.add(w);
    meta.set(w,{requested:0});

    w.addEventListener("message",ev=>{
      const d=ev.data;
      if(d?.type==="checkpoint" && d.state) {
        activeWorker=w;
        state=d.state;
        lastCheckpoint=Date.now();

        const p=playerOf(state);
        if(p && statsEl) {
          statsEl.textContent =
            `Lv ${state.team?.level ?? "?"} · HP ${Math.round(p.hp??0)}/${Math.round(p.maxHp??0)} · Quái ${arr(state.enemies).filter(alive).length}`;
        }
      }
    });
  }

  // Theo dõi Worker của game
  const NativeWorker=window.Worker;

  if(NativeWorker) {
    try {
      window.Worker=new Proxy(NativeWorker,{
        construct(Target,args) {
          const w=Reflect.construct(Target,args,Target);
          attachWorker(w);
          return w;
        }
      });
    } catch(e) {
      log("Worker hook failed",e);
    }
  }

  function scanWorkers() {
    for(const entry of (window.__PSBOT_STATE__?.workers||[])) {
      attachWorker(entry?.worker);
    }
  }

  function askCheckpoint() {
    scanWorkers();
    const now=Date.now();

    for(const w of workers) {
      const m=meta.get(w);
      if(!m || now-m.requested<cfg.checkpointMs) continue;

      m.requested=now;

      try {
        w.postMessage({type:"checkpoint"});
      } catch(e) {
        log("checkpoint",e);
      }
    }
  }

  function send(x,y,aim,fire) {
    if(!activeWorker) return;

    seq=Math.max(seq+1,Date.now());

    try {
      activeWorker.postMessage({
        type:"input",
        seq,
        moveX:clamp(x,-1,1),
        moveY:clamp(y,-1,1),
        slot:null,
        aim,
        fire:!!fire
      });
    } catch(e) {
      log("input",e);
      activeWorker=null;
    }
  }

  function nearest(list,p) {
    let best=null,bd=Infinity;

    for(const v of list) {
      if(!alive(v)) continue;

      const d=dist(v,p);
      if(d<bd) {
        best=v;
        bd=d;
      }
    }

    return best ? {item:best,d:bd} : null;
  }

  // Dự đoán đường bay của projectile
  function projectileThreats(s,p) {
    const threats=[];

    for(const q of arr(s.projectiles)) {
      if(!q || !Number.isFinite(q.x)||!Number.isFinite(q.y)) continue;

      if(q.owner==="player" || q.team==="player" || q.friendly===true) {
        continue;
      }

      const vx=Number(q.vx ?? q.travelVx ?? q.dx ?? 0);
      const vy=Number(q.vy ?? q.travelVy ?? q.dy ?? 0);

      const rx=p.x-q.x;
      const ry=p.y-q.y;
      const vv=vx*vx+vy*vy;

      if(vv<1e-5) {
        const d=Math.hypot(rx,ry);

        if(d<82) {
          threats.push({x:q.x,y:q.y,d,t:0,projectile:q});
        }

        continue;
      }

      const t=clamp(-(rx*vx+ry*vy)/vv,0,1.35);
      const cx=q.x+vx*t;
      const cy=q.y+vy*t;
      const miss=Math.hypot(p.x-cx,p.y-cy);

      if(t>0.02 && miss<76) {
        threats.push({x:cx,y:cy,d:miss,t,projectile:q});
      }
    }

    return threats.sort((a,b)=>a.t-b.t);
  }

  function dodgeVector(threats,p) {
    if(!threats.length) return null;

    const t=threats[0];
    const away=norm(p.x-t.x,p.y-t.y);
    const q=t.projectile;

    const vx=Number(q.vx ?? q.travelVx ?? q.dx ?? 0);
    const vy=Number(q.vy ?? q.travelVy ?? q.dy ?? 0);

    const sideA=norm(-vy,vx);
    const sideB={x:-sideA.x,y:-sideA.y};

    const score=v=>{
      return (v.x*away.x)+(v.y*away.y);
    };

    const side=score(sideA)>=score(sideB)?sideA:sideB;

    return norm(
      side.x*1.25+away.x*.7,
      side.y*1.25+away.y*.7
    );
  }

  function movement(s,p,enemies) {
    const threats=cfg.autoDodge ? projectileThreats(s,p) : [];
    const dodge=dodgeVector(threats,p);

    if(dodge) {
      return {v:dodge,mode:"NÉ ĐẠN"};
    }

    let x=0,y=0,mode="GIỮ KHOẢNG CÁCH";

    const hpRatio=(p.hp??1)/Math.max(1,p.maxHp??1);
    const crowd=enemies.filter(e=>dist(e,p)<175).length;

    // Chỉ nhặt XP ở gần và khi không quá nguy hiểm
    if(cfg.autoXP && hpRatio>0.35 && crowd<=1 && threats.length===0) {
      const drops=arr(s.pickups)
        .filter(alive)
        .map(o=>({o,d:dist(o,p)}))
        .filter(z=>z.d<190)
        .sort((a,b)=>a.d-b.d);

      if(drops.length) {
        const candidate=drops[0].o;
        x=(candidate.x-p.x)*0.75;
        y=(candidate.y-p.y)*0.75;
        mode="XP AN TOÀN";
      }
    }

    // Tránh quái và đám đông
    let rx=0,ry=0;

    for(const e of enemies) {
      const dx=p.x-e.x;
      const dy=p.y-e.y;
      const d=Math.hypot(dx,dy);
      const radius=hpRatio<0.35?260:cfg.avoidCrowds?165:105;

      if(d>0 && d<radius) {
        const w=(radius-d)/radius;
        rx+=dx/d*w*(hpRatio<0.35?3.0:1.8);
        ry+=dy/d*w*(hpRatio<0.35?3.0:1.8);
      }
    }

    if(hpRatio<0.35 || crowd>=3 || !cfg.autoXP) {
      x=rx;
      y=ry;
      mode=hpRatio<0.35?"HP LOW · RÚT LUI":"NÉ ĐÁM ĐÔNG";

      if(Math.hypot(x,y)<0.1) {
        const n=nearest(enemies,p);

        if(n) {
          x=p.x-n.item.x;
          y=p.y-n.item.y;
        }
      }
    } else {
      x+=rx;
      y+=ry;
    }

    // Chống mắc kẹt bằng cách đổi hướng
    if(cfg.antiStuck) {
      const now=Date.now();

      if(lastPos && dist(lastPos,p)<2 && Math.hypot(x,y)>0.25) {
        if(!stillSince) stillSince=now;

        if(now-stillSince>1350) {
          stuckTurns++;
          escapeUntil=now+1150;
          stillSince=now;
        }
      } else {
        stillSince=0;
      }

      lastPos={x:p.x,y:p.y};

      if(now<escapeUntil) {
        const a=(stuckTurns%2?1:-1)*Math.PI/2;
        const v=norm(x,y);

        return {
          v:norm(
            v.x*Math.cos(a)-v.y*Math.sin(a),
            v.x*Math.sin(a)+v.y*Math.cos(a)
          ),
          mode:"THOÁT KẸT"
        };
      }
    }

    if(Math.hypot(x,y)<0.1) {
      const a=(s.tick||0)*0.017;
      x=Math.cos(a);
      y=Math.sin(a);
    }

    return {v:norm(x,y),mode};
  }

  // Tự chọn thẻ nâng cấp
  function pickCard(s) {
    if(!cfg.autoCards || !activeWorker || Date.now()-lastPickAt<900) {
      return;
    }

    const c=arr(s.pendingChoices)[0];
    const opts=arr(c?.options||c?.cards||c?.choices);

    if(!c?.id||!opts.length) return;

    const key=String(c.id);
    if(key===lastChoiceKey) return;

    const wanted=cfg.skills
      .map(v=>String(v||"").toLowerCase())
      .filter(Boolean);

    const cardId=o=>String(o?.id||"").toLowerCase();

    const skillScore=o=>{
      const id=cardId(o);
      const match=wanted.findIndex(k=>id.includes(k));
      return match>=0 ? 1000-match*10 : -1;
    };

    const chosen=[...opts].sort((a,b)=>{
      const sa=skillScore(a);
      const sb=skillScore(b);

      if(sa!==sb) return sb-sa;

      const up=o=>cardId(o).startsWith("upgrade:")?200:0;

      if(up(a)!==up(b)) return up(b)-up(a);

      return 0;
    });

    let card=chosen[0];

    if(skillScore(card)<0 && cfg.passiveFallback) {
      const passives=opts.filter(o=>
        /^(stat:|passive:|upgrade:)/i.test(cardId(o))
      );

      if(passives.length) {
        card=passives.sort((a,b)=>{
          const rank=id=>
            id.includes("defense")||id.includes("heal")||id.includes("harden")?90:
            id.includes("attack")||id.includes("cooldown")?80:
            id.includes("speed")?60:40;

          return rank(cardId(b))-rank(cardId(a));
        })[0];
      } else {
        return;
      }
    }

    if(!card?.id) return;

    lastPickAt=Date.now();
    lastChoiceKey=key;

    try {
      activeWorker.postMessage({
        type:"intent",
        rid:Date.now(),
        intent:{
          type:"pickCard",
          choiceId:c.id,
          cardId:card.id
        }
      });

      log("card",card.id);
    } catch(e) {
      log("pick failed",e);
    }
  }

  function nearestAim(enemies,p) {
    const n=nearest(enemies,p);
    if(!n) return null;

    const a=Math.atan2(n.item.y-p.y,n.item.x-p.x);

    return Math.round(a/(2*Math.PI)*256+256)%256;
  }

  function tick() {
    if(!running) return;

    askCheckpoint();

    if(!activeWorker||!state) {
      say(`Đang tìm Worker… (${workers.size})`);
      return;
    }

    const p=playerOf(state);

    if(!p||p.dead||state.ended) {
      send(0,0,null,false);
      say(state.ended?"Ván đã kết thúc":"Người chơi đã gục");
      return;
    }

    pickCard(state);

    const enemies=arr(state.enemies).filter(alive);
    const aim=cfg.autoAttack?nearestAim(enemies,p):null;

    let v={x:0,y:0};
    let mode="ĐỨNG YÊN";

    if(cfg.manual && manualHeld) {
      v=manualVector;
      mode="ĐIỀU KHIỂN TAY";
    } else if(cfg.autoMove) {
      const m=movement(state,p,enemies);
      v=m.v;
      mode=m.mode;
    }

    send(v.x,v.y,aim,cfg.autoAttack&&enemies.length>0);

    if(modeEl) modeEl.textContent=mode;

    const age=Math.round((Date.now()-lastCheckpoint)/1000);

    say(`Đang chạy · ${mode} · dữ liệu ${age}s`);
  }

  const toggles=[
    ["autoMove","Tự di chuyển"],
    ["autoAttack","Tự động tấn công"],
    ["autoDodge","Tự né đạn / chiêu"],
    ["avoidCrowds","Tránh boss và quái đông"],
    ["autoXP","Tự nhặt XP (chỉ khi an toàn)"],
    ["autoChest","Tự tìm và mở rương"],
    ["autoCards","Tự chọn thẻ nâng cấp"],
    ["passiveFallback","Fallback sang Passive"],
    ["antiStuck","Chống mắc kẹt"]
  ];

  function buildPanel() {
    if(panel?.isConnected) return;

    panel=document.createElement("section");
    panel.id="psbot-v11-panel";

    panel.style.cssText=
      "position:fixed;z-index:2147483647;right:12px;top:12px;width:270px;max-height:85vh;overflow:auto;padding:12px;border-radius:12px;background:rgba(15,18,25,.96);color:#fff;font:12px/1.4 -apple-system,BlinkMacSystemFont,sans-serif;box-shadow:0 5px 24px #0008";

    const rows=toggles.map(([k,label])=>
      `<label style="display:flex;justify-content:space-between;gap:8px;margin:7px 0"><span>${label}</span><input type="checkbox" data-toggle="${k}" ${cfg[k]?"checked":""}></label>`
    ).join("");

    const skillOptions=[
      ["psybeam","Psybeam"],
      ["thunder-wave","Thunder Wave"],
      ["psycho-cut","Psycho Cut"],
      ["swords-dance","Swords Dance"],
      ["harden","Harden"],
      ["agility","Agility"],
      ["confusion","Confusion"],
      ["rock-tomb","Rock Tomb"]
    ];

    const selects=cfg.skills.map((v,i)=>
      `<label style="display:flex;align-items:center;gap:6px;margin:5px 0"><span style="width:42px">Chiêu ${i+1}</span><select data-skill="${i}" style="flex:1;min-width:0;padding:5px;border-radius:6px">${skillOptions.map(([k,n])=>`<option value="${k}" ${v===k?"selected":""}>${n}</option>`).join("")}</select></label>`
    ).join("");

    panel.innerHTML=`
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <b>⚡ PSBot v${VERSION}</b>
        <button id="psb-close">×</button>
      </div>

      <div id="psb-status">Đã nạp · chưa chạy</div>
      <div id="psb-stats">Chưa có dữ liệu game</div>

      <button id="psb-start" style="width:100%;padding:8px;background:#16834a;color:white;border:0;border-radius:7px">
        BẮT ĐẦU
      </button>

      <div style="border-top:1px solid #ffffff33;margin:10px 0;padding-top:8px">
        <b>Chức năng riêng ON/OFF</b>
        ${rows}
      </div>

      <div style="border-top:1px solid #ffffff33;margin:10px 0;padding-top:8px">
        <b>4 chiêu ưu tiên</b>
        ${selects}
        <small>Nếu không có 4 chiêu này, bot chọn Passive nếu bật fallback.</small>
      </div>

      <div style="border-top:1px solid #ffffff33;margin:10px 0;padding-top:8px">
        <label><input id="psb-manual" type="checkbox"> Bật điều khiển 4 hướng thủ công</label>

        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-top:7px">
          <span></span><button data-dir="up">↑</button><span></span>
          <button data-dir="left">←</button><button data-dir="stop">■</button><button data-dir="right">→</button>
          <span></span><button data-dir="down">↓</button><span></span>
        </div>
      </div>

      <div style="border-top:1px solid #ffffff33;margin-top:9px;padding-top:7px;opacity:.7">
        <b>Rương:</b> chưa bật thao tác mở rương vì chưa xác minh được dữ liệu rương của bản Doofcraft.
      </div>
    `;

    (document.documentElement||document.body).appendChild(panel);

    statusEl=$("#psb-status",panel);
    statsEl=$("#psb-stats",panel);
    modeEl=$("#psb-mode",panel);

    $("#psb-start",panel).onclick=()=>running?stop():start();

    $("#psb-close",panel).onclick=()=>{
      stop();
      panel.remove();
      panel=null;
    };

    panel.querySelectorAll("[data-toggle]").forEach(el=>
      el.addEventListener("change",()=>{
        cfg[el.dataset.toggle]=el.checked;
      })
    );

    panel.querySelectorAll("[data-skill]").forEach(el=>
      el.addEventListener("change",()=>{
        cfg.skills[Number(el.dataset.skill)]=el.value;
      })
    );

    $("#psb-manual",panel).addEventListener("change",e=>{
      cfg.manual=e.target.checked;
      manualHeld=false;
    });

    const dirs={
      up:{x:0,y:-1},
      down:{x:0,y:1},
      left:{x:-1,y:0},
      right:{x:1,y:0},
      stop:{x:0,y:0}
    };

    panel.querySelectorAll("[data-dir]").forEach(btn=>{
      const down=e=>{
        e.preventDefault();
        manualHeld=btn.dataset.dir!=="stop";
        manualVector=dirs[btn.dataset.dir];
      };

      const up=()=>{
        manualHeld=false;
        manualVector={x:0,y:0};
      };

      btn.addEventListener("pointerdown",down);
      btn.addEventListener("pointerup",up);
      btn.addEventListener("pointercancel",up);
      btn.addEventListener("pointerleave",up);

      btn.style.cssText=
        "padding:8px;border:0;border-radius:6px;background:#394150;color:white;font-size:18px";
    });
  }

  function start() {
    if(running) return;

    running=true;
    buildPanel();

    $("#psb-start",panel).textContent="DỪNG BOT";
    $("#psb-start",panel).style.background="#b33a3a";

    say("Đang tìm Worker…");
    askCheckpoint();

    tickTimer=setInterval(tick,cfg.tickMs);
    checkpointTimer=setInterval(askCheckpoint,cfg.checkpointMs);

    tick();
  }

  function stop() {
    running=false;

    clearInterval(tickTimer);
    clearInterval(checkpointTimer);

    tickTimer=checkpointTimer=0;

    if(activeWorker) send(0,0,null,false);

    if(panel?.isConnected) {
      const b=$("#psb-start",panel);

      if(b) {
        b.textContent="BẮT ĐẦU";
        b.style.background="#16834a";
      }
    }

    say("Đã dừng");
  }

  function status() {
    return {
      version:VERSION,
      running,
      workers:workers.size,
      connected:!!activeWorker,
      tick:state?.tick,
      time:state?.time,
      config:{...cfg}
    };
  }

  window[KEY]={start,stop,status,config:cfg};

  buildPanel();
  scanWorkers();

  say("Đã nạp · bấm BẮT ĐẦU");
  log("loaded; start manually");
})();
