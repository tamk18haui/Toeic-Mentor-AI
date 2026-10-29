import React, {useEffect, useMemo, useRef, useState} from 'react'
import {Link, useParams} from 'react-router-dom'
import {ArrowLeft, ArrowRight, BookOpen, Bookmark, Check, ChevronLeft, ChevronRight, Clock3, FileText, Flag, Headphones, ImageOff, ListChecks, RotateCcw, Send, Volume2, X} from 'lucide-react'
import {api, recordAttempt} from '../lib/api.js'
import {useUser} from '../App.jsx'

const PARTS = {1:'Mô tả tranh',2:'Hỏi đáp',3:'Hội thoại',4:'Bài nói ngắn',5:'Hoàn thành câu',6:'Hoàn thành đoạn văn',7:'Đọc hiểu'}
const formatTime = s => `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor((s%3600)/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`
const isVi = text => /[À-ỹĐđ]/u.test(text||'')

function buildGroups(questions){
  const groups=[]
  for(const q of questions){
    const prev=groups.at(-1)
    // Part 5 is best practiced in compact groups of five; the other parts use
    // the actual audio/passage group from the imported exam data.
    const key=q.part===5?`P5_${Math.floor((q.number-101)/5)}`:(q.group_ref||`P${q.part}_${q.number}`)
    if(prev&&prev.key===key&&prev.part===q.part){prev.questions.push(q)}
    else groups.push({key,part:q.part,questions:[q]})
  }
  return groups
}

function Passage({text,bilingual}){
  const lines=(text||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean)
  const rows=[]
  for(let i=0;i<lines.length;i++){
    if(lines[i]==='---'){rows.push({separator:true,id:i});continue}
    const next=lines[i+1]
    if(next&&next!=='---'&&!isVi(lines[i])&&isVi(next)){
      rows.push({en:lines[i],vi:next,id:i});i++
    }else rows.push({en:lines[i],id:i,vi:null})
  }
  return <div className="room-passage-text">{rows.map(row=>row.separator?<hr key={row.id}/>:<div className="room-passage-line" key={row.id}><div>{row.en}</div>{bilingual&&row.vi&&<small>{row.vi}</small>}</div>)}</div>
}

function Media({media,part}){
  const [errors,setErrors]=useState({})
  const images=media?.images||[], audios=media?.audio||[]
  return <div className="room-media">
    {images.map((url,i)=><div className="room-image-frame" key={url}><img src={url} alt={`Hình minh họa ${i+1}`} onError={()=>setErrors(v=>({...v,[url]:true}))}/>{errors[url]&&<div className="room-media-warning"><ImageOff size={16}/> Ảnh chưa tải được. Kiểm tra nguồn media của đề.</div>}</div>)}
    {audios.map((url,i)=><div className="room-audio-frame" key={url}><span className="room-audio-icon"><Volume2 size={21}/></span><div><strong>Audio {audios.length>1?i+1:''}</strong><audio controls preload="metadata" src={url} onError={()=>setErrors(v=>({...v,[url]:true}))}/>{errors[url]&&<small className="room-media-warning">File âm thanh không khả dụng. Hãy kiểm tra việc nhập media ZIP trong Admin.</small>}</div></div>)}
    {!images.length&&!audios.length&&part<=4&&<div className="room-media-warning"><Headphones size={17}/> Không có audio hoặc ảnh cho nhóm này. Kiểm tra tệp media đã tải lên.</div>}
  </div>
}

function explanationSections(feedback,options){
  const raw=String(feedback?.explanation||'').normalize('NFC').trim()
  const markerTip=/MẸO\s*TOEIC/i,markerKnowledge=/💡?\s*KIẾN\s*THỨC\s*CẦN\s*NHỚ/i
  const tipAt=raw.search(markerTip),knowledgeAt=raw.search(markerKnowledge)
  const cutAt=Math.min(...[tipAt,knowledgeAt].filter(x=>x>=0).concat(raw.length))
  const main=raw.slice(0,cutAt).replace(/\s+/g,' ').trim()
  const tip=tipAt>=0?raw.slice(tipAt+raw.slice(tipAt).match(markerTip)[0].length,knowledgeAt>tipAt?knowledgeAt:raw.length).trim():''
  const knowledge=knowledgeAt>=0?raw.slice(knowledgeAt+raw.slice(knowledgeAt).match(markerKnowledge)[0].length,tipAt>knowledgeAt?tipAt:raw.length).trim():''
  const optionMap={}
  for(const [label,desc] of Object.entries(feedback?.by_option||{})){
    if(/^[A-D]$/.test(label.toUpperCase())&&String(desc||'').trim())optionMap[label.toUpperCase()]=String(desc).trim()
  }
  const positions=(options||[]).map(o=>{
    const needle=`${o.label} ${o.text||''}`.trim()
    return {label:o.label,needle,pos:main.indexOf(needle)}
  }).filter(p=>p.pos>=0).sort((a,b)=>a.pos-b.pos)
  if(!Object.keys(optionMap).length&&positions.length>=2){
    for(let i=0;i<positions.length;i++){
      const x=positions[i]
      optionMap[x.label]=main.slice(x.pos+x.needle.length,positions[i+1]?.pos??main.length).trim().replace(/^[-–—.:\s]+/,'')
    }
  }
  const intro=positions.length>=2?main.slice(0,positions[0].pos):main
  const summary=Object.keys(optionMap).length&&positions.length<2&&/PHÂN TÍCH TỪNG ĐÁP ÁN/i.test(main)?'':intro.replace(/(?:AI\s*)?GIẢI THÍCH/gi,'').replace(/(?:AI\s*)?PHÂN TÍCH TỪNG ĐÁP ÁN/gi,'').trim()
  return {summary,optionMap,tip,knowledge}
}

function Explanation({feedback,options}){
  const {summary,optionMap,tip,knowledge}=explanationSections(feedback,options)
  const entries=(options||[]).filter(o=>optionMap[o.label])
  return <div className={`room-explanation ${feedback.is_correct?'success':'failure'}`}>
    <strong>{feedback.is_correct?'✓ Chính xác!':`Đáp án đúng: ${feedback.correct||'Chưa có dữ liệu'}`}</strong>
    {summary&&<p className="room-explanation-summary">{summary}</p>}
    {entries.length>0&&<div className="room-analysis-list"><h4>AI phân tích từng đáp án</h4>{entries.map(o=><div className="room-analysis-row" key={o.label}><span className={`room-analysis-letter ${feedback.correct===o.label?'is-right':'is-wrong'}`}>{o.label}</span><div><strong>{o.text||`Đáp án ${o.label}`}</strong><p>{optionMap[o.label]}</p></div></div>)}</div>}
    {!summary&&!entries.length&&!tip&&!knowledge&&<p>Chưa có lời giải cho câu này.</p>}
    {tip&&<div className="room-explanation-note"><strong>🎯 Mẹo TOEIC</strong><p>{tip}</p></div>}
    {knowledge&&<div className="room-explanation-note knowledge"><strong>💡 Kiến thức cần nhớ</strong><p>{knowledge}</p></div>}
  </div>
}

function AnswerCard({question,selected,onChoose,feedback,onCheck,canCheck,bilingual,flagged,onToggleFlag,reviewing}){
  return <article className="room-question-card" id={`room-q-${question.number}`}>
    <div className="room-question-head"><span className="room-question-index">{question.number}</span><div><strong>{question.stem||`Question ${question.number}`}</strong>{bilingual&&question.stem_vi&&<small>{question.stem_vi}</small>}</div><button className={`room-flag ${flagged?'active':''}`} onClick={()=>onToggleFlag(question.number)} title={flagged?'Bỏ đánh dấu':'Đánh dấu để xem lại'} aria-label={`Đánh dấu câu ${question.number}`}><Bookmark size={18} fill={flagged?'currentColor':'none'}/></button></div>
    <div className="room-answer-list">{(question.options||[]).map(o=>{
      const right=feedback&&feedback.correct===o.label,wrong=feedback&&selected===o.label&&!right
      return <button type="button" key={o.label} onClick={()=>onChoose(question.number,o.label)} disabled={reviewing||!!feedback&&canCheck} className={[selected===o.label?'selected':'',right?'right':'',wrong?'wrong':''].join(' ')}><span className="room-option-letter">{o.label}</span><span className="room-option-content">{o.text||`Đáp án ${o.label}`}{bilingual&&o.translation_vi&&<small>{o.translation_vi}</small>}</span>{right&&<Check size={16}/>}</button>
    })}</div>
    {canCheck&&!feedback&&<button className="room-check-answer" disabled={!selected} onClick={()=>onCheck(question.number)}><Check size={15}/> Kiểm tra câu {question.number}</button>}
    {feedback&&<Explanation feedback={feedback} options={question.options}/>}
  </article>
}

function Summary({exam,grade,answers,onAgain,onReview}){
  const parts=Object.values((grade.results||[]).reduce((map,r)=>{const p=map[r.part]||(map[r.part]={part:r.part,total:0,right:0});p.total++;p.right+=Number(r.is_correct);return map},{}))
  return <div className="room-summary"><Link to="/exams"><ArrowLeft size={17}/> Kho đề</Link><div className="room-summary-card"><span className="room-eyebrow">KẾT QUẢ LUYỆN THI</span><h1>{exam.collection} · {exam.title}</h1><strong className="room-summary-score">{grade.correct}<span> / {grade.total} câu</span></strong><p>Đã trả lời {grade.answered}/{grade.total} · Tỷ lệ đúng {grade.percent}%</p><small>Đây là số câu đúng, không phải điểm TOEIC quy đổi chính thức.</small><div className="room-summary-actions"><button onClick={onAgain}><RotateCcw size={17}/> Làm lại</button><button onClick={()=>onReview((grade.results||[]).find(r=>!r.is_correct)?.number||1)}><BookOpen size={17}/> Xem lời giải</button></div></div><div className="room-summary-parts">{parts.map(p=><button key={p.part} onClick={()=>onReview((grade.results||[]).find(r=>r.part===p.part)?.number||1)}><span>Part {p.part} · {PARTS[p.part]}</span><strong>{p.right}/{p.total}</strong><i><em style={{width:`${100*p.right/p.total}%`}}/></i></button>)}</div><h2>Chi tiết 200 câu</h2><div className="room-summary-questions">{(grade.results||[]).map(r=><button key={r.number} className={r.is_correct?'correct':'incorrect'} onClick={()=>onReview(r.number)}>{r.number}<small>{r.is_correct?'✓':'✕'}</small></button>)}</div></div>
}

export default function ExamRoom(){
  const {id}=useParams(),{session}=useUser()
  const [exam,setExam]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState('')
  const [mode,setMode]=useState('practice'),[started,setStarted]=useState(false),[resume,setResume]=useState(false)
  const [current,setCurrent]=useState(1),[answers,setAnswers]=useState({}),[flags,setFlags]=useState({}),[checked,setChecked]=useState({})
  const [grade,setGrade]=useState(null),[reviewing,setReviewing]=useState(false),[bilingual,setBilingual]=useState(true)
  const [seconds,setSeconds]=useState(7200),[finishing,setFinishing]=useState(false),[showMap,setShowMap]=useState(true)
  const deadlineRef=useRef(null),submitLock=useRef(false),questionPane=useRef(null),documentPane=useRef(null)
  const storageKey=`toeic-room-draft-v1-${id}`
  const questions=exam?.questions||[],total=questions.length
  const groups=useMemo(()=>buildGroups(questions),[questions])
  const activeGroupIndex=Math.max(0,groups.findIndex(g=>g.questions.some(q=>q.number===current)))
  const activeGroup=groups[activeGroupIndex],groupQuestions=activeGroup?.questions||[]
  const part=activeGroup?.part||1
  const passage=exam?.passages?.find(p=>p.group_ref&&p.group_ref===activeGroup?.key)
  const relatedMedia=useMemo(()=>{
    const audio=[...(passage?.media?.audio||[])],images=[...(passage?.media?.images||[])]
    for(const q of groupQuestions){audio.push(...(q.media?.audio||[]));images.push(...(q.media?.images||[]))}
    return {audio:[...new Set(audio)],images:[...new Set(images)]}
  },[passage,activeGroup])
  const answered=questions.filter(q=>Boolean(answers[q.number])).length
  const parts=useMemo(()=>Object.keys(PARTS).map(n=>({part:Number(n),list:questions.filter(q=>q.part===Number(n))})).filter(p=>p.list.length),[questions])

  useEffect(()=>{
    let alive=true
    api(`/exams/${encodeURIComponent(id)}`).then(data=>{
      if(!alive)return
      setExam(data);setCurrent(data.questions?.[0]?.number||1);setSeconds(data.duration_minutes*60)
      try{const saved=JSON.parse(localStorage.getItem(storageKey)||'null');if(saved&&saved.answers&&saved.current){setAnswers(saved.answers);setFlags(saved.flags||{});setMode(saved.mode||'practice');setCurrent(saved.current);setBilingual(saved.bilingual??true);setSeconds(saved.seconds??data.duration_minutes*60);deadlineRef.current=saved.deadline||null;setResume(true)}}catch{ /* private browsing */ }
    }).catch(e=>alive&&setError(e.message)).finally(()=>alive&&setLoading(false))
    return()=>{alive=false}
  },[id])

  useEffect(()=>{
    if(!started||grade)return
    const save=()=>{try{localStorage.setItem(storageKey,JSON.stringify({answers,flags,current,mode,bilingual,seconds,deadline:deadlineRef.current}))}catch{ /* storage not available */ }}
    save()
  },[answers,flags,current,mode,bilingual,started,seconds,grade,storageKey])
  useEffect(()=>{
    if(!started||grade)return
    if(!deadlineRef.current)deadlineRef.current=Date.now()+seconds*1000
    const timer=setInterval(()=>setSeconds(Math.max(0,Math.ceil((deadlineRef.current-Date.now())/1000))),1000)
    return()=>clearInterval(timer)
  },[started,grade])
  useEffect(()=>{if(started&&seconds<=0&&!grade&&!submitLock.current)submit(true)},[seconds,started,grade])

  const navigate=n=>{
    if(!questions.some(q=>q.number===n))return
    setCurrent(n)
    if(questionPane.current){questionPane.current.scrollTop=0}
    if(documentPane.current){documentPane.current.scrollTop=0}
  }
  const focusQuestion=n=>{
    const same=groupQuestions.some(q=>q.number===n)
    setCurrent(n)
    if(!same){questionPane.current?.scrollTo({top:0});documentPane.current?.scrollTo({top:0})}
    else requestAnimationFrame(()=>document.getElementById(`room-q-${n}`)?.scrollIntoView({block:'nearest',behavior:'smooth'}))
  }
  const chooseAnswer=(n,label)=>{if(grade||checked[n])return;setAnswers(old=>({...old,[n]:label}))}
  const check=async n=>{
    if(!answers[n]||checked[n])return
    setError('')
    try{const result=await api(`/exams/${encodeURIComponent(id)}/questions/${n}/check`,{method:'POST',body:{choice:answers[n]}});setChecked(old=>({...old,[n]:result}))}catch(e){setError(e.message)}
  }
  const submit=async(auto=false)=>{
    if(submitLock.current||!exam)return
    if(!auto&&answered<total&&!window.confirm(`Bạn mới hoàn thành ${answered}/${total} câu. Bạn vẫn muốn nộp bài?`))return
    submitLock.current=true;setFinishing(true);setError('')
    try{
      const result=await api(`/exams/${encodeURIComponent(id)}/grade`,{method:'POST',body:{answers}})
      setGrade(result);setReviewing(false)
      try{localStorage.removeItem(storageKey)}catch{}
      await recordAttempt({mode:'reading_full',part:mode,question_ref:id.slice(0,80),score:result.correct,max_score:result.total,details:{title:exam.title,percent:result.percent,answered:result.answered}},session)
      window.scrollTo({top:0})
    }catch(e){setError(e.message)}finally{setFinishing(false);submitLock.current=false}
  }
  const reset=()=>{
    setAnswers({});setFlags({});setChecked({});setGrade(null);setReviewing(false)
    setStarted(false);setResume(false);setCurrent(questions[0]?.number||1)
    setSeconds((exam?.duration_minutes||120)*60);deadlineRef.current=null
    try{localStorage.removeItem(storageKey)}catch{}
  }
  const start=newRun=>{
    if(newRun){setAnswers({});setFlags({});setChecked({});setCurrent(questions[0]?.number||1);setSeconds((exam?.duration_minutes||120)*60);deadlineRef.current=null;setResume(false);try{localStorage.removeItem(storageKey)}catch{}}
    setStarted(true)
  }

  if(loading)return <div className="room-state">Đang tải câu hỏi và tài liệu thi…</div>
  if(!exam)return <div className="room-state"><p>{error||'Không tìm thấy đề thi.'}</p><Link to="/exams">Trở về kho đề</Link></div>
  if(grade&&!reviewing)return <Summary exam={exam} grade={grade} answers={answers} onAgain={reset} onReview={n=>{navigate(n);setReviewing(true)}}/>
  if(!started)return <div className="room-entry"><Link to="/exams"><ArrowLeft size={18}/> Quay lại kho đề</Link><div className="room-entry-card"><span className="room-eyebrow">TOEIC STUDIO · PHÒNG THI</span><h1>{exam.collection} — {exam.title}</h1><p>{total} câu hỏi · {exam.duration_minutes} phút · 7 Part · {exam.media_count} audio/ảnh</p><div className="room-entry-modes"><button className={mode==='practice'?'active':''} onClick={()=>setMode('practice')}><BookOpen size={23}/><strong>Luyện tập</strong><small>Song ngữ, xem đáp án và giải thích sau từng câu.</small></button><button className={mode==='test'?'active':''} onClick={()=>{setMode('test');setBilingual(false)}}><Clock3 size={23}/><strong>Thi thử</strong><small>Hẹn giờ, không hiện đáp án trước khi nộp.</small></button></div>{resume?<><button className="room-entry-go" onClick={()=>start(false)}>Tiếp tục bài đã làm <ArrowRight size={18}/></button><button className="room-entry-reset" onClick={()=>start(true)}>Bỏ bài cũ và làm lại từ đầu</button></>:<button className="room-entry-go" onClick={()=>start(true)}>Bắt đầu làm đề <ArrowRight size={18}/></button>}<small className="room-entry-hint">Đáp án được lưu tạm trên trình duyệt để bạn không mất bài khi tải lại trang.</small></div></div>

  const sectionStart=groupQuestions[0]?.number,sectionEnd=groupQuestions.at(-1)?.number
  const reviewMap=Object.fromEntries((grade?.results||[]).map(r=>[r.number,r]))
  const sourceAvailable=Boolean(passage?.passage_text||relatedMedia.audio.length||relatedMedia.images.length)
  return <div className="room-workspace">
    <header className="room-toolbar"><Link className="room-back" to="/exams" title="Quay về kho đề"><ArrowLeft size={18}/></Link><div className="room-brand"><span className="room-brand-mark"><BookOpen size={19}/></span><div><strong>TOEIC STUDIO</strong><small>{exam.collection} · {exam.title}</small></div></div><div className="room-tools"><button className={bilingual?'active':''} onClick={()=>setBilingual(v=>!v)}>文 <span>Song ngữ</span></button><button onClick={()=>setShowMap(v=>!v)}><ListChecks size={16}/> <span>Bảng câu hỏi</span></button></div><div className="room-toolbar-right"><span className="room-timer"><Clock3 size={16}/> {formatTime(seconds)}</span>{reviewing?<button className="room-submit" onClick={()=>setReviewing(false)}>Xem kết quả</button>:<button className="room-submit" onClick={()=>submit()} disabled={finishing}>{finishing?'Đang chấm…':'Nộp bài'} <Send size={15}/></button>}</div></header>
    <nav className="room-part-tabs" aria-label="Chuyển Part">{parts.map(x=><button key={x.part} onClick={()=>navigate(x.list[0].number)} className={part===x.part?'active':''}><strong>Part {x.part}</strong><small>{PARTS[x.part]}</small><span>{x.list.filter(q=>answers[q.number]).length}/{x.list.length}</span></button>)}</nav>
    <div className={`room-body ${!showMap?'no-map':''} ${part===5?'single-column':''}`}>
      <div className="room-center"><div className="room-section-title"><div><span>PART {part} · {PARTS[part]}</span><h2>{sectionStart===sectionEnd?`Câu ${sectionStart}`:`Nhóm câu ${sectionStart}–${sectionEnd}`}</h2></div><span className="room-kind">{part<=4?'LISTENING':'READING'}</span></div><div className={`room-panels ${part===5?'room-panels-compact':''}`}>
        {part!==5&&<section className="room-document-pane" ref={documentPane}><div className="room-pane-label"><FileText size={16}/> {part<=4?'Ảnh & đoạn nghe':'Tài liệu / đoạn văn'}</div>{sourceAvailable?<><Media key={activeGroup.key} media={relatedMedia} part={part}/>{passage?.passage_text&&<Passage text={passage.passage_text} bilingual={bilingual}/>}</>:<div className="room-empty-source">{part<=4?'Không tìm thấy audio hoặc ảnh. Kiểm tra việc nhập ZIP media từ trang Admin.':'Nhóm câu này không có đoạn văn đính kèm.'}</div>}</section>}
        <section className="room-questions-pane" ref={questionPane}><div className="room-pane-label"><ListChecks size={16}/> {groupQuestions.length===1?'Chọn một đáp án':'Trả lời các câu trong nhóm'}<span>{groupQuestions.filter(q=>answers[q.number]).length}/{groupQuestions.length} đã chọn</span></div>{groupQuestions.map(q=><AnswerCard key={q.number} question={q} selected={answers[q.number]} onChoose={chooseAnswer} feedback={checked[q.number]||reviewMap[q.number]} onCheck={check} canCheck={mode==='practice'&&!reviewing&&!grade} bilingual={bilingual} flagged={Boolean(flags[q.number])} onToggleFlag={n=>setFlags(x=>({...x,[n]:!x[n]}))} reviewing={reviewing}/>)}
        </section>
      </div></div>
      {showMap&&<aside className="room-map"><div className="room-map-heading"><strong>Bảng câu hỏi</strong><button onClick={()=>setShowMap(false)} title="Thu gọn"><X size={17}/></button></div><div className="room-map-meta"><strong>{exam.title}</strong><span>{mode==='test'?'Thi thử':'Luyện tập'} <b>{answered}/{total} đã trả lời</b></span><div className="room-map-legend"><span><i className="answered"/> Đã làm</span><span><i/> Chưa làm</span><span><Bookmark size={12}/> Đánh dấu</span></div></div><div className="room-map-scroll">{parts.map(x=><section key={x.part}><h3><span>Part {x.part} · {PARTS[x.part]}</span><small>{x.list.filter(q=>answers[q.number]).length}/{x.list.length}</small></h3><div className="room-map-grid">{x.list.map(q=><button key={q.number} onClick={()=>focusQuestion(q.number)} title={`Câu ${q.number}${flags[q.number]?' · Đã đánh dấu':''}`} className={[q.number===current?'focus':'',answers[q.number]?'done':'',flags[q.number]?'flagged':'',grade?(reviewMap[q.number]?.is_correct?'right':'wrong'):''].join(' ')}>{q.number}{flags[q.number]&&<sup>•</sup>}</button>)}</div></section>)}</div></aside>}
    </div>
    <footer className="room-footer"><div className="room-footer-left"><span><i/> Chưa làm</span><span><i className="done"/> Đã trả lời</span><span><Bookmark size={13}/> Đánh dấu</span></div><div className="room-footer-center"><button disabled={activeGroupIndex<=0} onClick={()=>navigate(groups[activeGroupIndex-1]?.questions[0]?.number)}><ChevronLeft size={17}/> Trước</button><strong>Câu {sectionStart}{sectionStart!==sectionEnd?`–${sectionEnd}`:''} / {total}</strong><button className="primary" disabled={activeGroupIndex>=groups.length-1} onClick={()=>navigate(groups[activeGroupIndex+1]?.questions[0]?.number)}>Tiếp <ChevronRight size={17}/></button></div><div className="room-footer-right">Đã trả lời <b>{answered}/{total}</b>{!reviewing&&<button onClick={()=>submit()} disabled={finishing}>Nộp bài <Send size={15}/></button>}</div></footer>
    {error&&<div className="room-floating-error" role="alert">{error}<button onClick={()=>setError('')}><X size={15}/></button></div>}
  </div>
}
