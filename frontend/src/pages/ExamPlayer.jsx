import React,{useEffect,useMemo,useRef,useState} from 'react'
import {Link,useParams} from 'react-router-dom'
import {AlertCircle,ArrowLeft,ArrowRight,BookOpen,Check,ChevronLeft,ChevronRight,Clock3,Flag,Headphones,Image as ImageIcon,Info,RotateCcw,Send} from 'lucide-react'
import {api,recordAttempt} from '../lib/api.js'
import {useUser} from '../App.jsx'

const PART_NAMES={1:'Mô tả tranh',2:'Hỏi đáp',3:'Hội thoại',4:'Bài nói ngắn',5:'Hoàn thành câu',6:'Hoàn thành đoạn văn',7:'Đọc hiểu'}
const clock=sec=>`${String(Math.floor(sec/3600)).padStart(2,'0')}:${String(Math.floor(sec%3600/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`

function Media({media,part}){
  const audios=media?.audio||[],images=media?.images||[]
  const [failed,setFailed]=useState({})
  return <div className="player-media">
    {images.map((url,i)=><div className="player-image" key={url}><img src={url} alt={`Hình minh họa câu hỏi ${i+1}`} onError={()=>setFailed(f=>({...f,[url]:true}))} loading="lazy"/>{failed[url]&&<span className="player-no-media"><ImageIcon size={17}/> Không tải được ảnh · kiểm tra file ZIP</span>}</div>)}
    {audios.map((url,i)=><div className="player-audio" key={url}><Headphones size={20}/><div><strong>Đoạn nghe {audios.length>1?i+1:''}</strong><small>Nhấn phát để nghe; có thể nghe lại khi luyện tập</small><audio controls preload="none" src={url} onError={()=>setFailed(f=>({...f,[url]:true}))}/>{failed[url]&&<small>Không tải được audio · kiểm tra file ZIP</small>}</div></div>)}
    {!audios.length&&!images.length&&part<=4&&<div className="player-no-media"><Info size={19}/> Câu hỏi này chưa có file nghe hoặc ảnh được đính kèm.</div>}
  </div>
}

function Results({data,exam,answers,onAgain,onSelect}){
  const byPart=Object.values(data.results.reduce((acc,item)=>{
    const p=acc[item.part]||(acc[item.part]={part:item.part,total:0,correct:0})
    p.total++;p.correct+=Number(item.is_correct);return acc
  },{}))
  return <div className="player-results container">
    <Link to="/exams" className="learn-back"><ArrowLeft size={18}/> Quay về kho đề</Link>
    <div className="player-result-hero"><span className="kicker">BẢNG KẾT QUẢ · TOEIC STUDIO</span><h1>{exam.title} · {exam.collection}</h1><div className="player-big-score"><strong>{data.correct}<small> / {data.total}</small></strong><span>Câu trả lời đúng</span></div><p>Đã làm {data.answered}/{data.total} câu · Độ chính xác {data.percent}%</p><div className="player-result-tip"><AlertCircle size={17}/> Kết quả này là số câu đúng, không phải điểm TOEIC quy đổi chính thức.</div></div>
    <div className="player-results-parts">{byPart.map(x=><div key={x.part}><span>Part {x.part} · {PART_NAMES[x.part]}</span><strong>{x.correct}/{x.total}</strong><div className="player-progress"><span style={{width:`${100*x.correct/x.total}%`}}/></div></div>)}</div>
    <div className="player-result-actions"><button className="btn btn-primary" onClick={onAgain}><RotateCcw size={17}/> Làm lại đề</button><button className="btn btn-outline" onClick={()=>onSelect(data.results.find(x=>!x.is_correct)?.number||1)}><BookOpen size={17}/> Xem đáp án & giải thích</button></div>
    <h2 className="player-review-heading">Đáp án chi tiết</h2><div className="player-review-list">{data.results.map(x=><button key={x.number} className={x.is_correct?'ok':'wrong'} onClick={()=>onSelect(x.number)}><span>Câu {x.number}</span><strong>{answers[x.number]||'—'} → {x.correct||'Chưa có đáp án'}</strong><small>{x.is_correct?'Đúng':'Xem giải thích'} <ArrowRight size={14}/></small></button>)}</div>
  </div>
}

export default function ExamPlayer(){
  const {id}=useParams(),{session}=useUser()
  const [exam,setExam]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(true)
  const [mode,setMode]=useState('practice'),[started,setStarted]=useState(false),[current,setCurrent]=useState(1)
  const [answers,setAnswers]=useState({}),[checked,setChecked]=useState({}),[grade,setGrade]=useState(null)
  const [seconds,setSeconds]=useState(7200),[finishing,setFinishing]=useState(false),[showReview,setShowReview]=useState(false)
  const questions=exam?.questions||[]
  const item=questions.find(q=>q.number===current)||questions[0]
  const total=questions.length,answered=Object.keys(answers).length
  const containerRef=useRef(null),submitting=useRef(false)
  const passage=useMemo(()=>exam?.passages?.find(p=>p.group_ref&&p.group_ref===item?.group_ref),[exam,item])
  const groupQuestions=useMemo(()=>questions.filter(q=>q.group_ref===item?.group_ref),[questions,item])
  const relatedMedia=useMemo(()=>{
    const audio=[...(item?.media?.audio||[]),...(passage?.media?.audio||[])],images=[...(item?.media?.images||[]),...(passage?.media?.images||[])]
    if(!audio.length&&!images.length&&item?.part>=3&&item?.part<=4){
      for(const q of groupQuestions){audio.push(...(q.media?.audio||[]));images.push(...(q.media?.images||[]))}
    }
    return {audio:[...new Set(audio)],images:[...new Set(images)]}
  },[item,passage,groupQuestions])
  useEffect(()=>{let active=true;api(`/exams/${encodeURIComponent(id)}`).then(d=>{if(active){setExam(d);setSeconds(d.duration_minutes*60);setCurrent(d.questions[0]?.number||1)}}).catch(e=>active&&setError(e.message)).finally(()=>active&&setLoading(false));return()=>{active=false}},[id])
  useEffect(()=>{if(!started||grade||seconds<=0)return;const timer=setInterval(()=>setSeconds(n=>Math.max(0,n-1)),1000);return()=>clearInterval(timer)},[started,grade,seconds])
  useEffect(()=>{if(started&&seconds===0&&!grade&&!submitting.current)submit(true)},[seconds,started,grade])
  const scrollTop=()=>containerRef.current?.scrollIntoView({behavior:'smooth',block:'start'})
  const choose=n=>{setCurrent(n);scrollTop()}
  const check=async()=>{
    if(!item||!answers[item.number]||checked[item.number])return
    try{const response=await api(`/exams/${encodeURIComponent(id)}/questions/${item.number}/check`,{method:'POST',body:{choice:answers[item.number]}});setChecked(p=>({...p,[item.number]:response}))}
    catch(e){setError(e.message)}
  }
  const submit=async(auto=false)=>{
    if(submitting.current)return
    if(!auto&&mode==='test'&&answered<total&&!window.confirm(`Bạn mới trả lời ${answered}/${total} câu. Vẫn nộp bài?`))return
    submitting.current=true;setFinishing(true);setError('')
    try{const response=await api(`/exams/${encodeURIComponent(id)}/grade`,{method:'POST',body:{answers:Object.fromEntries(Object.entries(answers).map(([k,v])=>[String(k),v]))}})
      setGrade(response);setShowReview(false)
      await recordAttempt({mode:'reading_full',part:mode,question_ref:id.slice(0,80),score:response.correct,max_score:response.total,details:{title:exam.title,percent:response.percent,answered:response.answered}},session)
      window.scrollTo({top:0,behavior:'smooth'})
    }catch(e){setError(e.message)}finally{setFinishing(false);submitting.current=false}
  }
  const reset=()=>{setAnswers({});setChecked({});setGrade(null);setShowReview(false);setCurrent(questions[0]?.number||1);setSeconds(exam.duration_minutes*60);setStarted(false);window.scrollTo({top:0,behavior:'smooth'})}
  if(loading)return <div className="container learn-page"><div className="learn-message">Đang tải đề thi và dữ liệu câu hỏi…</div></div>
  if(!exam)return <div className="container learn-page"><div className="learn-message warn">{error||'Chưa có đề này.'}</div><Link to="/exams">Quay lại kho đề</Link></div>
  if(grade&&!showReview)return <Results exam={exam} data={grade} answers={answers} onAgain={reset} onSelect={n=>{setCurrent(n);setShowReview(true)}}/>
  const reviewing=Boolean(grade),review=grade?.results.find(q=>q.number===item?.number),feedback=checked[item?.number]||review
  if(!started)return <div className="player-start container"><Link className="learn-back" to="/exams"><ArrowLeft size={17}/> Kho đề TOEIC</Link><div className="player-start-card"><span className="kicker">TOEIC LISTENING & READING</span><h1>{exam.collection} · {exam.title}</h1><p>{total} câu hỏi · {exam.duration_minutes} phút · 7 phần thi. Đề được nhập từ kho dữ liệu quản trị.</p><div className="player-start-metrics"><div><Clock3 size={22}/><strong>{exam.duration_minutes} phút</strong><small>Thời gian</small></div><div><BookOpen size={22}/><strong>{total} câu</strong><small>Listening + Reading</small></div><div><Headphones size={22}/><strong>{exam.media_count} media</strong><small>Audio và hình ảnh</small></div></div><h3>Chọn chế độ làm bài</h3><div className="player-mode-grid"><button className={mode==='practice'?'selected':''} onClick={()=>setMode('practice')}><Check size={21}/><strong>Luyện tập</strong><small>Kiểm tra đáp án và xem giải thích từng câu; có thể chuyển Part.</small></button><button className={mode==='test'?'selected':''} onClick={()=>setMode('test')}><Flag size={21}/><strong>Thi thử</strong><small>Giấu đáp án đến khi nộp, có đồng hồ đếm ngược và bảng điểm.</small></button></div><button className="btn btn-primary player-start-btn" onClick={()=>setStarted(true)}>Bắt đầu làm bài <ArrowRight size={18}/></button><small className="player-fineprint">Nên sử dụng máy tính và tai nghe. Kết quả không phải điểm TOEIC chính thức.</small></div></div>
  const partCounts=Object.entries(PART_NAMES).map(([n,name])=>({part:Number(n),name,questions:questions.filter(q=>q.part===Number(n))})).filter(p=>p.questions.length)
  return <div className="player-shell" ref={containerRef}>
    <div className="player-topbar"><div className="player-top-inner"><Link to="/exams" title="Quay lại kho đề"><ArrowLeft size={19}/></Link><div className="player-top-title"><strong>{exam.collection} · {exam.title}</strong><small>{mode==='test'?'THI THỬ':'LUYỆN TẬP'} · Part {item?.part} · {PART_NAMES[item?.part]}</small></div><span className="player-status">Đã làm {answered}/{total}</span><span className={`player-clock ${seconds<300?'warning':''}`}><Clock3 size={17}/> {clock(seconds)}</span><button className="player-submit" onClick={()=>reviewing?setShowReview(false):submit()} disabled={finishing}>{reviewing?'Kết quả':finishing?'Đang chấm…':'Nộp bài'} <Send size={16}/></button></div><div className="player-top-progress"><span style={{width:`${100*answered/Math.max(total,1)}%`}}/></div></div>
    <div className="player-layout"><aside className="player-sidebar"><strong className="player-side-title">Điều hướng câu hỏi</strong>{partCounts.map(x=><div key={x.part} className="player-part-nav"><h4>Part {x.part} <span>{x.name}</span></h4><div>{x.questions.map(q=><button key={q.number} aria-label={`Câu ${q.number}`} className={[q.number===current?'active':'',answers[q.number]?'answered':'',checked[q.number]?'checked':''].join(' ')} onClick={()=>choose(q.number)}>{q.number}</button>)}</div></div>)}<div className="player-side-legend"><span><i className="done"/> Đã chọn</span><span><i/> Chưa làm</span></div></aside>
      <main className="player-main"><div className="player-question-header"><div><span>PART {item?.part} · {PART_NAMES[item?.part]}</span><h2>Câu {item?.number} <small>/ {total}</small></h2></div><span className="player-question-ref">{item?.part<=4?'LISTENING':'READING'}</span></div>
        {(passage?.passage_text||relatedMedia.audio.length>0||relatedMedia.images.length>0||item?.part<=4)&&<div className="player-source"><Media key={`${id}-${item?.group_ref||item?.number}`} media={relatedMedia} part={item?.part}/>{passage?.passage_text&&<div className="player-passage"><strong>Đoạn văn / tài liệu</strong><p>{passage.passage_text}</p></div>}</div>}
        <div className="player-question"><p className="player-stem">{item?.stem||`Select the best answer for question ${item?.number}.`}</p>{item?.stem_vi&&mode==='practice'&&<small className="player-translation">{item.stem_vi}</small>}
          <div className="player-choices">{item?.options?.map(option=><button key={option.label} disabled={Boolean(checked[item.number])||reviewing} className={[answers[item.number]===option.label?'selected':'',feedback?.correct===option.label?'correct':'',feedback&&answers[item.number]===option.label&&feedback.correct!==option.label?'wrong':''].join(' ')} onClick={()=>setAnswers(a=>({...a,[item.number]:option.label}))}><span>{option.label}</span><div>{option.text||`Phương án ${option.label}`}{feedback&&option.translation_vi&&<small>{option.translation_vi}</small>}</div>{feedback?.correct===option.label&&<Check size={18}/>}</button>)}</div>
          {mode==='practice'&&!reviewing&&!feedback&&<button className="player-check" disabled={!answers[item.number]} onClick={check}><Check size={16}/> Kiểm tra đáp án câu này</button>}
          {feedback&&<div className="player-feedback"><strong className={feedback.is_correct?'good':'bad'}>{feedback.is_correct?'✓ Chính xác!':'Đáp án đúng: '+(feedback.correct||'Chưa có dữ liệu')}</strong><p>{feedback.explanation||'Chưa có giải thích.'}</p>{Object.entries(feedback.by_option||{}).length>0&&<ul>{Object.entries(feedback.by_option).map(([k,txt])=><li key={k}><b>{k}.</b> {txt}</li>)}</ul>}</div>}
        </div><div className="player-question-footer"><button disabled={questions[0]?.number===item?.number} onClick={()=>choose(questions[Math.max(0,questions.findIndex(q=>q.number===item.number)-1)].number)}><ChevronLeft size={17}/> Câu trước</button><span>Câu {item?.number} / {total}</span><button disabled={questions.at(-1)?.number===item?.number} onClick={()=>choose(questions[Math.min(total-1,questions.findIndex(q=>q.number===item.number)+1)].number)}>Câu tiếp <ChevronRight size={17}/></button></div>
      </main></div>{error&&<div className="container player-bottom-error">{error}</div>}
  </div>
}
