import React,{createContext,useContext,useEffect,useState} from 'react'
import {Link,NavLink,Navigate,Route,Routes,useLocation} from 'react-router-dom'
import {BookOpen,Headphones,FileText,MessageCircleMore,PenLine,ChevronDown,ArrowRight,GraduationCap,Flame,Bell,Menu,X,Sparkles,LogOut,UserRound,Lock,Mail,ShieldCheck} from 'lucide-react'
import {api,getSession,setSession} from './lib/api.js'
import Dashboard from './pages/Dashboard.jsx'
import IPA from './pages/IPA.jsx'
import Speaking from './pages/Speaking.jsx'
import SpeakingPractice from './pages/SpeakingPractice.jsx'
import SpeakingMock from './pages/SpeakingMock.jsx'
import Writing from './pages/Writing.jsx'
import WritingPractice from './pages/WritingPractice.jsx'
import WritingMock from './pages/WritingMock.jsx'
import StaticCourse from './pages/StaticCourse.jsx'
import {VocabularyList,VocabularyDetail} from './pages/Vocabulary.jsx'
import {GrammarList,GrammarDetail} from './pages/Grammar.jsx'
import {ExamDemo} from './pages/Exams.jsx'
import ExamCatalog from './pages/ExamCatalog.jsx'
import ExamRoom from './pages/ExamRoom.jsx'
import Admin from './pages/Admin.jsx'
import {Footer} from './components/Footer.jsx'

const UserContext=createContext(null)
export const useUser=()=>useContext(UserContext)

const menus={
  speaking:[{label:'Luyện IPA',desc:'44 âm • Bài tập theo từ',url:'/ipa',icon:BookOpen},{label:'Luyện nói TOEIC',desc:'6 nhóm bài tập thực hành',url:'/speaking',icon:MessageCircleMore},{label:'Thi thử Speaking',desc:'11 câu • Hẹn giờ & ghi âm',url:'/speaking/mock',icon:Headphones}],
  writing:[{label:'Luyện viết TOEIC',desc:'Ảnh • Email • Essay',url:'/writing',icon:PenLine},{label:'Thi thử Writing',desc:'8 câu • 60 phút',url:'/writing/mock',icon:FileText}],
}

function Dropdown({label,entries,active,onClose}){return <div className={`nav-dropdown ${active?'nav-active':''}`}><button className="nav-trigger" type="button">{label}<ChevronDown size={15}/></button><div className="dropdown-panel"><div className="dropdown-caption">CHỌN LỘ TRÌNH HỌC</div>{entries.map(x=><NavLink onClick={onClose} className="dropdown-item" to={x.url} key={x.url}><span className="dropdown-icon"><x.icon size={19}/></span><span><strong>{x.label}</strong><small>{x.desc}</small></span><ArrowRight size={15}/></NavLink>)}</div></div>}

function AuthModal({close,login}){
  const [mode,setMode]=useState('login'),[name,setName]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[loading,setLoading]=useState(false),[error,setError]=useState('')
  useEffect(()=>{const handler=e=>{if(e.key==='Escape')close()};window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler)},[close])
  const submit=async e=>{e.preventDefault();setError('');setLoading(true);try{const result=await api(`/auth/${mode}`,{method:'POST',body:{name,email,password}});login(result);close()}catch(err){setError(err.message)}finally{setLoading(false)}}
  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&close()}><div className="auth-modal" role="dialog" aria-modal="true" aria-label="Đăng nhập"><button className="modal-close" onClick={close} aria-label="Đóng"><X size={20}/></button><div className="auth-decoration"><span><GraduationCap size={25}/></span><h2>Rất vui khi bạn quay lại!</h2><p>Mỗi buổi luyện tập đều là một bước tiến để bạn tự tin sử dụng tiếng Anh.</p><div className="auth-quote">“Small steps, remarkable progress.”</div></div><div className="auth-form-wrap"><div className="kicker">TÀI KHOẢN HỌC VIÊN</div><h2>{mode==='login'?'Chào mừng trở lại':'Tạo tài khoản miễn phí'}</h2><p>Lưu kết quả và tiếp tục hành trình của bạn.</p><form onSubmit={submit}>{mode==='register'&&<label className="form-row"><span>Họ và tên</span><div><UserRound size={17}/><input value={name} onChange={e=>setName(e.target.value)} placeholder="Nguyễn Văn A" required/></div></label>}<label className="form-row"><span>Địa chỉ email</span><div><Mail size={17}/><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" required/></div></label><label className="form-row"><span>Mật khẩu</span><div><Lock size={17}/><input type="password" value={password} minLength={8} onChange={e=>setPassword(e.target.value)} placeholder="Tối thiểu 8 ký tự" required/></div></label>{error&&<div className="field-error">{error}</div>}<button className="btn btn-primary btn-block" disabled={loading}>{loading?'Đang kết nối...':mode==='login'?'Đăng nhập':'Tạo tài khoản'} <ArrowRight size={16}/></button></form><p className="auth-switch">{mode==='login'?'Chưa có tài khoản?':'Đã có tài khoản?'} <button onClick={()=>{setMode(mode==='login'?'register':'login');setError('')}}>{mode==='login'?'Đăng ký ngay':'Đăng nhập'}</button></p><p className="muted-small"><ShieldCheck size={14}/> Mật khẩu được mã hóa trước khi lưu vào MySQL.</p></div></div></div>
}

export default function App(){
  const [session,setCurrentSession]=useState(getSession),[showAuth,setShowAuth]=useState(false),[mobileOpen,setMobileOpen]=useState(false)
  const location=useLocation()
  const inExamRoom=/^\/exams\/[^/]+$/.test(location.pathname)&&location.pathname!=='/exams/demo'
  useEffect(()=>{window.scrollTo(0,0);setMobileOpen(false)},[location.pathname])
  const login=value=>{setSession(value);setCurrentSession(value)}
  const logout=()=>{setSession(null);setCurrentSession(null)}
  const closeMenu=()=>setMobileOpen(false)
  return <UserContext.Provider value={{session,login,logout,openAuth:()=>setShowAuth(true)}}><div className="app-shell">
    {!inExamRoom&&<header className="site-header"><div className="container header-inner"><Link className="brand" to="/"><span className="brand-mark"><GraduationCap size={23}/></span><span>toeic<span className="brand-accent">studio</span><small>LEARN. SPEAK. GROW.</small></span></Link>
      <nav className={`site-nav ${mobileOpen?'mobile-open':''}`} aria-label="Điều hướng chính"><NavLink onClick={closeMenu} to="/" end>Tổng quan</NavLink><NavLink onClick={closeMenu} to="/vocabulary">Từ vựng</NavLink><NavLink onClick={closeMenu} to="/grammar">Ngữ pháp</NavLink><NavLink onClick={closeMenu} to="/exams">Luyện đề</NavLink><NavLink onClick={closeMenu} to="/listening">Luyện nghe</NavLink><Dropdown label="Luyện nói" entries={menus.speaking} active={location.pathname==='/ipa'||location.pathname.startsWith('/speaking')} onClose={closeMenu}/><Dropdown label="Luyện viết" entries={menus.writing} active={location.pathname.startsWith('/writing')} onClose={closeMenu}/></nav>
      <div className="header-actions"><span className="streak-pill"><Flame size={17}/> Mỗi ngày một chút</span>{session?<div className="avatar-menu"><span className="avatar-circle">{session.user.name.slice(0,1).toUpperCase()}</span><span className="header-name">{session.user.name.split(' ').at(-1)}</span><button className="icon-button" title="Đăng xuất" onClick={logout}><LogOut size={17}/></button></div>:<button className="btn btn-primary header-login" onClick={()=>setShowAuth(true)}>Đăng nhập <ArrowRight size={16}/></button>}<button className="mobile-toggle" aria-label="Mở menu" onClick={()=>setMobileOpen(v=>!v)}>{mobileOpen?<X size={23}/>:<Menu size={23}/>}</button></div>
    </div></header>}
    <main className="main-area"><Routes><Route path="/" element={<Dashboard/>}/><Route path="/ipa" element={<IPA/>}/><Route path="/ipa/:phoneId" element={<IPA/>}/><Route path="/speaking" element={<Speaking/>}/><Route path="/speaking/practice/:partId" element={<SpeakingPractice/>}/><Route path="/speaking/mock" element={<SpeakingMock/>}/><Route path="/writing" element={<Writing/>}/><Route path="/writing/practice/:partId" element={<WritingPractice/>}/><Route path="/writing/mock" element={<WritingMock/>}/><Route path="/vocabulary" element={<VocabularyList/>}/><Route path="/vocabulary/:id" element={<VocabularyDetail/>}/><Route path="/grammar" element={<GrammarList/>}/><Route path="/grammar/:slug" element={<GrammarDetail/>}/><Route path="/exams" element={<ExamCatalog/>}/><Route path="/exams/demo" element={<ExamDemo/>}/><Route path="/exams/:id" element={<ExamRoom/>}/><Route path="/admin" element={<Admin/>}/><Route path="/listening" element={<StaticCourse type="listening"/>}/><Route path="/reading" element={<StaticCourse type="reading"/>}/><Route path="*" element={<Navigate to="/" replace/>}/></Routes></main>
    {!inExamRoom&&<Footer/>}{showAuth&&<AuthModal close={()=>setShowAuth(false)} login={login}/>}</div></UserContext.Provider>
}
