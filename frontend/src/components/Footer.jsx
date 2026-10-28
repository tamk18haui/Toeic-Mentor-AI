import React from 'react'
import {Link} from 'react-router-dom'
import {GraduationCap,Heart,ArrowUpRight} from 'lucide-react'
export function Footer(){return <footer className="site-footer"><div className="container footer-inner"><div className="footer-brand"><span className="brand-mark"><GraduationCap size={21}/></span><div><strong>toeic<span>studio</span></strong><p>Học đúng cách. Tiến bộ mỗi ngày.</p></div></div><div className="footer-links"><Link to="/ipa">IPA</Link><Link to="/speaking">Speaking</Link><Link to="/writing">Writing</Link><Link to="/speaking/mock">Thi thử</Link></div><div className="footer-copy">Made for learners <Heart size={14}/> · Không liên kết với ETS.</div></div></footer>}
