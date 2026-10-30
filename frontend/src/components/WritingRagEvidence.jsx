import React from 'react'
import './WritingRagEvidence.css'

const labels={met:'Đã đáp ứng',partial:'Chưa đầy đủ',missing:'Chưa đáp ứng',uncertain:'Cần xác minh'}
export default function WritingRagEvidence({result}){
  if(!result)return null
  const rows=result.task_checks||[]
  const reference=result.rubric_reference
  const flags=result.validation_flags||[]
  if(!rows.length&&!reference&&!result.score_reason_vi&&!flags.length)return null
  return <section className="writing-rag-panel">
    <div className="writing-rag-head"><div className="writing-rag-eyebrow">BẰNG CHỨNG CHẤM BÀI</div><h4>Đối chiếu đề bài và rubric</h4></div>
    {rows.length>0&&<div className="writing-rag-checks">{rows.map((r,i)=><div className="writing-rag-check" key={i}>
      <div className="writing-rag-check-top"><strong>{r.requirement}</strong><span className={'writing-rag-state '+(r.status||'uncertain')}>{labels[r.status]||'Cần xác minh'}</span></div>
      {r.evidence&&<blockquote>“{r.evidence}”</blockquote>}
      {r.explanation_vi&&<p>{r.explanation_vi}</p>}
    </div>)}</div>}
    {result.score_reason_vi&&<div className="writing-rag-reason"><strong>Lý do chọn mức điểm</strong><p>{result.score_reason_vi}</p></div>}
    {result.rubric_comparison_vi&&<div className="writing-rag-reason"><strong>So sánh với mức điểm lân cận</strong><p>{result.rubric_comparison_vi}</p></div>}
    {flags.length>0&&<div className="writing-rag-warnings"><strong>Các điểm cần kiểm tra</strong>{flags.map((x,i)=><p key={i}>{x}</p>)}</div>}
    {reference?.url&&<div className="writing-rag-source"><a href={reference.url} target="_blank" rel="noopener noreferrer">Đọc tiêu chí TOEIC Speaking &amp; Writing của ETS (trang {reference.page})</a><span>Diễn giải rubric phục vụ luyện tập; điểm không phải do ETS cấp.</span></div>}
  </section>
}
