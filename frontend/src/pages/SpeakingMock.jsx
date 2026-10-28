import React,{useEffect,useMemo,useRef,useState} from 'react'
import {Link} from 'react-router-dom'
import {ArrowLeft,ArrowRight,Headphones,Mic,Clock3,ShieldCheck,CheckCircle2,Play,AlertCircle,Volume2,Radio,GraduationCap,Flag,VolumeX,FileText,Check,ArrowUpRight,Download,RefreshCw,LockKeyhole,Lightbulb} from 'lucide-react'
import {speakingMock,speakingParts} from '../data/exams.js'
import {PageTitle,PrimaryLink,StepBreadcrumb,Tip} from '../components/Ui.jsx'
import {PromptPanel,TimedSpeechPanel,useTimedSpeech} from '../components/TimedSpeech.jsx'
import {recordAttempt} from '../lib/api.js'
import {useUser} from '../App.jsx'
import SpeakingMockResults from '../components/SpeakingMockResults.jsx'

function MockQuestion({item,onAnswer,onNext}){
  const [autoLeft,setAutoLeft]=useState(4),advanced=useRef(false)
  const part=speakingParts.find(p=>p.id===item.part)
  const directions={read:'Read the text aloud as clearly and naturally as you can.',picture:'Describe the picture in as much detail as possible.',questions:'Listen to the question and give a clear answer.',information:'Use the information in the schedule to answer the question.',opinion:'State your opinion and support it with reasons and examples.'}
  const intro=(item.part==='read'||item.part==='picture')?`Question ${item.number}. ${part.english}.`:`Question ${item.number}. ${item.question||''}`
  const controller=useTimedSpeech({prep:item.prep,answer:item.answer,autoIntro:true,introText:intro,onFinished:blob=>onAnswer(item.number,blob)})
  const done=controller.phase==='review'
  const go=()=>{if(advanced.current)return;advanced.current=true;onNext()}
  useEffect(()=>{if(!done)return;const timeout=setTimeout(go,4000);return()=>clearTimeout(timeout)},[done])
  useEffect(()=>{if(!done)return;const timer=setInterval(()=>setAutoLeft(n=>Math.max(0,n-1)),1000);return()=>clearInterval(timer)},[done])
  return <div className="exam-question"><div className="exam-prompt-col"><div className="exam-prompt-head"><span className="exam-Q">QUESTION {String(item.number).padStart(2,'0')}</span><span className="exam-part">{part.english}</span></div><h2>{item.part==='read'?'Read the Passage':item.part==='picture'?'Describe the Picture':item.part==='information'?'Use the Information Provided':item.part==='opinion'?'Express Your Opinion':'Your Question'}</h2><p className="exam-instructions">{directions[item.part]}</p><PromptPanel item={item} exam/><div className="exam-tip"><ShieldCheck size={16}/> Recording starts and stops automatically. Speak clearly and naturally.</div></div><div className="exam-record-col"><TimedSpeechPanel controller={controller} prep={item.prep} answer={item.answer} exam/><div className="exam-next-block">{done&&<><span><CheckCircle2 size={17}/> Question {item.number} recorded · Next question in {autoLeft}s</span><button className="btn btn-primary" onClick={go}>{item.number===11?'View results':'Next question'} <ArrowRight size={16}/></button></>}{controller.phase==='error'&&<p className="field-error">Please allow microphone access to continue the test.</p>}</div></div></div>
}

export default function SpeakingMock(){
  const {session}=useUser()
  const [phase,setPhase]=useState('intro'),[current,setCurrent]=useState(0),[micReady,setMicReady]=useState(false),[error,setError]=useState(''),[records,setRecords]=useState({})
  const recordsRef=useRef({});recordsRef.current=records
  useEffect(()=>()=>{Object.values(recordsRef.current).forEach(x=>{if(x?.url)URL.revokeObjectURL(x.url)})},[])
  const micCheck=async()=>{setError('');try{const s=await navigator.mediaDevices.getUserMedia({audio:true});s.getTracks().forEach(t=>t.stop());setMicReady(true)}catch(err){setError('Bạn cần cấp quyền microphone trong trình duyệt để thi Speaking. '+(err.message||''))}}
  const begin=async()=>{if(!micReady){setError('Hãy kiểm tra microphone trước khi bắt đầu.');return}setCurrent(0);setPhase('exam')}
  const onAnswer=(number,blob)=>setRecords(prev=>{const old=prev[number];if(old?.url)URL.revokeObjectURL(old.url);return {...prev,[number]:{number,url:URL.createObjectURL(blob),blob}}})
  const onNext=()=>{if(current>=10){setPhase('result');recordAttempt({mode:'speaking_mock',part:'full_exam',question_ref:'practice-set-01',score:null,max_score:null,details:{completed:Object.keys(recordsRef.current).length,total:11,graded:false}},session)}else setCurrent(i=>i+1)}
  const restart=()=>{Object.values(records).forEach(x=>URL.revokeObjectURL(x.url));setRecords({});setCurrent(0);setPhase('intro')}
  if(phase==='intro')return <div className="container page-layout mock-intro"><StepBreadcrumb items={[{label:'Speaking',to:'/speaking'},{label:'Thi thử Speaking'}]}/><div className="mock-intro-grid"><div className="mock-intro-main"><div className="exam-logo"><GraduationCap size={20}/> TOEIC STUDIO · EXAM SIMULATOR</div><h1>Phòng thi Speaking.<br/><span className="gradient-text">Sẵn sàng chinh phục?</span></h1><p>Trải nghiệm bài thi Nói với đủ 11 câu. Sau khi nghe hướng dẫn, hệ thống tự đếm thời gian chuẩn bị và ghi âm như khi thi thật.</p><div className="exam-facts"><div><span>11</span><small>Câu hỏi</small></div><div><span>~20'</span><small>Thời lượng</small></div><div><span>5</span><small>Nhóm nhiệm vụ</small></div></div><div className="precheck"><h3><Mic size={19}/> Kiểm tra micro trước khi vào thi</h3><p>Cho phép truy cập microphone để đảm bảo không bị lỡ thời gian ghi âm.</p><button className={`btn ${micReady?'btn-success':'btn-outline'}`} onClick={micCheck}>{micReady?<><CheckCircle2 size={17}/> Micro hoạt động</>:<><Mic size={17}/> Kiểm tra micro</>}</button>{error&&<p className="field-error">{error}</p>}</div><button className="btn btn-primary btn-wide" onClick={begin} disabled={!micReady}>Bắt đầu bài thi <ArrowRight size={17}/></button><Link className="back-link" to="/speaking"><ArrowLeft size={16}/> Quay lại luyện tập</Link></div><div className="mock-intro-aside"><div className="exam-advice-card"><div className="exam-advice-icon"><Headphones size={34}/></div><h3>Trước khi bắt đầu</h3>{['Dùng tai nghe và micro rõ tiếng.','Ngồi ở nơi yên tĩnh để ghi âm tốt hơn.','Không chuyển tab hoặc tải lại giữa lúc thi.','Bài thi tự chuyển sau mỗi câu hỏi.'].map((v,i)=><div className="advice-line" key={i}><span>{i+1}</span>{v}</div>)}<div className="notice notice-blue"><ShieldCheck size={16}/> Đây là đề luyện tự soạn, không phải đề ETS chính thức; phần này chưa tự chấm điểm tổng.</div></div></div></div></div>
  if(phase==='result')return <SpeakingMockResults records={records} restart={restart} session={session}/>
  const item=speakingMock[current]
  return <div className="exam-layout"><div className="exam-topbar"><div className="exam-brand"><GraduationCap size={22}/> TOEIC STUDIO <span>· Speaking Mock</span></div><div className="exam-progress"><span>QUESTION {current+1} / 11</span><div className="exam-progress-bar"><i style={{width:`${(current+1)/11*100}%`}}/></div></div><button className="btn btn-quiet" onClick={()=>{if(window.confirm('Exit the test? Unsaved recordings will be lost.'))restart()}}><ArrowLeft size={15}/> Exit exam</button></div><div className="exam-content"><div className="exam-dots">{speakingMock.map((q,i)=><span className={`${i===current?'current':i<current?'passed':''}`} key={q.number}>{i<current?<Check size={14}/>:q.number}</span>)}</div><MockQuestion key={current} item={item} onAnswer={onAnswer} onNext={onNext}/></div></div>
}
