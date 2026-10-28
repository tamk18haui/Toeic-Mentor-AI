import React,{useState} from 'react'
import {Link,Navigate,useParams} from 'react-router-dom'
import {ArrowLeft,ArrowRight,BookOpen,Mic2,Info,Languages,FileText,ShieldCheck,Lightbulb,Volume2,Sparkles,Loader2,AlertCircle} from 'lucide-react'
import {speakingParts,speakingExercises} from '../data/exams.js'
import {StepBreadcrumb,SpeakButton,Tip} from '../components/Ui.jsx'
import {PromptPanel,TimedSpeechPanel,useTimedSpeech} from '../components/TimedSpeech.jsx'
import SpeakingFeedback from '../components/SpeakingFeedback.jsx'
import {gradeSpeaking} from '../lib/speaking.js'
import {recordAttempt} from '../lib/api.js'
import {useUser} from '../App.jsx'

const tabs=[{id:'record',label:'Ghi âm',icon:Mic2},{id:'sample',label:'Bài mẫu',icon:BookOpen},{id:'vocab',label:'Từ vựng',icon:Languages},{id:'tips',label:'Ngữ pháp & mẹo',icon:Lightbulb}]
const advice={
  read:['Nhấn trọng âm từ, đọc có nhịp nghỉ tại dấu phẩy/dấu chấm.','Chú ý âm cuối /s/, /t/, /d/ và các cụm âm nối.','Tránh đọc từng từ tách biệt, hãy chia cụm nghĩa.'],
  picture:['Đi từ toàn cảnh đến chi tiết: nơi chốn → nhân vật → hành động.','Ưu tiên thì hiện tại tiếp diễn khi mô tả hành động.','Không suy đoán quá mức những chi tiết không nhìn thấy.'],
  questions:['Trả lời thẳng trọng tâm câu hỏi ngay từ câu đầu.','Bổ sung lý do, ví dụ nếu còn thời gian.','Sử dụng thì hiện tại đơn cho thói quen hằng ngày.'],
  information:['Gạch chân thời gian, địa điểm và các thông tin quan trọng.','Đọc nhanh bảng trước khi câu hỏi vang lên.','Trả lời đúng số liệu và nói trọn câu ngắn gọn.'],
  opinion:['Mở đầu bằng quan điểm rõ ràng: In my opinion, ...','Đưa ra ít nhất hai lý do và một ví dụ.','Kết bài trong 1–2 câu, tránh nói vòng vo.'],
  solution:['Thể hiện sự thấu hiểu vấn đề.','Đề xuất giải pháp thiết thực và lý do.','Bài mở rộng theo định dạng cũ, không nằm trong 11 câu hiện hành.'],
}

function PracticeDetail({part,item,index,total,onSelect}){
  const {session}=useUser()
  const [tab,setTab]=useState('record')
  const [feedback,setFeedback]=useState(null)
  const [grading,setGrading]=useState(false)
  const [error,setError]=useState('')
  const prep=part.id==='questions'||part.id==='information'?3:part.prep
  const answer=part.id==='questions'||part.id==='information'?(index%3===2?30:15):part.answer
  const controller=useTimedSpeech({prep,answer,onFinished:()=>{setFeedback(null);setError('')}})
  const submit=async()=>{
    if(!controller.recorder.blob){setError('Hãy ghi âm trước khi chấm.');return}
    setGrading(true);setError('')
    try{
      const result=await gradeSpeaking({blob:controller.recorder.blob,part:part.id,item})
      setFeedback(result);setTab('ai')
      recordAttempt({mode:'speaking_practice',part:part.id,question_ref:item.id,score:result.score,max_score:result.max_score,details:{estimated:true,aspect_scores:{pronunciation:result.pronunciation_score,fluency:result.fluency_score,intonation:result.intonation_score,content:result.content_score}}},session)
    }catch(exc){setError(exc.message);setTab('record')}
    finally{setGrading(false)}
  }
  return <div className="practice-detail">
    <div className="practice-top"><div><span className="kicker">PART {part.number} · BÀI {index+1} / {total}</span><h2>{item.title}</h2><p>{part.english} · Chuẩn bị {prep}s · Trả lời {answer}s</p></div><span className="practice-badge">{part.range}</span></div>
    <div className="practice-columns">
      <div className="practice-question"><div className="practice-panel-head"><span className="dot-icon"><FileText size={18}/></span><div><strong>Đề bài của bạn</strong><small>Đọc kỹ nội dung trước khi bắt đầu</small></div></div><PromptPanel item={item}/>{item.text&&<div className="speech-ref"><SpeakButton text={item.text} rate={0.89}>Nghe đoạn văn mẫu</SpeakButton></div>}{part.legacy&&<Tip variant="orange"><Info size={15}/> Bài mở rộng theo đề cũ, không xuất hiện trong đề thi hiện tại.</Tip>}</div>
      <div className="practice-right"><div className="tab-strip">{tabs.map(t=><button key={t.id} className={tab===t.id?'active':''} onClick={()=>setTab(t.id)}><t.icon size={16}/>{t.label}</button>)}{feedback&&<button className={tab==='ai'?'active':''} onClick={()=>setTab('ai')}><Sparkles size={16}/> Kết quả AI</button>}</div>
        <div className="practice-tab-panel">
          {tab==='record'&&<><TimedSpeechPanel controller={controller} prep={prep} answer={answer} onNext={index+1<total?()=>onSelect(index+1):null} nextText="Bài tiếp theo"/>{controller.recorder.blob&&<div className="speaking-grade-action"><div><strong><Sparkles size={17}/> Chấm bài nói bằng AI</strong><p>Nghe lại bài nói, nhận phản hồi về các âm phát âm chưa rõ và biết nên luyện từ nào tiếp theo.</p></div><button className="btn btn-primary" onClick={submit} disabled={grading}>{grading?<><Loader2 size={16} className="spinner"/> AI đang nghe...</>:<><Sparkles size={17}/> {feedback?'Chấm lại':'Chấm bài nói'}</>}</button></div>}{error&&<div className="notice notice-orange speaking-error"><AlertCircle size={18}/><span>{error}</span></div>}</>}
          {tab==='ai'&&<SpeakingFeedback result={feedback}/>}
          {tab==='sample'&&<div className="sample-content"><span className="mini-eyebrow">SAMPLE ANSWER</span><h3>Gợi ý cách trả lời</h3><div className="sample-answer">{part.id==='read'?item.text:item.sample}</div><SpeakButton text={part.id==='read'?item.text:(item.sample||item.text||item.question)} rate={0.85}>Nghe bài mẫu</SpeakButton><p>Bài mẫu tham khảo; bạn có thể dùng từ ngữ khác, miễn đúng ý.</p></div>}
          {tab==='vocab'&&<div className="vocab-content"><span className="mini-eyebrow">VOCABULARY YOU NEED</span><h3>Từ vựng nên biết</h3>{(item.vocabulary||[]).map(v=><div className="vocab-row" key={v}><span><strong>{v}</strong><small>Nhấn nghe để luyện âm</small></span><SpeakButton text={v} rate={0.8}><Volume2 size={16}/></SpeakButton></div>)}</div>}
          {tab==='tips'&&<div className="tips-content"><span className="mini-eyebrow">HOW TO ANSWER BETTER</span><h3>Mẹo làm tốt dạng bài</h3>{advice[part.id].map((tip,i)=><div className="tip-line" key={i}><span>{i+1}</span><p>{tip}</p></div>)}</div>}
        </div>
      </div>
    </div>
    <div className="practice-bottom"><span><ShieldCheck size={16}/> Kết quả luyện tập giúp bạn nhận ra điểm mạnh và âm cần cải thiện; hãy nghe lại bản ghi để tự đối chiếu.</span><div className="practice-pager"><button className="btn btn-outline" disabled={index===0} onClick={()=>onSelect(index-1)}>Bài trước</button><button className="btn btn-primary" disabled={index+1===total} onClick={()=>onSelect(index+1)}>Tiếp theo <ArrowRight size={16}/></button></div></div>
  </div>
}

export default function SpeakingPractice(){
  const {partId}=useParams()
  const part=speakingParts.find(x=>x.id===partId)
  const [index,setIndex]=useState(0)
  if(!part)return <Navigate to="/speaking" replace/>
  const items=speakingExercises[part.id]
  return <div className="container page-layout"><StepBreadcrumb items={[{label:'Luyện nói',to:'/speaking'},{label:part.title}]}/><div className="practice-header"><div><span className="kicker">SPEAKING · PART {part.number}</span><h1>{part.title}</h1><p>{part.description}</p></div><Link className="btn btn-outline" to="/speaking"><ArrowLeft size={16}/> Danh sách Part</Link></div><div className="exercise-switcher">{items.map((item,i)=><button className={index===i?'active':''} key={item.id} onClick={()=>setIndex(i)}><span>{String(i+1).padStart(2,'0')}</span>{item.title}</button>)}</div><PracticeDetail key={items[index].id} part={part} item={items[index]} index={index} total={items.length} onSelect={setIndex}/></div>
}
