import React,{useState} from 'react'
import {UploadCloud} from 'lucide-react'

export default function AdminBulkVocabulary({lessons,run,act,busy,setSuccess}){
  const [lesson,setLesson]=useState(''),[text,setText]=useState('')
  const parse=()=>text.split(/\r?\n/).map((row,i)=>{
    if(!row.trim())return null
    const values=row.includes('\t')?row.split('\t'):row.split('|')
    if(values.length<2||!values[0].trim()||!values[1].trim())throw new Error(`Dòng ${i+1}: phải có ít nhất từ và nghĩa, ngăn cách bằng Tab hoặc dấu |.`)
    return {word:values[0].trim(),meaning_vi:values[1].trim(),part_of_speech:(values[2]||'').trim(),example_en:(values[3]||'').trim()}
  }).filter(Boolean)
  return <div className="admin-panel"><h2><UploadCloud size={20}/> Nhập nhiều từ cùng lúc</h2><p>Copy từ Excel/Google Sheets (dán có Tab), hoặc nhập theo mẫu từng dòng với dấu <code>|</code>. Mỗi lần tối đa 1.000 từ, có thể nhập nhiều lần vào cùng bài.</p><form className="admin-vertical-form" onSubmit={e=>{e.preventDefault();act(async()=>{if(!lesson)throw new Error('Bạn chưa chọn bài từ vựng.');const terms=parse();if(!terms.length||terms.length>1000)throw new Error('Chọn từ 1–1.000 từ/lần.');const response=await run(`/vocabulary/${encodeURIComponent(lesson)}/terms/bulk`,{method:'POST',body:{terms}});setText('');setSuccess(`Đã thêm ${response.count} từ vào bài học.`)})}}><label>Thêm vào bài học<select required value={lesson} onChange={e=>setLesson(e.target.value)}><option value="">Chọn bài học...</option>{lessons.map(l=><option value={l.id} key={l.id}>{l.collection} · {l.title}</option>)}</select></label><label>Danh sách từ (mỗi dòng là một từ)<textarea rows="12" required value={text} onChange={e=>setText(e.target.value)} placeholder={'appointment | cuộc hẹn | n. | I have an appointment.\nitinerary | lịch trình | n. | Check the itinerary.'}/></label><button type="submit" className="btn btn-primary" disabled={busy||!lesson}><UploadCloud size={17}/> Nhập danh sách</button></form></div>
}
