import React,{useEffect,useMemo,useState} from 'react'
import {Link,useParams} from 'react-router-dom'
import {ArrowLeft,ArrowRight,BookOpen,BookText,Check,CheckCircle2,ChevronRight,ClipboardList,FileText,Lightbulb,NotebookPen,RotateCcw,Search,Target,Volume2,X} from 'lucide-react'
import {api,recordAttempt} from '../lib/api.js'
import {useUser} from '../App.jsx'
import '../styles-learning-v2.css'

const COMPLETE_KEY='toeic-studio-grammar-completed'
const retrieve=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}}
const getCompleted=()=>retrieve(COMPLETE_KEY,[])
const say=text=>{if(!('speechSynthesis' in window))return;window.speechSynthesis.cancel();const item=new SpeechSynthesisUtterance(text);item.lang='en-US';item.rate=.85;window.speechSynthesis.speak(item)}
const categoryOf=title=>{const t=String(title||'').toLocaleLowerCase('vi');if(/thì |thời |tiếp diễn|hoàn thành|tương lai|hiện tại|quá khứ/.test(t))return 'Các thì';if(/mệnh đề|câu điều kiện|câu bị động|câu gián tiếp|cấu trúc câu/.test(t))return 'Cấu trúc câu';if(/từ loại|danh từ|động từ|tính từ|trạng từ|giới từ|liên từ|đại từ|mạo từ/.test(t))return 'Từ loại';return 'Ngữ pháp khác'}
const GRAMMAR_TABS=[{id:'lesson',label:'Bài giảng',icon:BookOpen},{id:'formula',label:'Công thức',icon:BookText},{id:'examples',label:'Ví dụ',icon:FileText},{id:'tips',label:'Mẹo TOEIC',icon:Lightbulb},{id:'exercise',label:'Bài tập',icon:ClipboardList},{id:'vocab',label:'Từ vựng',icon:BookText},{id:'quiz',label:'Quiz',icon:Target},{id:'notes',label:'Ghi chú',icon:NotebookPen}]

function blocksToSections(blocks){
  const sections=[]
  for(const block of blocks||[]){
    if(block.type==='h2'){sections.push({heading:block.text||'Kiến thức',blocks:[]})}
    else if(!sections.length)sections.push({heading:'Tổng quan',blocks:[block]})
    else sections.at(-1).blocks.push(block)
  }
  return sections
}

function renderContent(blocks){return (blocks||[]).map((b,i)=>{
  if(!String(b.text||'').trim())return null
  if(b.type==='h3'||b.type==='h4')return <h3 key={i}>{b.text}</h3>
  if(b.type==='li')return <div className="study-grammar-bullet" key={i}><span>•</span>{b.text}</div>
  if(b.type==='blockquote')return <blockquote key={i}>{b.text}</blockquote>
  if(b.type==='table')return <div className="study-grammar-table" key={i}><strong>📋 Bảng kiến thức</strong><p>{b.text}</p><small>Bảng gốc đã được nhập dưới dạng văn bản; có thể cập nhật định dạng ở Admin.</small></div>
  return <p key={i}>{b.text}</p>
})}

function getSnippet(section){const item=section.blocks.find(b=>['p','li','blockquote','table'].includes(b.type)&&String(b.text||'').length>=15);return item?.text?.slice(0,165)||''}
function makeQuiz(sections){
  const pool=sections.map(s=>({heading:s.heading,text:getSnippet(s)})).filter(s=>s.text.length>=18)
  if(pool.length<4)return []
  return pool.slice(0,Math.min(6,pool.length)).map((s,i)=>{
    const other=pool.filter(x=>x.heading!==s.heading&&x.text!==s.text).slice(0,3)
    const items=[s,...other]
    const rotated=items.slice(i%4).concat(items.slice(0,i%4))
    return {heading:s.heading,correct:s.text,options:rotated.map(x=>x.text)}
  }).filter(q=>q.options.length===4)
}

export function GrammarList(){
  const [topics,setTopics]=useState([]),[q,setQ]=useState(''),[category,setCategory]=useState('Tất cả'),[done,setDone]=useState(getCompleted),[error,setError]=useState(''),[loading,setLoading]=useState(true)
  useEffect(()=>{api('/content/grammar').then(setTopics).catch(e=>setError(e.message)).finally(()=>setLoading(false))},[])
  useEffect(()=>{const sync=()=>setDone(getCompleted());window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync)},[])
  const categories=['Tất cả',...new Set(topics.map(t=>categoryOf(t.title)))]
  const filtered=topics.filter(t=>(category==='Tất cả'||categoryOf(t.title)===category)&&t.title.toLocaleLowerCase('vi').includes(q.toLocaleLowerCase('vi')))
  return <div className="container study-wrap"><section className="study-hero grammar-hero"><div className="study-eyebrow">TOEIC STUDIO · GRAMMAR</div><h1>Ngữ pháp TOEIC từ cơ bản đến nâng cao</h1><p>Đọc công thức, nắm ví dụ, ghi nhớ mẹo và tự kiểm tra để làm tốt Part 5–6.</p><div className="study-hero-stats"><span><b>{topics.length||41}</b> chủ điểm</span><span><b>{done.filter(s=>topics.some(t=>t.slug===s)).length}</b> đã hoàn thành</span><span><b>{categories.length-1}</b> nhóm kiến thức</span></div></section>
    <div className="study-list-layout"><aside className="study-filter"><h3><BookOpen size={17}/> Nhóm ngữ pháp</h3>{categories.map(c=><button key={c} className={category===c?'active':''} onClick={()=>setCategory(c)}>{c}<span>{c==='Tất cả'?topics.length:topics.filter(t=>categoryOf(t.title)===c).length}</span></button>)}<div className="study-filter-tip"><Target size={18}/><p>Học lần lượt từ nền tảng, ghi chú lại lỗi thường gặp rồi tự kiểm tra.</p></div></aside><main className="study-list-main"><div className="study-search"><Search size={18}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Tìm thì, mệnh đề, từ loại, cấu trúc…" aria-label="Tìm ngữ pháp"/>{q&&<button onClick={()=>setQ('')}><X size={16}/></button>}</div><div className="study-section-heading"><div><strong>{category==='Tất cả'?'Kho chủ điểm ngữ pháp':category}</strong><small>Chọn chủ điểm để mở bài giảng và các chế độ học</small></div><span>{loading?'Đang tải…':`${filtered.length} chủ đề`}</span></div>{error&&<div className="study-alert" role="alert">{error}</div>}<div className="study-lessons-grid grammar-lessons-grid">{filtered.map((t,i)=><Link to={`/grammar/${encodeURIComponent(t.slug)}`} key={t.slug} className="study-lesson-card grammar-lesson-card"><div className="study-card-meta"><span className="study-card-icon"><BookText size={22}/></span><span className={`study-badge ${done.includes(t.slug)?'complete':''}`}>{done.includes(t.slug)?'✓ Đã học':categoryOf(t.title)}</span></div><h3>{t.title}</h3><small>{t.block_count} mục kiến thức</small><div className="study-card-foot"><span>Part 5 · Part 6</span><strong>Vào học <ArrowRight size={15}/></strong></div></Link>)}</div>{!loading&&!filtered.length&&!error&&<div className="study-empty">Không thấy chủ điểm phù hợp. Bạn thử tìm bằng từ khóa ngắn hơn nhé.</div>}</main></div>
  </div>
}

export function GrammarDetail(){
  const {slug}=useParams(),{session}=useUser()
  const [topic,setTopic]=useState(null),[topics,setTopics]=useState([]),[error,setError]=useState(''),[tab,setTab]=useState('lesson'),[done,setDone]=useState(getCompleted),[notes,setNotes]=useState('')
  const [revealed,setRevealed]=useState({}),[quizAnswers,setQuizAnswers]=useState({}),[quizDone,setQuizDone]=useState(false),[relatedVocab,setRelatedVocab]=useState([])
  useEffect(()=>{let active=true;setTopic(null);setError('');setTab('lesson');setRevealed({});setQuizAnswers({});setQuizDone(false);setNotes(retrieve(`toeic-grammar-note-v2-${slug}`,''));api(`/content/grammar/${encodeURIComponent(slug)}`).then(d=>active&&setTopic(d)).catch(e=>active&&setError(e.message));api('/content/grammar').then(d=>active&&setTopics(d)).catch(()=>{});return()=>{active=false}},[slug])
  useEffect(()=>{if(!topic)return;let active=true;const params=new URLSearchParams({q:topic.title,limit:'6'});api(`/content/vocabulary/lessons?${params}`).then(d=>active&&setRelatedVocab(d.items||[])).catch(()=>active&&setRelatedVocab([]));return()=>{active=false}},[topic])
  const sections=useMemo(()=>blocksToSections(topic?.blocks||[]),[topic]),quiz=useMemo(()=>makeQuiz(sections),[sections])
  const quizCount=Object.keys(quizAnswers).length,score=quiz.reduce((n,item,i)=>n+Number(quizAnswers[i]===item.correct),0)
  const mark=async()=>{if(done.includes(slug))return;const next=[...done,slug];setDone(next);try{localStorage.setItem(COMPLETE_KEY,JSON.stringify(next))}catch{}try{await recordAttempt({mode:'grammar_review',part:'grammar',question_ref:slug.slice(0,80),score:1,max_score:1,details:{title:topic.title}},session)}catch{}}
  const saveNote=value=>{setNotes(value);try{localStorage.setItem(`toeic-grammar-note-v2-${slug}`,JSON.stringify(value))}catch{}}
  const submitQuiz=async()=>{if(quizDone||quizCount!==quiz.length||!quiz.length)return;setQuizDone(true);try{await recordAttempt({mode:'grammar_quiz',part:'grammar',question_ref:slug.slice(0,80),score,max_score:quiz.length,details:{title:topic.title,type:'lesson_recall'}},session)}catch{}}
  if(error)return <div className="container study-wrap"><div className="study-alert">{error}</div><Link to="/grammar">Quay lại kho ngữ pháp</Link></div>
  if(!topic)return <div className="container study-wrap"><div className="study-empty">Đang tải bài học ngữ pháp…</div></div>
  const isDone=done.includes(slug)
  const selectSections=(kind)=>sections.filter(s=>({formula:/công thức|so sánh|dấu hiệu|cách dùng/i,examples:/ví dụ|lỗi thường gặp/i,tips:/mẹo|dấu hiệu|lỗi thường gặp/i}[kind]).test(s.heading))
  const titleFor={formula:'Công thức & dấu hiệu nhận biết',examples:'Ví dụ và lỗi thường gặp',tips:'Mẹo làm TOEIC Part 5–6'}
  const related=topics.filter(t=>t.slug!==slug&&(categoryOf(t.title)===categoryOf(topic.title))).slice(0,6)
  const regexKeywords=/(?:who|which|whom|whose|that|where|when|why|since|because|although|despite|unless|until|while|if|will|would|have|has|had|been|being|must|should|may|might|can|could|do|does|did|to|for|with|of|by|in|on)\b/gi
  const keywords=[...new Set((topic.blocks||[]).flatMap(b=>String(b.text||'').match(regexKeywords)||[]).map(s=>s.toLowerCase()))].slice(0,16)
  return <div className="container study-wrap study-detail"><Link to="/grammar" className="study-back"><ArrowLeft size={17}/> Kho ngữ pháp / {categoryOf(topic.title)}</Link><section className="study-detail-header grammar-detail-header"><div><span className="study-eyebrow">GIÁO TRÌNH NGỮ PHÁP TOEIC</span><h1>{topic.title}</h1><p>Đọc bài giảng, nắm công thức và tự đánh giá kiến thức vừa học.</p></div><button className={`study-complete ${isDone?'complete':''}`} disabled={isDone} onClick={mark}><CheckCircle2 size={19}/>{isDone?'Đã hoàn thành':'Đánh dấu đã học'}</button></section><nav className="study-mode-tabs" aria-label="Các tab học ngữ pháp">{GRAMMAR_TABS.map(t=><button className={tab===t.id?'active':''} onClick={()=>setTab(t.id)} key={t.id}><t.icon size={16}/>{t.label}</button>)}</nav>
    <div className="study-grammar-layout"><aside className="study-grammar-outline"><h3><BookText size={17}/> Nội dung bài học</h3>{sections.map((s,i)=><button key={i} onClick={()=>{setTab('lesson');requestAnimationFrame(()=>document.getElementById(`grammar-section-${i}`)?.scrollIntoView({behavior:'smooth',block:'start'}))}}><span>{String(i+1).padStart(2,'0')}</span>{s.heading}</button>)}<Link to="/grammar">Tất cả chủ điểm <ArrowRight size={16}/></Link></aside>
    <main className="study-grammar-main">
      {tab==='lesson'&&<><div className="study-panel-heading"><span>01 · BÀI GIẢNG</span><h2>Nắm vững {topic.title}</h2><p>Đọc theo từng mục, chú ý những công thức và ví dụ áp dụng.</p></div>{sections.map((s,i)=><section className="study-grammar-section" id={`grammar-section-${i}`} key={i}><h2>{s.heading}</h2>{renderContent(s.blocks)}</section>)}<div className="study-grammar-finish"><CheckCircle2 size={23}/><div><strong>Đã đọc hết bài?</strong><p>Hãy thử tab Bài tập hoặc Quiz để tự kiểm tra.</p></div><button onClick={()=>setTab('exercise')}>Ôn tập <ArrowRight size={15}/></button></div></>}
      {['formula','examples','tips'].includes(tab)&&<><div className="study-panel-heading"><span>ÔN THEO CHỦ ĐỀ</span><h2>{titleFor[tab]}</h2><p>Nội dung được chọn lọc trực tiếp từ bài giảng đang học.</p></div>{selectSections(tab).length?selectSections(tab).map((s,i)=><section className="study-grammar-section" key={i}><h2>{s.heading}</h2>{renderContent(s.blocks)}</section>):<div className="study-empty">Bài này chưa có mục riêng cho phần này. Bạn vẫn có thể xem toàn bộ nội dung trong tab Bài giảng.</div>}</>}
      {tab==='exercise'&&<><div className="study-panel-heading"><span>LUYỆN TẬP CHỦ ĐỘNG</span><h2>Nhớ kiến thức bằng cách tự trả lời</h2><p>Đọc tên mục, tự nhớ công thức/định nghĩa trước khi mở đáp án gốc từ bài giảng.</p></div>{sections.filter(s=>getSnippet(s)).slice(0,8).map((s,i)=><div className="study-recall-card" key={i}><small>CÂU TỰ ÔN {i+1}</small><h3>Em nhớ gì về “{s.heading}”?</h3>{revealed[i]?<div className="study-recall-answer">{getSnippet(s)}<button onClick={()=>setRevealed(o=>({...o,[i]:false}))}>Ẩn đáp án</button></div>:<button onClick={()=>setRevealed(o=>({...o,[i]:true}))}>Xem kiến thức gốc <ChevronRight size={16}/></button>}</div>)}<div className="study-grammar-notice">Các thẻ này dùng để tự ôn; chưa phải câu hỏi trắc nghiệm có đáp án nhập từ nguồn.</div></>}
      {tab==='vocab'&&<><div className="study-panel-heading"><span>TỪ VỰNG LIÊN QUAN</span><h2>Từ khóa thường xuất hiện</h2><p>Đọc lại các từ chức năng trong bài; bấm biểu tượng loa để nghe bằng giọng đọc trình duyệt.</p></div>{keywords.length?<div className="study-grammar-keywords">{keywords.map(w=><button key={w} onClick={()=>say(w)}>{w}<Volume2 size={15}/></button>)}</div>:<div className="study-empty">Chưa phát hiện từ khóa riêng trong bài này.</div>}{relatedVocab.length>0&&<div className="study-related-vocab"><h3>Bài từ vựng tìm thấy theo chủ đề</h3>{relatedVocab.map(v=><Link to={`/vocabulary/${encodeURIComponent(v.id)}`} key={v.id}>{v.title}<ArrowRight size={16}/></Link>)}</div>}<Link className="study-primary link-button" to="/vocabulary">Mở toàn bộ kho từ vựng <ArrowRight size={17}/></Link></>}
      {tab==='quiz'&&<><div className="study-panel-heading"><span>QUIZ GHI NHỚ BÀI GIẢNG</span><h2>Kiểm tra hiểu nội dung</h2><p>Chọn đoạn giải thích đúng với mục kiến thức. Đây là bài ôn tự tạo từ nội dung, không phải đề TOEIC chính thức.</p><strong>{quizCount}/{quiz.length} câu đã làm</strong></div>{quiz.length?quiz.map((q,i)=><article className="study-quiz-card" key={i}><small>CÂU {i+1}/{quiz.length}</small><h3>Nội dung nào thuộc mục “{q.heading}”?</h3><div>{q.options.map((choice,j)=><button key={`${i}-${j}`} className={`${quizAnswers[i]===choice?'chosen':''} ${quizDone&&choice===q.correct?'right':''} ${quizDone&&quizAnswers[i]===choice&&choice!==q.correct?'wrong':''}`} disabled={quizDone} onClick={()=>setQuizAnswers(p=>({...p,[i]:choice}))}><span>{String.fromCharCode(65+j)}</span>{choice}</button>)}</div>{quizDone&&<p className="study-quiz-solution">Ghi nhớ: {q.correct}</p>}</article>):<div className="study-empty">Chưa đủ bốn mục kiến thức khác nhau để tạo câu hỏi ôn tập. Hãy dùng tab Bài tập để tự kiểm tra.</div>}{quizDone?<div className="study-quiz-finish"><strong>Đúng {score}/{quiz.length} câu!</strong><button onClick={()=>{setQuizAnswers({});setQuizDone(false)}}><RotateCcw size={16}/> Làm lại</button></div>:<button className="study-primary" onClick={submitQuiz} disabled={!quiz.length||quizCount!==quiz.length}>Nộp bài <ArrowRight size={17}/></button>}</>}
      {tab==='notes'&&<><div className="study-panel-heading"><span>GHI CHÚ CÁ NHÂN</span><h2>Viết lại theo cách bạn hiểu</h2><p>Ghi công thức, lỗi sai hay mẹo cần nhớ. Ghi chú tự lưu trong trình duyệt này.</p></div><textarea className="study-notepad" value={notes} onChange={e=>saveNote(e.target.value)} placeholder="Ví dụ: Dấu hiệu nhận biết thì hiện tại hoàn thành…" rows={12}/><div className="study-grammar-notice"><Check size={16}/> Đã tự lưu trên trình duyệt. Không đồng bộ đám mây ở phiên bản này.</div></>}
    </main><aside className="study-grammar-related"><h3>Học tiếp</h3><p>Các chủ điểm cùng nhóm</p>{related.map(r=><Link key={r.slug} to={`/grammar/${encodeURIComponent(r.slug)}`}>{r.title}<ArrowRight size={15}/></Link>)}<Link to="/grammar">Tất cả chủ điểm <ArrowRight size={15}/></Link></aside></div>
  </div>
}
