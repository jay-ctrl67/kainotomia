const http=require('http'),fs=require('fs'),path=require('path');
const KEY=process.env.ANTHROPIC_API_KEY,PASS=process.env.TEACHER_PASSWORD,PORT=process.env.PORT||3000;
const MODEL=process.env.MODEL||'claude-sonnet-5-5',API=process.env.ANTHROPIC_API_URL||'https://api.anthropic.com/v1/messages';
const FILE=path.join(__dirname,'results.json');
let results={};try{results=JSON.parse(fs.readFileSync(FILE,'utf8'))}catch(e){}
const save=()=>fs.writeFile(FILE,JSON.stringify(results),()=>{});
const FBFILE=path.join(__dirname,'feedback.json');
let feedback=[];try{feedback=JSON.parse(fs.readFileSync(FBFILE,'utf8'))}catch(e){}
const saveFb=()=>fs.writeFile(FBFILE,JSON.stringify(feedback),()=>{});
const TOPICS=['Privacy and data','Hints and answers','Quiz or recommendations','Something felt unfair','An idea'];
let SY={};try{SY=JSON.parse(fs.readFileSync(path.join(__dirname,'syllabus.json'),'utf8'))}catch(e){}
const OPEN=process.env.OPEN_TEACHER==='1';
const hits=new Map();
const limited=ip=>{const n=Date.now(),a=(hits.get(ip)||[]).filter(t=>n-t<600000);a.push(n);hits.set(ip,a);return a.length>40};
const clip=(s,n)=>String(s==null?'':s).slice(0,n);
const send=(res,c,o)=>{res.writeHead(c,{'Content-Type':'application/json'});res.end(JSON.stringify(o))};
const body=req=>new Promise((ok,no)=>{let b='';req.on('data',c=>{b+=c;if(b.length>20000){no(new Error('big'));req.destroy()}});req.on('end',()=>{try{ok(JSON.parse(b||'{}'))}catch(e){no(e)}})});
const GKEY=process.env.GEMINI_API_KEY,GEM=process.env.AI_PROVIDER?process.env.AI_PROVIDER==='gemini':(!!GKEY&&!KEY),GMODEL=process.env.GEMINI_MODEL||'gemini-2.5-flash',GBASE=process.env.GEMINI_API_URL||'https://generativelanguage.googleapis.com/v1beta';
const GFALL=[GMODEL,'gemini-2.5-flash','gemini-flash-latest','gemini-2.0-flash'].filter((m,i,a)=>a.indexOf(m)===i);
async function gem(prompt,max,json){
  let last;
  for(const m of GFALL){
    const old=/^gemini-2\.5-flash/.test(m),gc={maxOutputTokens:old?max:max+4000};
    if(json)gc.responseMimeType='application/json';
    if(old)gc.thinkingConfig={thinkingBudget:0};
    const r=await fetch(GBASE+'/models/'+m+':generateContent',{method:'POST',signal:AbortSignal.timeout(30000),headers:{'content-type':'application/json','x-goog-api-key':GKEY||''},body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:gc})});
    if(r.status===404){console.error('Gemini model not found: '+m);last=new Error('api 404');continue}
    if(!r.ok){const t=await r.text().catch(()=>'');console.error('Gemini error '+r.status+' ('+m+'): '+t.slice(0,300));throw new Error('api '+r.status)}
    const d=await r.json(),c=(d.candidates||[])[0]||{},txt=((c.content||{}).parts||[]).map(p=>p.text||'').join('');
    if(!txt){console.error('Gemini returned no text ('+m+'), finish reason: '+c.finishReason+', feedback: '+JSON.stringify(d.promptFeedback||{}));throw new Error('empty')}
    return txt;
  }
  throw last||new Error('api 404');
}
async function ai(prompt,max,json){
  if(GEM)return gem(prompt,max,json);
  const r=await fetch(API,{method:'POST',signal:AbortSignal.timeout(30000),headers:{'content-type':'application/json','x-api-key':KEY||'','anthropic-version':'2023-06-01'},body:JSON.stringify({model:MODEL,max_tokens:max,messages:[{role:'user',content:prompt}]})});
  if(!r.ok)throw new Error('api '+r.status);
  const d=await r.json();return d.content.map(c=>c.text||'').join('');
}
http.createServer(async(req,res)=>{
  try{
    const ip=clip((req.headers['x-forwarded-for']||req.socket.remoteAddress||'').split(',')[0],60);
    if(req.method==='GET'&&(req.url==='/'||req.url==='/index.html')){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(fs.readFileSync(path.join(__dirname,'index.html')))}
    if(req.method==='GET'&&req.url.startsWith('/api/health')){
      const q=new URL(req.url,'http://x').searchParams.get('test'),info={ai:GEM?'gemini':'claude',models:GEM?GFALL:[MODEL],keySet:GEM?!!GKEY:!!KEY};
      if(q&&PASS&&q===PASS){try{info.test=await ai('Reply with the single word OK.',20)}catch(e){info.test='failed: '+e.message}}
      return send(res,200,info);
    }
    if(req.method==='GET'&&req.url==='/api/config')return send(res,200,{open:OPEN});
    if(req.method==='GET'&&req.url==='/api/syllabus')return send(res,200,SY);
    if(req.method==='GET'&&req.url==='/api/teacher'){
      if(!OPEN&&(!PASS||req.headers['x-teacher-password']!==PASS))return send(res,403,{error:'Wrong password'});
      return send(res,200,{results:Object.entries(results).map(([id,v])=>({id,...v}))});
    }
    if(req.method==='GET'&&req.url==='/api/feedback'){
      if(!OPEN&&(!PASS||req.headers['x-teacher-password']!==PASS))return send(res,403,{error:'Wrong password'});
      return send(res,200,{feedback});
    }
    if(req.method==='POST'&&req.url.startsWith('/api/')){
      if(limited(ip))return send(res,429,{error:'Too many requests. Please wait a few minutes.'});
      const b=await body(req);
      if(req.url==='/api/ask'){
        const m=(Array.isArray(b.messages)?b.messages:[]).slice(-10).map(x=>(x.role==='user'?'Student: ':'Assistant: ')+clip(x.content,1000)).join('\n');
        const mode=b.hint?'Give hints and guiding questions first, not the full solution. Give the full answer only if the student shows their own attempt or clearly asks for it.':'Give a clear, complete explanation.';
        const lvl=b.level==='Advanced'?'Advanced':'Standard';
        const text=await ai('You are Kainotomia, a study helper for college students. '+mode+' Level: '+lvl+'. Keep replies under 150 words, in plain text. Never ask for personal data. If you are unsure, say so.\n\n'+m+'\nAssistant:',500);
        return send(res,200,{text});
      }
      if(req.url==='/api/quiz'){
        const n=[3,5,8].includes(+b.n)?+b.n:5,lv=['Easy','Medium','Hard'].includes(b.level)?b.level:'Medium';
        const sub=clip(b.subject,80),unit=clip(b.unit,80);if(!((SY[clip(b.branch,40)]||{})[sub]||[]).includes(unit))return send(res,400,{error:'Choose a subject and unit from the syllabus.'});
        const topic=unit+' ('+sub+')';
        const mk=async()=>{const t=await ai('Create a '+n+'-question multiple-choice quiz for a college student on "'+topic+'" at '+lv+' difficulty. Return only a JSON array: [{"q":"question","options":["A","B","C","D"],"answer":0,"topic":"short subtopic","why":"one-sentence explanation"}]. The answer is the index (0 to 3) of the correct option.',2500,true);
        const q=JSON.parse(t.slice(t.indexOf('['),t.lastIndexOf(']')+1));if(!Array.isArray(q)||!q.length)throw new Error('bad quiz');return q};
        let quiz;try{quiz=await mk()}catch(e){console.error('Quiz try 1 failed: '+e.message);quiz=await mk()}
        return send(res,200,{quiz});
      }
      if(req.url==='/api/share'){
        const name=clip(b.name,40).trim(),roll=clip(b.roll,20).trim();if(!name||!roll)return send(res,400,{error:'Name and roll number are required.'});
        const q=b.score||{},sc={pct:Math.max(0,Math.min(100,+q.pct||0)),branch:clip(q.branch,40),subject:clip(q.subject,80),unit:clip(q.unit,80),weak:(Array.isArray(q.weak)?q.weak:[]).slice(0,6).map(w=>clip(w,60)),t:Date.now()};
        const id=(name+' ('+roll+')').toLowerCase(),old=results[id]||{scores:[]};
        const scores=old.scores.concat(sc).slice(-5),l3=scores.slice(-3),avg=l3.reduce((a,x)=>a+x.pct,0)/l3.length,flag=sc.pct<=40||avg<50;
        results[id]={name,roll,scores,flag,updated:Date.now()};save();
        return send(res,200,{flag});
      }
      if(req.url==='/api/feedback'){
        const text=clip(b.text,500).trim();if(!text)return send(res,400,{error:'Write your feedback first.'});
        feedback.push({t:Date.now(),topic:TOPICS.includes(b.topic)?b.topic:'An idea',text});feedback=feedback.slice(-500);saveFb();
        return send(res,200,{ok:true});
      }
      if(req.url==='/api/forget'){delete results[(clip(b.name,40).trim()+' ('+clip(b.roll,20).trim()+')').toLowerCase()];save();return send(res,200,{ok:true})}
    }
    send(res,404,{error:'Not found'});
  }catch(e){console.error('Request error: '+e.message);if(/^api (429|500|502|503|504)$/.test(String(e.message))||e.name==='TimeoutError')return send(res,429,{error:'The AI is busy right now. Please try again in a minute.'});if(/^api (400|401|403|404)$/.test(String(e.message)))return send(res,503,{error:'The AI is not set up correctly. Please tell the person running this site.'});send(res,500,{error:'Something went wrong. Please try again.'})}
}).listen(PORT,()=>{console.log('Kainotomia running on port '+PORT+'. AI: '+(GEM?'Gemini ('+GMODEL+')':'Claude ('+MODEL+')'));if(GEM?!GKEY:!KEY)console.log('WARNING: no API key set for the AI. Ask and Quiz will not work. Set GEMINI_API_KEY (or ANTHROPIC_API_KEY).')});
