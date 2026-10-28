import React,{useEffect,useRef,useState,useMemo} from 'react'
import {Mic,Square,Upload,CheckCircle2} from 'lucide-react'

export function useAudioRecorder(){
  const recorder=useRef(null),stream=useRef(null),chunks=useRef([]),urlRef=useRef(null)
  const [status,setStatus]=useState('idle'),[blob,setBlob]=useState(null),[url,setUrl]=useState(null),[error,setError]=useState('')
  const revoke=()=>{if(urlRef.current){URL.revokeObjectURL(urlRef.current);urlRef.current=null}}
  const stop=()=>{if(recorder.current?.state==='recording')recorder.current.stop();stream.current?.getTracks().forEach(t=>t.stop());stream.current=null}
  const reset=()=>{stop();revoke();setBlob(null);setUrl(null);setError('');setStatus('idle')}
  const start=async()=>{
    setError('');revoke();setBlob(null);setUrl(null)
    try{
      if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined')throw new Error('Trình duyệt không hỗ trợ ghi âm. Hãy dùng Chrome/Edge trên localhost (HTTPS).')
      const microphone=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}})
      stream.current=microphone;chunks.current=[]
      const format=['audio/webm;codecs=opus','audio/mp4','audio/webm'].find(x=>MediaRecorder.isTypeSupported(x))
      const nextRecorder=new MediaRecorder(microphone,format?{mimeType:format}:{})
      recorder.current=nextRecorder
      nextRecorder.ondataavailable=e=>{if(e.data?.size)chunks.current.push(e.data)}
      nextRecorder.onstop=()=>{const output=new Blob(chunks.current,{type:nextRecorder.mimeType||'audio/webm'});setBlob(output);const audioUrl=URL.createObjectURL(output);urlRef.current=audioUrl;setUrl(audioUrl);setStatus('complete');microphone.getTracks().forEach(t=>t.stop());if(stream.current===microphone)stream.current=null}
      nextRecorder.onerror=()=>{setError('Micro gặp lỗi khi ghi âm.');setStatus('error')}
      nextRecorder.start(250);setStatus('recording');return true
    }catch(err){setError(err.message||'Không thể sử dụng micro.');setStatus('error');return false}
  }
  useEffect(()=>()=>{recorder.current?.state==='recording'&&recorder.current.stop();stream.current?.getTracks().forEach(t=>t.stop());if(urlRef.current)URL.revokeObjectURL(urlRef.current)},[])
  return {status,blob,url,error,start,stop,reset}
}

export function RecorderPanel({recorder,onScore,scoring=false,compact=false,allowUpload=false}){
  const uploadRef=useRef(null)
  const [uploaded,setUploaded]=useState(null)
  const uploadedUrl=useMemo(()=>uploaded?URL.createObjectURL(uploaded):null,[uploaded])
  useEffect(()=>()=>{if(uploadedUrl)URL.revokeObjectURL(uploadedUrl)},[uploadedUrl])
  const file=uploaded||recorder.blob
  const displayUrl=uploaded?uploadedUrl:recorder.url
  const filename=uploaded?.name||((recorder.blob?.type||'').includes('mp4')?'recording.m4a':'recording.webm')
  return <div className={`recorder-panel ${compact?'compact':''}`}>
    <div className="recorder-visual"><div className={`mic-orb ${recorder.status==='recording'?'recording':''}`}><Mic size={27}/></div><div><strong>{recorder.status==='recording'?'Đang ghi âm giọng nói...':file?'Đã thu âm xong':'Sẵn sàng luyện nói?'}</strong><p>{recorder.status==='recording'?'Nói rõ ràng, giữ khoảng cách micro 10–20 cm.':'Cho phép truy cập micro để bắt đầu.'}</p></div></div>
    <div className="recorder-actions">
      {recorder.status==='recording'?<button className="btn btn-stop" onClick={recorder.stop}><Square size={16}/> Dừng ghi âm</button>:<button className="btn btn-primary" onClick={()=>{setUploaded(null);recorder.start()}}><Mic size={17}/>{file?'Ghi âm lại':'Bắt đầu ghi âm'}</button>}
      {allowUpload&&<><input ref={uploadRef} type="file" hidden accept="audio/*,.m4a,.webm,.mp3,.wav,.ogg,.flac" onChange={e=>setUploaded(e.target.files?.[0]||null)}/><button className="btn btn-outline" onClick={()=>uploadRef.current?.click()}><Upload size={16}/>Tải ghi âm</button></>}
      {file&&onScore&&<button className="btn btn-dark" disabled={scoring} onClick={()=>onScore(file,filename)}>{scoring?'AI đang phân tích...':<>Chấm âm vị <CheckCircle2 size={16}/></>}</button>}
    </div>
    {file&&displayUrl&&<audio className="audio-player" controls src={displayUrl}/>}
    {recorder.error&&<p className="field-error">{recorder.error}</p>}
  </div>
}

export function WaveBar({active=false}){return <div className={`wave-bars ${active?'is-active':''}`} aria-hidden="true">{Array.from({length:32},(_,i)=><i key={i} style={{'--h':`${12+(i*13)%44}px`,'--d':`${(i%7)*0.08}s`}}/>)}</div>}
