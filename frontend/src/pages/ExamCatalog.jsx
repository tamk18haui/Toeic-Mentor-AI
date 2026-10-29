import React,{useEffect,useState} from 'react'
import {Link} from 'react-router-dom'
import {ArrowRight,BookOpen,Clock3,FileText,Headphones,Info,Search,Timer} from 'lucide-react'
import {api} from '../lib/api.js'

export default function ExamCatalog(){
  const [data,setData]=useState(null),[error,setError]=useState(''),[query,setQuery]=useState('')
  useEffect(()=>{api('/exams').then(setData).catch(e=>setError(e.message))},[])
  const groups=(data?.collections||[]).map(group=>({...group,exams:group.exams.filter(e=>(group.name+' '+e.title).toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi')))})).filter(g=>g.exams.length)
  const count=data?.total||0
  return <div className="container learn-page"><header className="learn-heading"><div><span className="kicker">TOEIC LISTENING & READING</span><h1>Kho đề luyện thi TOEIC</h1><p>Chọn đề, làm bài theo từng Part, nghe audio, xem tranh và nhận giải thích đáp án. Dữ liệu được bổ sung liên tục.</p></div><div className="learn-count"><strong>{count}</strong><span>Đề đã sẵn sàng làm</span></div></header>
    <div className="exam-cta-grid"><Link className="exam-cta primary" to="/exams/demo"><span><FileText size={23}/></span><h2>Luyện Part 5 · Demo</h2><p>12 câu tự biên soạn để làm quen giao diện và chữa lỗi ngữ pháp.</p><strong>Bắt đầu luyện <ArrowRight size={17}/></strong></Link><Link className="exam-cta" to="/speaking/mock"><span><Headphones size={23}/></span><h2>Thi thử Speaking</h2><p>11 câu, ghi âm và đánh giá luyện nói bằng AI.</p><strong>Luyện nói <ArrowRight size={17}/></strong></Link><Link className="exam-cta" to="/writing/mock"><span><FileText size={23}/></span><h2>Thi thử Writing</h2><p>8 câu viết với bộ đếm giờ, có thể chấm AI khi đã cấu hình.</p><strong>Luyện viết <ArrowRight size={17}/></strong></Link></div>
    {count>0&&<div className="learn-search grammar-search"><Search size={19}/><input aria-label="Tìm đề thi" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tìm bộ đề hoặc tên đề…"/></div>}
    <div className="learn-results exam-results"><strong>Đề thi Listening & Reading</strong><span>{groups.reduce((n,g)=>n+g.exams.length,0)} đề</span></div>
    {error&&<div className="learn-message warn"><Info size={18}/> Không kết nối MySQL: {error}. Hãy kiểm tra backend.</div>}
    {!error&&!count&&<div className="learn-message warn"><Info size={19}/><div><strong>Chưa có đề được xuất bản</strong><p>Người quản trị có thể vào <Link to="/admin">Admin</Link> để nhập file JSON + media.zip, kiểm tra rồi bật công khai đề. Bài demo và các khóa Speaking/Writing vẫn hoạt động.</p></div></div>}
    <div className="exam-live-groups">{groups.map(group=><section key={group.name}><h2><BookOpen size={20}/> Bộ đề {group.name} <span>{group.exams.length} đề</span></h2><div className="exam-live-grid">{group.exams.map(exam=><Link className="exam-live-card" to={`/exams/${encodeURIComponent(exam.id)}`} key={exam.id}><div className="exam-live-index"><FileText size={24}/><span>FULL TEST</span></div><h3>{group.name} · {exam.title}</h3><p><Clock3 size={15}/> {exam.duration_minutes} phút <span>·</span> <BookOpen size={15}/> {exam.question_count} câu</p><p><Headphones size={15}/> {exam.media_count} tệp audio/ảnh</p><strong>Vào phòng thi <ArrowRight size={17}/></strong></Link>)}</div></section>)}</div>
    <div className="exam-library-note"><Timer size={20}/><div><strong>Hai chế độ phù hợp mục tiêu</strong><p>Chế độ luyện tập cho phép xem đáp án từng câu. Chế độ thi thử có đếm ngược và chỉ xem đáp án sau khi nộp bài. Điểm hiển thị là số câu đúng, không phải điểm TOEIC quy đổi chính thức.</p></div></div>
  </div>
}
