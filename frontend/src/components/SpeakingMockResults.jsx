import React,{useMemo,useRef,useState} from 'react'
import {Check,RefreshCw,Sparkles,AlertCircle,Headphones,ShieldCheck,Loader2} from 'lucide-react'
import {speakingMock,speakingParts} from '../data/exams.js'
import {PrimaryLink} from './Ui.jsx'
import SpeakingFeedback from './SpeakingFeedback.jsx'
import {gradeSpeaking} from '../lib/speaking.js'
import {recordAttempt} from '../lib/api.js'

export default function SpeakingMockResults({records,restart,session}){
  const [grades,setGrades]=useState({})
  const [busy,setBusy]=useState(null)
  const [errors,setErrors]=useState({})
  const [selected,setSelected]=useState(null)
  const [batch,setBatch]=useState({running:false,index:0,total:0})
  const cancelBatch=useRef(false)
  const done=Object.keys(records).length
  const graded=Object.values(grades)
  const pronunciationAverage=useMemo(()=>{
    const values=graded.map(r=>r.pronunciation_score).filter(v=>Number.isFinite(v))
    return values.length?Math.round(values.reduce((a,b)=>a+b,0)/values.length):null
  },[grades])
  const gradeOne=async question=>{
    const entry=records[question.number]
    if(!entry?.blob||batch.running)return
    setBusy(question.number)
    setErrors(prev=>({...prev,[question.number]:''}))
    try{
      const result=await gradeSpeaking({blob:entry.blob,part:question.part,item:question})
      setGrades(prev=>({...prev,[question.number]:result}))
      setSelected(question.number)
      recordAttempt({mode:'speaking_mock',part:question.part,question_ref:`mock-q${question.number}`,score:result.score,max_score:result.max_score,details:{estimated:true,question_number:question.number}},session)
    }catch(err){setErrors(prev=>({...prev,[question.number]:err.message}))}
    finally{setBusy(null)}
  }
  const gradeAll=async()=>{
    const queue=speakingMock.filter(q=>records[q.number]?.blob&&!grades[q.number])
    if(!queue.length||batch.running||busy!==null)return
    cancelBatch.current=false
    setBatch({running:true,index:0,total:queue.length})
    for(let i=0;i<queue.length;i++){
      if(cancelBatch.current)break
      const question=queue[i]
      setBatch({running:true,index:i+1,total:queue.length})
      setBusy(question.number)
      setErrors(prev=>({...prev,[question.number]:''}))
      try{
        const result=await gradeSpeaking({blob:records[question.number].blob,part:question.part,item:question})
        setGrades(prev=>({...prev,[question.number]:result}))
        if(i===0)setSelected(question.number)
        recordAttempt({mode:'speaking_mock',part:question.part,question_ref:'mock-q'+question.number,score:result.score,max_score:result.max_score,details:{estimated:true,question_number:question.number}},session)
      }catch(err){setErrors(prev=>({...prev,[question.number]:err.message}))}
    }
    setBusy(null)
    setBatch({running:false,index:0,total:0})
  }
  return <div className="container page-layout result-page speaking-exam-results">
    <div className="completion-icon"><Check size={37}/></div><div className="kicker">SPEAKING MOCK COMPLETED</div><h1>Hoàn thành rồi, thật tuyệt!</h1><p>Bạn đã ghi âm {done}/11 câu. Hãy nghe lại từng câu và nhận phản hồi về phát âm để biết mình cần luyện thêm ở đâu.</p>
    <div className="mock-review-action"><div><strong>Nhận nhận xét cho toàn bộ bài nói</strong><p>Hệ thống phân tích lần lượt từng câu để máy hoạt động ổn định. Bạn cũng có thể chọn chấm riêng câu mình quan tâm.</p></div>{batch.running?<button className="btn btn-outline" onClick={()=>{cancelBatch.current=true}}>Dừng sau câu này ({batch.index}/{batch.total})</button>:<button className="btn btn-primary" disabled={busy!==null||!speakingMock.some(q=>records[q.number]?.blob&&!grades[q.number])} onClick={gradeAll}><Sparkles size={16}/> Phân tích các câu còn lại</button>}</div>
    <div className="speaking-mock-summary"><div><Sparkles size={24}/><strong>{graded.length}<small>/11</small></strong><span>Câu đã xem nhận xét</span></div><div><Headphones size={24}/><strong>{pronunciationAverage==null?'—':pronunciationAverage+'/100'}</strong><span>Trung bình phát âm (câu đã phân tích)</span></div><div><ShieldCheck size={24}/><strong>Từng bước</strong><span>Nhận góp ý theo từng âm</span></div></div>
    <div className="result-answer-list speaking-result-list">{speakingMock.map(q=>{
      const answer=records[q.number],grade=grades[q.number],expanded=selected===q.number
      return <div className="speaking-result-entry" key={q.number}><div className={`result-answer ${expanded?'expanded':''}`}><div className="result-answer-num">Q{q.number}</div><div className="speaking-result-name"><strong>{q.title}</strong><small>{speakingParts.find(x=>x.id===q.part)?.english}</small></div>{answer?<div className="speaking-result-control">{grade&&<button className="speaking-result-score" title="Xem nhận xét" onClick={()=>setSelected(expanded?null:q.number)}>{grade.pronunciation_score==null?'Đã nghe':`Phát âm ${grade.pronunciation_score}/100`}</button>}<audio src={answer.url} controls/><button className="btn btn-outline" disabled={busy!==null||batch.running} onClick={()=>gradeOne(q)}>{busy===q.number?<><Loader2 size={15} className="spinner"/> Đang nghe...</>:<><Sparkles size={15}/> {grade?'Chấm lại':'Chấm AI'}</>}</button></div>:<span className="missing-record">Chưa ghi âm</span>}</div>{errors[q.number]&&<div className="speaking-mock-error"><AlertCircle size={16}/>{errors[q.number]}</div>}{grade&&expanded&&<div className="speaking-result-detail"><SpeakingFeedback result={grade} compact/></div>}</div>
    })}</div>
    <div className="result-controls"><button className="btn btn-outline" onClick={restart}><RefreshCw size={17}/> Thi lại</button><PrimaryLink to="/speaking">Luyện theo Part</PrimaryLink></div>
    <p className="score-disclaimer">Kết quả giúp bạn luyện tập, không phải điểm TOEIC chính thức. Nếu bật chức năng phân tích nội dung trực tuyến, bản chép lời có thể được gửi tới dịch vụ xử lý đã cấu hình.</p>
  </div>
}
