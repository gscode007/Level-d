import { useState, useEffect, useCallback } from "react";

const FontLink = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;600&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    input, select, textarea, button { font-family: inherit; }
    input[type=range] { -webkit-appearance: none; appearance: none; height: 2px; background: #e5e5ea; border-radius: 1px; outline: none; cursor:pointer; }
    input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%; background: #1d1d1f; border: none; cursor: pointer; box-shadow:0 1px 4px rgba(0,0,0,0.15); }
    * { -webkit-font-smoothing: antialiased; }
    @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
    @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
    button:active { transform: scale(0.98); }
  `}</style>
);

const CATEGORIES = ["Emotional","Intellectual","Physical","Creational","Resilience"];
const CAT_META = {
  Emotional:    { symbol:"♡", accent:"#ff6b6b" },
  Intellectual: { symbol:"◇", accent:"#5b8dee" },
  Physical:     { symbol:"△", accent:"#20c997" },
  Creational:   { symbol:"✦", accent:"#f7b731" },
  Resilience:   { symbol:"○", accent:"#a55eea" },
};
const RANKS = ["E","D","C","B","A","S"];
const RANK_THRESHOLDS = { E:0, D:100, C:250, B:500, A:800, S:1200 };
const RANK_COLOR = { E:"#8e8e93", D:"#34c759", C:"#32ade6", B:"#5b8dee", A:"#ff9f0a", S:"#ff6b6b" };

const getRank = s => { let r="E"; for(const [k,t] of Object.entries(RANK_THRESHOLDS)) if(s>=t) r=k; return r; };
const getNextThresh = r => { const i=RANKS.indexOf(r); return i>=RANKS.length-1?null:RANK_THRESHOLDS[RANKS[i+1]]; };
const getRankPct = (s,r) => { const c=RANK_THRESHOLDS[r],n=getNextThresh(r); if(!n) return 100; return Math.min(100,Math.round(((s-c)/(n-c))*100)); };
const genId = () => Math.random().toString(36).slice(2,10);
const todayStr = () => new Date().toDateString();
const getOverallScore = (scores, weights) => {
  const total=Object.values(weights).reduce((s,v)=>s+v,0);
  if(!total) return 0;
  return CATEGORIES.reduce((sum,c)=>sum+(scores[c]||0)*(weights[c]||0)/total,0);
};

const mkLevel = (n=1) => ({
  id:genId(), num:n, title:"",
  categoryGoals:Object.fromEntries(CATEGORIES.map(c=>[c,""])),
  weights:Object.fromEntries(CATEGORIES.map(c=>[c,20])),
  requiredRank:"A", goals:[], startedAt:Date.now(),
});
const mkDefault = () => {
  const lv=mkLevel(1);
  return { levels:[lv], currentLevelId:lv.id, catScores:Object.fromEntries(CATEGORIES.map(c=>[c,0])), catRanks:Object.fromEntries(CATEGORIES.map(c=>[c,"E"])), streaks:{}, lastCompletions:{}, setupDone:false };
};

export default function App() {
  const [state, setState] = useState(() => {
    try { const s=localStorage.getItem("lrpg_v3"); return s?JSON.parse(s):mkDefault(); }
    catch { return mkDefault(); }
  });
  const [view, setView] = useState("dashboard");
  const [toast, setToast] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addType, setAddType] = useState("habitual");

  useEffect(() => { localStorage.setItem("lrpg_v3",JSON.stringify(state)); }, [state]);

  const notify = useCallback((msg) => {
    setToast(msg);
    setTimeout(()=>setToast(null),2600);
  },[]);

  const currentLevel = state.levels.find(l=>l.id===state.currentLevelId)||state.levels[0];

  const updLv = useCallback((patch) => {
    setState(s=>({...s,levels:s.levels.map(l=>l.id===s.currentLevelId?{...l,...patch}:l)}));
  },[]);

  function finishSetup(title,categoryGoals,weights,requiredRank) {
    updLv({title,categoryGoals,weights,requiredRank});
    setState(s=>({...s,setupDone:true}));
    setView("dashboard");
  }

  function addGoal(goal) {
    updLv({goals:[...currentLevel.goals,{...goal,id:genId(),completions:[]}]});
    notify("Goal added");
  }
  function deleteGoal(id) { updLv({goals:currentLevel.goals.filter(g=>g.id!==id)}); }

  function completeHabitual(goalId) {
    const goal=currentLevel.goals.find(g=>g.id===goalId);
    if(!goal) return;
    const t=todayStr();
    if(state.lastCompletions[goalId]===t){ notify("Already done today"); return; }
    const pts=goal.weight||10;
    const yesterday=new Date(); yesterday.setDate(yesterday.getDate()-1);
    const yStr=yesterday.toDateString();
    const newStreaks={...state.streaks,[goalId]:(state.lastCompletions[goalId]===yStr?(state.streaks[goalId]||0)+1:1)};
    const newScores={...state.catScores,[goal.category]:(state.catScores[goal.category]||0)+pts};
    const newRanks={...state.catRanks,[goal.category]:getRank(newScores[goal.category])};
    const newLevels=state.levels.map(l=>l.id===currentLevel.id?{...l,goals:l.goals.map(g=>g.id===goalId?{...g,completions:[...(g.completions||[]),Date.now()]}:g)}:l);
    setState(s=>({...s,levels:newLevels,catScores:newScores,catRanks:newRanks,streaks:newStreaks,lastCompletions:{...s.lastCompletions,[goalId]:t}}));
    notify(`+${pts} XP · ${goal.category}`);
  }

  function completeMilestoneStep(goalId,stepIdx) {
    const goal=currentLevel.goals.find(g=>g.id===goalId);
    if(!goal) return;
    const step=goal.milestoneSteps[stepIdx];
    if(!step||step.completed) return;
    const pts=step.weight||20;
    const newScores={...state.catScores,[goal.category]:(state.catScores[goal.category]||0)+pts};
    const newRanks={...state.catRanks,[goal.category]:getRank(newScores[goal.category])};
    const updSteps=goal.milestoneSteps.map((s,i)=>i===stepIdx?{...s,completed:true}:s);
    const allDone=updSteps.every(s=>s.completed);
    const newLevels=state.levels.map(l=>l.id===currentLevel.id?{...l,goals:l.goals.map(g=>g.id===goalId?{...g,milestoneSteps:updSteps,completed:allDone}:g)}:l);
    setState(s=>({...s,levels:newLevels,catScores:newScores,catRanks:newRanks}));
    notify(allDone?`Milestone complete!`:`+${pts} XP`);
  }

  function advanceLevel() {
    const newLv=mkLevel(state.levels.length+1);
    setState(s=>({...s,levels:[...s.levels,newLv],currentLevelId:newLv.id,setupDone:false}));
    setView("dashboard");
  }

  const overallScore=getOverallScore(state.catScores,currentLevel.weights);
  const overallRank=getRank(overallScore);
  const levelComplete=RANKS.indexOf(overallRank)>=RANKS.indexOf(currentLevel.requiredRank||"A");

  if(!state.setupDone) return <SetupScreen level={currentLevel} onFinish={finishSetup}/>;

  return (
    <div style={S.app}>
      <FontLink/>
      {toast && <div style={S.toast}>{toast}</div>}
      <Sidebar view={view} setView={setView} levelNum={currentLevel.num} overallRank={overallRank}/>
      <main style={S.main}>
        {view==="dashboard" && <Dashboard state={state} level={currentLevel} overallScore={overallScore} overallRank={overallRank} levelComplete={levelComplete} onAdvance={advanceLevel}/>}
        {view==="goals" && <GoalsView level={currentLevel} state={state} onAddGoal={addGoal} onDeleteGoal={deleteGoal} onCompleteHabitual={completeHabitual} onCompleteMilestoneStep={completeMilestoneStep} addOpen={addOpen} setAddOpen={setAddOpen} addType={addType} setAddType={setAddType}/>}
        {view==="history" && <HistoryView state={state}/>}
      </main>
    </div>
  );
}

/* ── SETUP ─────────────────────────────────────────────────────────────────── */
function SetupScreen({ level, onFinish }) {
  const [step,setStep]=useState(0);
  const [title,setTitle]=useState(level.title||"");
  const [catGoals,setCatGoals]=useState({...level.categoryGoals});
  const [weights,setWeights]=useState({...level.weights});
  const [reqRank,setReqRank]=useState(level.requiredRank||"A");

  function setWeight(cat,raw) {
    const v=Math.max(0,Math.min(100,parseInt(raw)||0));
    const others=CATEGORIES.filter(c=>c!==cat);
    const remaining=100-v;
    const oldTotal=others.reduce((s,c)=>s+(weights[c]||0),0);
    const nw={...weights,[cat]:v};
    if(oldTotal===0){
      const each=Math.floor(remaining/others.length);
      const leftover=remaining-each*(others.length-1);
      others.forEach((c,i)=>{ nw[c]=i===others.length-1?leftover:each; });
    } else {
      let dist=0;
      others.forEach((c,i)=>{
        if(i===others.length-1){ nw[c]=Math.max(0,remaining-dist); }
        else { const share=Math.round((weights[c]/oldTotal)*remaining); nw[c]=Math.max(0,share); dist+=nw[c]; }
      });
    }
    setWeights(nw);
  }

  const STEPS=["Level Title","Category Goals","Weights"];

  return (
    <div style={S.setupWrap}>
      <FontLink/>
      <div style={S.setupCard}>
        <div style={S.stepRow}>
          {STEPS.map((label,i)=>(
            <div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5}}>
              <div style={{width:26,height:26,borderRadius:"50%",background:i<=step?"#1d1d1f":"#e5e5ea",color:i<=step?"#fff":"#8e8e93",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:600,transition:"all 0.2s"}}>
                {i<step?"✓":i+1}
              </div>
              <span style={{fontSize:11,color:i===step?"#1d1d1f":"#8e8e93",fontWeight:i===step?500:400}}>{label}</span>
            </div>
          ))}
        </div>

        {step===0 && (
          <div style={{animation:"fadeUp 0.3s ease"}}>
            <p style={S.eyebrow}>Level {level.num}</p>
            <h1 style={S.setupH}>Name this chapter<br/>of your life</h1>
            <p style={S.setupDesc}>A short title for this phase — this is the name of your level.</p>
            <input style={S.bigInput} value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g., Building the Foundation" autoFocus
              onKeyDown={e=>e.key==="Enter"&&title.trim()&&setStep(1)}/>
            <button style={{...S.nextBtn,opacity:title.trim()?1:0.35}} disabled={!title.trim()} onClick={()=>setStep(1)}>Continue →</button>
          </div>
        )}

        {step===1 && (
          <div style={{animation:"fadeUp 0.3s ease"}}>
            <p style={S.eyebrow}>{title}</p>
            <h1 style={S.setupH}>One goal per<br/>dimension</h1>
            <p style={S.setupDesc}>Set the main goal you want to achieve in each category this level.</p>
            <div style={{display:"flex",flexDirection:"column",gap:10,marginTop:8}}>
              {CATEGORIES.map(cat=>(
                <div key={cat} style={S.catGoalRow}>
                  <div style={S.catGoalLbl}>
                    <span style={{color:CAT_META[cat].accent,fontSize:15}}>{CAT_META[cat].symbol}</span>
                    <span style={{fontSize:13,fontWeight:500,color:"#1d1d1f"}}>{cat}</span>
                  </div>
                  <input style={S.inlineInput} value={catGoals[cat]} onChange={e=>setCatGoals(g=>({...g,[cat]:e.target.value}))} placeholder={`Your ${cat.toLowerCase()} goal…`}/>
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:10,marginTop:24}}>
              <button style={S.backBtn} onClick={()=>setStep(0)}>← Back</button>
              <button style={S.nextBtn} onClick={()=>setStep(2)}>Continue →</button>
            </div>
          </div>
        )}

        {step===2 && (
          <div style={{animation:"fadeUp 0.3s ease"}}>
            <p style={S.eyebrow}>{title}</p>
            <h1 style={S.setupH}>Prioritize your<br/>dimensions</h1>
            <p style={S.setupDesc}>Drag a slider — the others adjust automatically so the total stays 100%.</p>
            <div style={{display:"flex",flexDirection:"column",gap:20,marginTop:16}}>
              {CATEGORIES.map(cat=>(
                <div key={cat}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{color:CAT_META[cat].accent,fontSize:14}}>{CAT_META[cat].symbol}</span>
                      <span style={{fontSize:13,fontWeight:500,color:"#1d1d1f"}}>{cat}</span>
                    </div>
                    <span style={{fontSize:13,fontWeight:600,color:"#1d1d1f",fontVariantNumeric:"tabular-nums"}}>{weights[cat]}%</span>
                  </div>
                  <div style={{position:"relative",height:2}}>
                    <div style={{position:"absolute",top:0,left:0,height:"100%",width:`${weights[cat]}%`,background:CAT_META[cat].accent,borderRadius:1,pointerEvents:"none",transition:"width 0.1s"}}/>
                    <input type="range" min={0} max={100} value={weights[cat]} onChange={e=>setWeight(cat,e.target.value)} style={{position:"absolute",top:-8,left:0,width:"100%",background:"transparent",zIndex:1}}/>
                  </div>
                </div>
              ))}
            </div>
            <div style={{marginTop:28}}>
              <p style={{fontSize:11,fontWeight:500,color:"#8e8e93",letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:10}}>Target rank to complete this level</p>
              <div style={{display:"flex",gap:8}}>
                {RANKS.map(r=>(
                  <button key={r} onClick={()=>setReqRank(r)} style={{...S.rankPill,background:reqRank===r?"#1d1d1f":"transparent",color:reqRank===r?"#fff":"#8e8e93",border:`1px solid ${reqRank===r?"#1d1d1f":"#e5e5ea"}`}}>{r}</button>
                ))}
              </div>
            </div>
            <div style={{display:"flex",gap:10,marginTop:24}}>
              <button style={S.backBtn} onClick={()=>setStep(1)}>← Back</button>
              <button style={S.nextBtn} onClick={()=>onFinish(title,catGoals,weights,reqRank)}>Begin Level {level.num}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── SIDEBAR ───────────────────────────────────────────────────────────────── */
function Sidebar({ view, setView, levelNum, overallRank }) {
  return (
    <aside style={S.sidebar}>
      <div>
        <div style={{padding:"28px 22px 0"}}>
          <div style={{fontSize:15,fontWeight:600,color:"#1d1d1f",letterSpacing:"-0.01em"}}>Life RPG</div>
          <div style={{fontSize:12,color:"#8e8e93",marginTop:3}}>Level {levelNum} · Rank {overallRank}</div>
        </div>
        <nav style={{marginTop:20,padding:"0 12px"}}>
          {[["dashboard","Dashboard"],["goals","Goals"],["history","History"]].map(([id,label])=>(
            <button key={id} onClick={()=>setView(id)} style={{
              ...S.navItem,
              background:view===id?"rgba(0,0,0,0.05)":"transparent",
              color:view===id?"#1d1d1f":"#8e8e93",
              fontWeight:view===id?500:400,
            }}>{label}</button>
          ))}
        </nav>
      </div>
    </aside>
  );
}

/* ── DASHBOARD ─────────────────────────────────────────────────────────────── */
function Dashboard({ state, level, overallScore, overallRank, levelComplete, onAdvance }) {
  return (
    <div style={S.page}>
      <header style={S.pageHead}>
        <div>
          <p style={S.eyebrow}>Level {level.num}</p>
          <h1 style={S.pageH1}>{level.title||"Your Journey"}</h1>
        </div>
        {levelComplete && <button style={S.advBtn} onClick={onAdvance}>Advance →</button>}
      </header>

      {/* Hero overall */}
      <div style={S.heroCard}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <p style={{fontSize:11,color:"#8e8e93",letterSpacing:"0.06em",textTransform:"uppercase",fontWeight:500,marginBottom:8}}>Overall Rank</p>
            <div style={{fontSize:64,fontWeight:300,color:"#1d1d1f",fontFamily:"'Instrument Serif',serif",lineHeight:1,letterSpacing:"-0.02em"}}>{overallRank}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <p style={{fontSize:11,color:"#8e8e93",letterSpacing:"0.06em",textTransform:"uppercase",fontWeight:500,marginBottom:8}}>Score</p>
            <div style={{fontSize:32,fontWeight:300,color:"#1d1d1f",fontFamily:"'Instrument Serif',serif"}}>{Math.round(overallScore)}</div>
          </div>
        </div>
        <div style={{marginTop:24}}>
          <div style={{height:1,background:"#f0f0f0",borderRadius:1}}>
            <div style={{height:"100%",width:`${getRankPct(overallScore,overallRank)}%`,background:"#1d1d1f",borderRadius:1,transition:"width 0.6s ease"}}/>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:8,fontSize:11,color:"#b0b0b5"}}>
            <span>Rank {overallRank}</span>
            {getNextThresh(overallRank)?<span>{getNextThresh(overallRank)-Math.round(overallScore)} XP to {RANKS[RANKS.indexOf(overallRank)+1]}</span>:<span>Maximum rank achieved</span>}
          </div>
        </div>
      </div>

      {/* Category grid */}
      <div style={S.catGrid}>
        {CATEGORIES.map(cat=>(
          <CatCard key={cat} cat={cat} score={state.catScores[cat]||0} rank={state.catRanks[cat]||"E"} goal={level.categoryGoals?.[cat]||""} weight={level.weights?.[cat]||0}/>
        ))}
      </div>

      <div style={S.twoUp}>
        <RadarPanel scores={state.catScores}/>
        <TodayPanel level={level} lastCompletions={state.lastCompletions} streaks={state.streaks}/>
      </div>
    </div>
  );
}

function CatCard({ cat, score, rank, goal, weight }) {
  const {symbol,accent}=CAT_META[cat];
  const pct=getRankPct(score,rank);
  return (
    <div style={S.catCard}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{display:"flex",alignItems:"center",gap:7}}>
          <span style={{color:accent,fontSize:16}}>{symbol}</span>
          <span style={{fontSize:13,fontWeight:500,color:"#1d1d1f"}}>{cat}</span>
        </div>
        <span style={{fontSize:11,fontWeight:700,color:RANK_COLOR[rank],background:`${RANK_COLOR[rank]}18`,padding:"3px 8px",borderRadius:20,letterSpacing:"0.04em"}}>{rank}</span>
      </div>
      {goal && <p style={{fontSize:12,color:"#8e8e93",marginBottom:12,lineHeight:1.45,minHeight:32}}>{goal}</p>}
      <div style={{fontSize:24,fontWeight:300,color:"#1d1d1f",fontFamily:"'Instrument Serif',serif",marginBottom:10}}>{Math.round(score)}</div>
      <div style={{height:1.5,background:"#f0f0f0",borderRadius:1}}>
        <div style={{height:"100%",width:`${pct}%`,background:accent,borderRadius:1,transition:"width 0.5s ease"}}/>
      </div>
      <div style={{fontSize:11,color:"#b0b0b5",marginTop:6}}>{weight}% weight</div>
    </div>
  );
}

function RadarPanel({ scores }) {
  const N=CATEGORIES.length,cx=130,cy=130,r=88;
  const maxS=Math.max(...CATEGORIES.map(c=>scores[c]||0),200);
  const pt=(i,val)=>{ const a=(i/N)*Math.PI*2-Math.PI/2,d=(val/maxS)*r; return [cx+Math.cos(a)*d,cy+Math.sin(a)*d]; };
  const ax=(i,sc=1)=>{ const a=(i/N)*Math.PI*2-Math.PI/2; return [cx+Math.cos(a)*r*sc,cy+Math.sin(a)*r*sc]; };
  const poly=CATEGORIES.map((c,i)=>pt(i,scores[c]||0).join(",")).join(" ");
  return (
    <div style={S.panel}>
      <p style={S.panelLbl}>Dimension Balance</p>
      <svg viewBox="0 0 260 260" style={{width:"100%",maxWidth:220,display:"block",margin:"0 auto"}}>
        {[0.25,0.5,0.75,1].map((lv,i)=>(
          <polygon key={i} points={CATEGORIES.map((_,j)=>ax(j,lv).join(",")).join(" ")} fill="none" stroke="#f0f0f0" strokeWidth={1}/>
        ))}
        {CATEGORIES.map((_,i)=>{ const [x,y]=ax(i); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#f0f0f0" strokeWidth={1}/>; })}
        <polygon points={poly} fill="rgba(29,29,31,0.05)" stroke="#1d1d1f" strokeWidth={1.5}/>
        {CATEGORIES.map((c,i)=>{ const [px,py]=pt(i,scores[c]||0); return <circle key={c} cx={px} cy={py} r={3.5} fill={CAT_META[c].accent}/>; })}
        {CATEGORIES.map((c,i)=>{ const [lx,ly]=ax(i,1.25); return <text key={c} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill="#8e8e93" fontFamily="Geist,sans-serif" fontWeight={500}>{c.slice(0,3).toUpperCase()}</text>; })}
      </svg>
    </div>
  );
}

function TodayPanel({ level, lastCompletions, streaks }) {
  const t=todayStr();
  const habits=level.goals.filter(g=>g.type==="habitual");
  const done=habits.filter(g=>lastCompletions[g.id]===t).length;
  return (
    <div style={S.panel}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <p style={S.panelLbl}>Today's Habits</p>
        <span style={{fontSize:12,color:"#8e8e93"}}>{done}/{habits.length}</span>
      </div>
      {habits.length===0 && <p style={{fontSize:13,color:"#b0b0b5"}}>No habitual goals yet.</p>}
      {habits.map(g=>{
        const isDone=lastCompletions[g.id]===t;
        const streak=streaks[g.id]||0;
        return (
          <div key={g.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:"1px solid #f5f5f7",opacity:isDone?0.4:1,transition:"opacity 0.2s"}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:CAT_META[g.category]?.accent||"#ccc",flexShrink:0}}/>
            <span style={{fontSize:13,color:"#1d1d1f",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{g.name}</span>
            {streak>1&&<span style={{fontSize:11,color:"#ff9f0a",flexShrink:0}}>{streak}d</span>}
            <span style={{fontSize:12,color:isDone?"#34c759":"#b0b0b5",flexShrink:0}}>{isDone?"✓":`+${g.weight}`}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ── GOALS ─────────────────────────────────────────────────────────────────── */
function GoalsView({ level, state, onAddGoal, onDeleteGoal, onCompleteHabitual, onCompleteMilestoneStep, addOpen, setAddOpen, addType, setAddType }) {
  const [tab,setTab]=useState("habitual");
  const t=todayStr();
  const habitual=level.goals.filter(g=>g.type==="habitual");
  const milestones=level.goals.filter(g=>g.type==="milestone");

  return (
    <div style={S.page}>
      <header style={S.pageHead}>
        <div>
          <p style={S.eyebrow}>Level {level.num} · {level.title}</p>
          <h1 style={S.pageH1}>Goals</h1>
        </div>
        <button style={S.addBtn} onClick={()=>{setAddType(tab);setAddOpen(true);}}>+ Add</button>
      </header>

      {/* Category goals reference strip */}
      <div style={S.catStrip}>
        {CATEGORIES.map(cat=>(
          <div key={cat} style={{display:"flex",alignItems:"flex-start",gap:7,flex:1,minWidth:0}}>
            <span style={{color:CAT_META[cat].accent,fontSize:14,marginTop:1,flexShrink:0}}>{CAT_META[cat].symbol}</span>
            <div style={{minWidth:0}}>
              <div style={{fontSize:11,fontWeight:500,color:"#1d1d1f"}}>{cat}</div>
              <div style={{fontSize:11,color:"#8e8e93",marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{level.categoryGoals?.[cat]||"—"}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={S.tabRow}>
        {[["habitual",`Habits (${habitual.length})`],["milestone",`Milestones (${milestones.length})`]].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{...S.tab,color:tab===id?"#1d1d1f":"#8e8e93",borderBottom:tab===id?"1.5px solid #1d1d1f":"1.5px solid transparent"}}>{label}</button>
        ))}
      </div>

      {tab==="habitual" && (
        <div>
          {habitual.length===0 && <EmptyHint text="Daily habits earn XP every completion." onAdd={()=>{setAddType("habitual");setAddOpen(true);}}/>}
          {habitual.map(g=>{
            const isDone=state.lastCompletions[g.id]===t;
            const streak=state.streaks[g.id]||0;
            return (
              <div key={g.id} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 0",borderBottom:"1px solid #f5f5f7"}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:CAT_META[g.category]?.accent||"#ccc",flexShrink:0}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:14,color:isDone?"#b0b0b5":"#1d1d1f"}}>{g.name}</div>
                  <div style={{fontSize:12,color:"#b0b0b5",marginTop:2}}>{g.category} · +{g.weight} XP{streak>1?` · 🔥 ${streak} days`:""}</div>
                </div>
                <button onClick={()=>onCompleteHabitual(g.id)} disabled={isDone} style={{
                  width:26,height:26,borderRadius:"50%",border:`1.5px solid ${isDone?"#34c759":"#d0d0d5"}`,
                  background:isDone?"#34c759":"transparent",color:isDone?"#fff":"transparent",
                  cursor:isDone?"default":"pointer",fontSize:13,fontWeight:600,flexShrink:0,transition:"all 0.15s",
                }}>✓</button>
                <button onClick={()=>onDeleteGoal(g.id)} style={S.delBtn}>✕</button>
              </div>
            );
          })}
        </div>
      )}

      {tab==="milestone" && (
        <div style={{display:"flex",flexDirection:"column",gap:12,marginTop:4}}>
          {milestones.length===0 && <EmptyHint text="Define big objectives broken into steps." onAdd={()=>{setAddType("milestone");setAddOpen(true);}}/>}
          {milestones.map(g=>{
            const doneCount=g.milestoneSteps.filter(s=>s.completed).length;
            const total=g.milestoneSteps.length;
            const pct=total?Math.round((doneCount/total)*100):0;
            return (
              <div key={g.id} style={S.mCard}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:500,color:"#1d1d1f"}}>{g.name}</div>
                    <div style={{fontSize:12,color:"#8e8e93",marginTop:2}}>{g.category} · {doneCount}/{total} steps</div>
                  </div>
                  <button onClick={()=>onDeleteGoal(g.id)} style={S.delBtn}>✕</button>
                </div>
                <div style={{height:1.5,background:"#f0f0f0",borderRadius:1,marginBottom:12}}>
                  <div style={{height:"100%",width:`${pct}%`,background:CAT_META[g.category]?.accent||"#1d1d1f",transition:"width 0.4s"}}/>
                </div>
                {g.milestoneSteps.map((step,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 0",borderBottom:i<g.milestoneSteps.length-1?"1px solid #f9f9fb":"none"}}>
                    <button onClick={()=>onCompleteMilestoneStep(g.id,i)} disabled={step.completed} style={{
                      width:20,height:20,borderRadius:5,border:`1.5px solid ${step.completed?"#1d1d1f":"#d0d0d5"}`,
                      background:step.completed?"#1d1d1f":"transparent",color:step.completed?"#fff":"transparent",
                      cursor:step.completed?"default":"pointer",fontSize:11,fontWeight:700,flexShrink:0,transition:"all 0.15s",
                    }}>✓</button>
                    <span style={{fontSize:13,color:step.completed?"#b0b0b5":"#1d1d1f",flex:1}}>{step.name}</span>
                    <span style={{fontSize:12,color:"#b0b0b5"}}>+{step.weight} XP</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {addOpen && <AddSheet type={addType} onAdd={g=>{onAddGoal(g);setAddOpen(false);}} onClose={()=>setAddOpen(false)}/>}
    </div>
  );
}

/* ── ADD GOAL SHEET ────────────────────────────────────────────────────────── */
function AddSheet({ type, onAdd, onClose }) {
  const [name,setName]=useState("");
  const [cat,setCat]=useState("Emotional");
  const [weight,setWeight]=useState(10);
  const [steps,setSteps]=useState([{name:"",weight:20},{name:"",weight:20}]);

  function handleAdd() {
    if(!name.trim()) return;
    onAdd({name,category:cat,weight:parseInt(weight)||10,type,
      milestoneSteps:type==="milestone"?steps.filter(s=>s.name.trim()).map(s=>({...s,weight:parseInt(s.weight)||20,completed:false})):[]
    });
  }

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.25)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center",animation:"fadeIn 0.2s ease"}}>
      <div style={{background:"#fff",borderRadius:"20px 20px 0 0",padding:"28px 28px 40px",width:"100%",maxWidth:560,animation:"fadeUp 0.25s ease",maxHeight:"88vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
          <h2 style={{fontSize:17,fontWeight:600,color:"#1d1d1f"}}>New {type==="habitual"?"Habit":"Milestone"}</h2>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:24,color:"#b0b0b5",cursor:"pointer",lineHeight:1,padding:"0 4px"}}>×</button>
        </div>
        <div style={{marginBottom:16}}>
          <label style={S.fLbl}>Name</label>
          <input style={S.fInput} value={name} onChange={e=>setName(e.target.value)} placeholder={type==="habitual"?"e.g., Meditate 10 min":"e.g., Finish online course"} autoFocus/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
          <div>
            <label style={S.fLbl}>Category</label>
            <select style={S.fInput} value={cat} onChange={e=>setCat(e.target.value)}>
              {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {type==="habitual" && (
            <div>
              <label style={S.fLbl}>XP per completion</label>
              <input style={S.fInput} type="number" min={1} max={500} value={weight} onChange={e=>setWeight(e.target.value)}/>
            </div>
          )}
        </div>
        {type==="milestone" && (
          <div style={{marginBottom:16}}>
            <label style={S.fLbl}>Steps</label>
            {steps.map((step,i)=>(
              <div key={i} style={{display:"flex",gap:8,marginBottom:8,alignItems:"center"}}>
                <input style={{...S.fInput,flex:1}} value={step.name} onChange={e=>setSteps(s=>s.map((st,idx)=>idx===i?{...st,name:e.target.value}:st))} placeholder={`Step ${i+1}`}/>
                <input style={{...S.fInput,width:72}} type="number" min={1} value={step.weight} onChange={e=>setSteps(s=>s.map((st,idx)=>idx===i?{...st,weight:e.target.value}:st))} placeholder="XP"/>
                {steps.length>1&&<button onClick={()=>setSteps(s=>s.filter((_,idx)=>idx!==i))} style={S.delBtn}>✕</button>}
              </div>
            ))}
            <button onClick={()=>setSteps(s=>[...s,{name:"",weight:20}])} style={S.ghostBtn}>+ Add step</button>
          </div>
        )}
        <button onClick={handleAdd} disabled={!name.trim()} style={{...S.nextBtn,opacity:name.trim()?1:0.35,marginTop:8}}>Add Goal</button>
      </div>
    </div>
  );
}

/* ── HISTORY ───────────────────────────────────────────────────────────────── */
function HistoryView({ state }) {
  return (
    <div style={S.page}>
      <header style={{marginBottom:32}}>
        <h1 style={S.pageH1}>History</h1>
      </header>
      <div style={{...S.panel,marginBottom:16}}>
        <p style={S.panelLbl}>All-time scores</p>
        {CATEGORIES.map(cat=>{
          const score=state.catScores[cat]||0,rank=state.catRanks[cat]||"E";
          return (
            <div key={cat} style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
              <span style={{width:110,fontSize:13,color:"#1d1d1f"}}>{cat}</span>
              <div style={{flex:1,height:1.5,background:"#f0f0f0",borderRadius:1}}>
                <div style={{height:"100%",width:`${Math.min(100,(score/1400)*100)}%`,background:CAT_META[cat].accent,borderRadius:1}}/>
              </div>
              <span style={{width:36,fontSize:13,color:"#1d1d1f",textAlign:"right",fontVariantNumeric:"tabular-nums"}}>{score}</span>
              <span style={{width:24,fontSize:12,fontWeight:700,color:RANK_COLOR[rank],textAlign:"right"}}>{rank}</span>
            </div>
          );
        })}
      </div>
      <div style={S.panel}>
        <p style={S.panelLbl}>Levels</p>
        {state.levels.map((lv,i)=>(
          <div key={lv.id} style={{display:"flex",gap:14,paddingBottom:i<state.levels.length-1?14:0,borderBottom:i<state.levels.length-1?"1px solid #f5f5f7":"none",marginBottom:i<state.levels.length-1?14:0}}>
            <div style={{width:28,height:28,borderRadius:"50%",background:"#f5f5f7",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:600,color:"#1d1d1f",flexShrink:0}}>{i+1}</div>
            <div>
              <div style={{fontSize:14,color:"#1d1d1f",fontWeight:500}}>{lv.title||"Unnamed"}</div>
              <div style={{fontSize:12,color:"#8e8e93",marginTop:2}}>{lv.goals.length} goals · {new Date(lv.startedAt).toLocaleDateString("en-US",{month:"short",year:"numeric"})}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyHint({ text, onAdd }) {
  return (
    <div style={{padding:"40px 0",textAlign:"center"}}>
      <p style={{fontSize:13,color:"#b0b0b5",marginBottom:14}}>{text}</p>
      <button style={S.ghostBtn} onClick={onAdd}>+ Add goal</button>
    </div>
  );
}

const S = {
  app:{display:"flex",minHeight:"100vh",background:"#f5f5f7",fontFamily:"'Geist',-apple-system,BlinkMacSystemFont,sans-serif",color:"#1d1d1f"},
  main:{flex:1,overflow:"auto"},
  sidebar:{width:198,background:"#fff",borderRight:"1px solid #e5e5ea",display:"flex",flexDirection:"column",position:"sticky",top:0,height:"100vh"},
  navItem:{display:"block",width:"100%",textAlign:"left",padding:"9px 10px",border:"none",borderRadius:8,cursor:"pointer",fontSize:14,transition:"all 0.1s"},
  page:{padding:"40px 40px 64px",maxWidth:880},
  pageHead:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:32},
  eyebrow:{fontSize:11,color:"#8e8e93",letterSpacing:"0.06em",textTransform:"uppercase",fontWeight:500,marginBottom:6},
  pageH1:{fontSize:32,fontWeight:300,color:"#1d1d1f",fontFamily:"'Instrument Serif',serif",lineHeight:1.1,letterSpacing:"-0.01em"},
  heroCard:{background:"#fff",borderRadius:18,padding:"28px 32px",marginBottom:16,border:"1px solid #e5e5ea"},
  catGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:10,marginBottom:16},
  catCard:{background:"#fff",borderRadius:14,padding:"16px 18px",border:"1px solid #e5e5ea"},
  twoUp:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10},
  panel:{background:"#fff",borderRadius:14,padding:"20px 22px",border:"1px solid #e5e5ea"},
  panelLbl:{fontSize:11,fontWeight:500,color:"#8e8e93",letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:16},
  catStrip:{background:"#fff",borderRadius:12,padding:"16px 20px",marginBottom:20,border:"1px solid #e5e5ea",display:"flex",gap:16,overflowX:"auto"},
  tabRow:{display:"flex",borderBottom:"1px solid #f0f0f0",marginBottom:20},
  tab:{background:"none",border:"none",padding:"10px 16px",fontSize:14,cursor:"pointer",transition:"all 0.1s"},
  addBtn:{background:"#1d1d1f",color:"#fff",border:"none",borderRadius:10,padding:"9px 18px",fontSize:14,fontWeight:500,cursor:"pointer"},
  advBtn:{background:"#34c759",color:"#fff",border:"none",borderRadius:10,padding:"9px 18px",fontSize:13,fontWeight:500,cursor:"pointer"},
  mCard:{background:"#fff",borderRadius:14,padding:"18px 20px",border:"1px solid #e5e5ea"},
  delBtn:{background:"none",border:"none",color:"#c0c0c5",fontSize:16,cursor:"pointer",padding:"2px 6px",lineHeight:1,flexShrink:0},
  // Setup
  setupWrap:{minHeight:"100vh",background:"#f5f5f7",display:"flex",alignItems:"center",justifyContent:"center",padding:24},
  setupCard:{background:"#fff",borderRadius:20,padding:"44px 44px 40px",width:"100%",maxWidth:500,border:"1px solid #e5e5ea",animation:"fadeUp 0.4s ease"},
  stepRow:{display:"flex",justifyContent:"space-between",marginBottom:36},
  setupH:{fontSize:32,fontWeight:300,color:"#1d1d1f",fontFamily:"'Instrument Serif',serif",lineHeight:1.2,marginBottom:10,letterSpacing:"-0.01em"},
  setupDesc:{fontSize:14,color:"#8e8e93",lineHeight:1.5,marginBottom:24},
  bigInput:{width:"100%",fontSize:20,fontWeight:300,color:"#1d1d1f",border:"none",borderBottom:"1.5px solid #1d1d1f",padding:"8px 0",outline:"none",background:"transparent",fontFamily:"'Instrument Serif',serif",marginBottom:28},
  catGoalRow:{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",background:"#f9f9fb",borderRadius:10},
  catGoalLbl:{display:"flex",alignItems:"center",gap:8,width:126,flexShrink:0},
  inlineInput:{flex:1,background:"transparent",border:"none",borderBottom:"1px solid #e5e5ea",padding:"4px 0",fontSize:13,color:"#1d1d1f",outline:"none"},
  nextBtn:{width:"100%",background:"#1d1d1f",color:"#fff",border:"none",borderRadius:12,padding:"13px",fontSize:15,fontWeight:500,cursor:"pointer",marginTop:4,transition:"opacity 0.15s"},
  backBtn:{background:"transparent",color:"#8e8e93",border:"1px solid #e5e5ea",borderRadius:12,padding:"12px 18px",fontSize:14,cursor:"pointer"},
  rankPill:{padding:"6px 14px",borderRadius:20,fontSize:13,fontWeight:600,cursor:"pointer",transition:"all 0.15s"},
  // Sheet
  fLbl:{display:"block",fontSize:11,fontWeight:500,color:"#8e8e93",letterSpacing:"0.05em",textTransform:"uppercase",marginBottom:6},
  fInput:{width:"100%",background:"#f9f9fb",border:"1px solid #e5e5ea",borderRadius:10,padding:"10px 14px",fontSize:14,color:"#1d1d1f",outline:"none"},
  ghostBtn:{background:"none",border:"1px solid #e5e5ea",borderRadius:10,padding:"8px 16px",fontSize:13,color:"#8e8e93",cursor:"pointer"},
  toast:{position:"fixed",bottom:24,right:24,zIndex:999,background:"#1d1d1f",color:"#fff",padding:"10px 18px",borderRadius:10,fontSize:13,boxShadow:"0 4px 20px rgba(0,0,0,0.12)",animation:"fadeUp 0.2s ease"},
};
