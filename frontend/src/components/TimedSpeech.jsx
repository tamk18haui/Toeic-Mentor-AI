import React,{useEffect,useRef,useState} from 'react'
import {Mic,Square,Play,ArrowRight,Headphones,Clock3,CheckCircle2,Volume2,AlertCircle,FastForward,RotateCcw} from 'lucide-react'
import {useAudioRecorder,WaveBar} from './Recorder.jsx'
import {TimePill,SpeakButton,Photo} from './Ui.jsx'

export function PromptPanel({item,exam=false}){return <div className="prompt-body"><div className="prompt-label">{item.text?'READ THE PASSAGE':item.image?'LOOK AT THE PICTURE':item.schedule?'STUDY THE INFORMATION':'YOUR QUESTION'}</div>{item.text&&<div className="read-passage">{item.text}</div>}{item.image&&<Photo src={item.image} alt={item.title||'TOEIC practice picture'} className="prompt-image"/>}{item.schedule&&<div className="schedule-wrap"><table className="schedule-table"><thead><tr><th>TIME / DAY</th><th>EVENT / SERVICE</th><th>LOCATION</th></tr></thead><tbody>{item.schedule.map((line,i)=><tr key={i}>{line.map((val,j)=><td key={j}>{val}</td>)}</tr>)}</tbody></table></div>}{item.question&&<div className="question-surface"><span className="question-quote">“</span><p>{item.question}</p>{!exam&&<SpeakButton text={item.question} rate={0.93}>Nghe câu hỏi</SpeakButton>}</div>}{item.keywords&&<div className="keyword-rows">{item.keywords.map(x=><span className="keyword" key={x}>{x}</span>)}</div>}</div>}

export function useTimedSpeech({prep=45,answer=45,autoIntro=false,introText='',onFinished=()=>{}}){
  const recorder=useAudioRecorder()
  const [phase,setPhase]=useState(autoIntro?'intro':'ready'),[remaining,setRemaining]=useState(prep),[error,setError]=useState('')
  const started=useRef(false),finishCalled=useRef(false),finishCallback=useRef(onFinished)
  finishCallback.current=onFinished
  const prepare=()=>{setError('');setRemaining(prep);setPhase('prepare')}
  const start=async()=>{
    try{
      if(!navigator.mediaDevices?.getUserMedia)throw new Error('Cần Chrome/Edge trên localhost để ghi âm.')
      const mic=await navigator.mediaDevices.getUserMedia({audio:true})
      mic.getTracks().forEach(x=>x.stop())
      prepare()
    }catch(err){setPhase('error');setError(err.message||'Bạn chưa cho phép truy cập microphone.')}
  }
  const startRecord=async()=>{if(started.current)return;started.current=true;setPhase('loading');const ok=await recorder.start();if(ok){setRemaining(answer);setPhase('recording')}else{started.current=false;setPhase('error');setError(recorder.error||'Không thể khởi động ghi âm.')}}
  const stopRecord=()=>{recorder.stop();setPhase('review')}
  useEffect(()=>{
    if(phase!=='prepare'&&phase!=='recording')return
    const startSeconds=phase==='prepare'?prep:answer
    const deadline=Date.now()+startSeconds*1000
    let last=startSeconds
    const clock=setInterval(()=>{
      const next=Math.max(0,Math.ceil((deadline-Date.now())/1000))
      if(next!==last){last=next;setRemaining(next)}
      if(next===0){clearInterval(clock);if(phase==='prepare')startRecord();else stopRecord()}
    },120)
    return()=>clearInterval(clock)
  },[phase,prep,answer])
  useEffect(()=>{if(phase==='review'&&recorder.blob&&!finishCalled.current){finishCalled.current=true;finishCallback.current(recorder.blob)}},[phase,recorder.blob])
  useEffect(()=>{if(!autoIntro)return
    const go=()=>setPhase(current=>current==='intro'?'prepare':current)
    if(!introText||!('speechSynthesis' in window)){const t=setTimeout(go,700);return()=>clearTimeout(t)}
    let utterance=new SpeechSynthesisUtterance(introText);utterance.lang='en-US';utterance.rate=0.96
    utterance.onend=go;utterance.onerror=go
    const fallback=setTimeout(go,Math.min(17000,3000+introText.length*70))
    window.speechSynthesis.speak(utterance)
    return()=>{clearTimeout(fallback);window.speechSynthesis.cancel()}
  },[autoIntro,introText])
  return {recorder,phase,remaining,error,start,prepare,startRecord,stopRecord}
}

export function TimedSpeechPanel({controller,prep,answer,exam=false,onNext,nextText='Câu tiếp theo',showRestart=false}){
  const {recorder,phase,remaining,error,start,startRecord,stopRecord}=controller
  const label=(vi,en)=>exam?en:vi
  return <div className={`timed-panel timed-${phase}`}>
    <div className="timed-head"><div><span className="mini-eyebrow">RECORDING STUDIO</span><h3>{phase==='ready'?label('Sẵn sàng ghi âm chưa?','Ready to speak?'):phase==='intro'?label('Nghe hướng dẫn câu hỏi...','Listen to the directions...'):phase==='prepare'?label('Thời gian chuẩn bị','Preparation time'):phase==='loading'?label('Đang bật microphone...','Starting microphone...'):phase==='recording'?label('Đang ghi âm câu trả lời','Recording your answer'):phase==='review'?label('Đã hoàn thành bản ghi','Response recorded'):label('Kiểm tra micro','Check your microphone')}</h3></div><TimePill seconds={['prepare','recording'].includes(phase)?remaining:phase==='ready'?prep:0}/></div>
    <div className="timed-phase-track"><div className={`phase-step ${['prepare','recording','review'].includes(phase)?'on':''}`}>01 {label('Chuẩn bị','Prepare')} <span>{prep}s</span></div><div className={`phase-step ${['recording','review'].includes(phase)?'on':''}`}>02 {label('Trả lời','Respond')} <span>{answer}s</span></div><div className={`phase-step ${phase==='review'?'on':''}`}>03 {label('Hoàn tất','Done')}</div></div>
    <div className="timer-center"><div className={`timer-halo ${phase==='recording'?'timer-rec':''}`}><div className="timer-number">{['prepare','recording'].includes(phase)?String(Math.floor(remaining/60)).padStart(2,'0')+':'+String(remaining%60).padStart(2,'0'):'🎙️'}</div><div className="timer-desc">{phase==='prepare'?label('Đọc đề và lên ý tưởng','Read and prepare your response'):phase==='recording'?label('Hãy nói ngay bây giờ!','Speak now!'):phase==='review'?label('Bản ghi đã được lưu tạm','Your response has been recorded'):label('Hãy đọc kỹ đề bài nhé','Read the instructions carefully')}</div></div><WaveBar active={phase==='recording'}/></div>
    <div className="timed-actions">{phase==='ready'&&<button className="btn btn-primary" onClick={start}><Play size={17}/> {label('Bắt đầu chuẩn bị & ghi âm','Begin preparation')}</button>}{phase==='prepare'&&!exam&&<button className="btn btn-outline" onClick={startRecord}><FastForward size={16}/> Bắt đầu ghi âm ngay</button>}{phase==='recording'&&!exam&&<button className="btn btn-stop" onClick={stopRecord}><Square size={15}/> Dừng ghi âm</button>}{phase==='review'&&<>{recorder.url&&<audio controls src={recorder.url} className="audio-player"/>}{onNext&&<button className="btn btn-primary" onClick={onNext}>{nextText}<ArrowRight size={16}/></button>}</>}{phase==='error'&&<button className="btn btn-primary" onClick={start}><Mic size={17}/> {label('Thử lại','Try again')}</button>}{phase==='intro'&&!exam&&<button className="btn btn-outline" onClick={controller.prepare}>{label('Bỏ qua hướng dẫn','Skip directions')}</button>}</div>
    {error&&<p className="field-error"><AlertCircle size={16}/>{exam?'Unable to use the microphone. Please check your browser permission.':error}</p>}
    {phase==='review'&&<p className="record-note">{label('Bạn có thể nghe lại trước khi chuyển bài. Sau khi luyện, hãy xem nhận xét để biết cách cải thiện.','Your response has been saved. The next question will begin automatically.')}</p>}
    {phase==='ready'&&<p className="record-note">{label('Sau thời gian chuẩn bị, trình duyệt sẽ tự động ghi âm. Cho phép microphone trước khi bắt đầu để tránh bị lỡ thời gian.','Recording will start automatically after preparation.')}</p>}
  </div>
}
