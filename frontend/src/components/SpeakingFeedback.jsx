import React from 'react'
import {AudioLines,BookOpenCheck,CheckCircle2,Clock3,Lightbulb,MessageSquareQuote,ShieldCheck,Volume2,Activity,ArrowRight,AlertCircle} from 'lucide-react'
import {Link} from 'react-router-dom'

const phoneLabels={green:'Đúng',yellow:'Khá ổn',red:'Cần sửa'}
const classify=(score)=>score==null?'not-ready':score>=78?'very-good':score>=58?'getting-there':'keep-practicing'

export default function SpeakingFeedback({result,compact=false}){
  if(!result)return null
  const spoken=result.pronunciation_words||[]
  const timing=result.timing||{}
  const coverage=result.phoneme_coverage||{}
  const fluency=result.fluency_metrics||{}
  const pitch=result.pitch_indicators||{}
  const readCoverage=result.read_coverage
  const tips=result.suspected_words||[]
  const sampled=coverage.scored_words??spoken.length
  const scored=result.pronunciation_score
  const resultLabel=scored==null?'Đang cần thêm dữ liệu':scored>=78?'Phát âm khá rõ':scored>=58?'Bạn đang tiến bộ':'Có âm cần luyện lại'
  return <div className={'coach-feedback'+(compact?' compact':'')}>
    <div className="coach-overview">
      <div className="coach-overview-copy">
        <div className="coach-overline"><AudioLines size={16}/> KẾT QUẢ LUYỆN NÓI</div>
        <h2>{resultLabel}</h2>
        <p>{scored==null?'Chưa đủ dữ liệu để đánh giá phát âm. Bạn có thể nghe lại và thử ghi âm lần nữa.':'Hãy xem từng âm dưới đây để biết mình đọc tốt ở đâu và nên sửa chỗ nào.'}</p>
        <div className="coach-overview-badges">
          <span><CheckCircle2 size={15}/> Đã phân tích {sampled} từ</span>
          <span><Clock3 size={15}/> {Math.round(timing.duration_seconds||0)} giây ghi âm</span>
        </div>
      </div>
      <div className={'coach-rating '+classify(scored)} aria-label="Điểm luyện phát âm tham khảo">
        <strong>{scored==null?'—':scored}</strong><span>{scored==null?'Chưa chấm':'/100'}</span>
        <small>Phát âm tham khảo</small>
      </div>
    </div>

    <div className="coach-insights">
      <div><span className="coach-insight-icon"><AudioLines size={20}/></span><strong>{fluency.words_per_speech_minute_est??'—'}</strong><span>Từ/phút khi nói</span><small>Nhịp độ</small></div>
      <div><span className="coach-insight-icon"><Clock3 size={20}/></span><strong>{timing.long_pause_count_est??'—'}</strong><span>Lần ngắt dài</span><small>Độ liền mạch</small></div>
      <div><span className="coach-insight-icon"><Activity size={20}/></span><strong>{pitch.pitch_range_hz_est==null?'—':Math.round(pitch.pitch_range_hz_est)+' Hz'}</strong><span>Biến thiên cao độ</span><small>Ngữ điệu khi nói</small></div>
    </div>

    <div className="coach-content-grid">
      <section className="coach-section coach-phonemes">
        <div className="coach-section-title"><div><span className="coach-kicker">PHÁT ÂM</span><h3><Volume2 size={19}/> Nhìn rõ từng âm bạn đã đọc</h3></div><span className="coach-chip-count">{sampled}/{coverage.recognized_words??sampled} từ</span></div>
        <p className="coach-section-desc">Mỗi màu thể hiện mức độ rõ của âm trong những từ đã được phân tích. Chạm vào âm để xem cách sửa.</p>
        <div className="coach-key"><span><i className="legend-phone-green"/> Đọc tốt</span><span><i className="legend-phone-yellow"/> Gần đúng</span><span><i className="legend-phone-red"/> Cần sửa</span></div>
        {spoken.length?<div className="coach-word-list">{spoken.map((w,i)=><div className="coach-word-card" key={w.word+'-'+i}>
          <div className="coach-word-head"><div><strong>{w.word}</strong><span>{w.ipa_text}</span></div><span className={'coach-word-rating '+classify(w.score)}>{w.score}/100</span></div>
          <div className="coach-phone-list">{(w.phones||[]).map((p,j)=><details className="coach-phone-detail" key={p.ipa+'-'+j}><summary className={'coach-phone-symbol phone-'+p.color} title={'Âm '+p.ipa+': '+phoneLabels[p.color]}>{p.ipa}</summary><p>{p.tip||'Hãy nghe lại cách đọc âm này.'}</p></details>)}</div>
        </div>)}</div>:<div className="coach-empty"><AlertCircle size={22}/><p>Chưa thể phân tích từng âm. Hãy thử nói gần micro hơn, giảm tiếng ồn và ghi âm lại.</p></div>}
        {coverage.recognized_words>sampled&&<p className="coach-quiet-note">Hệ thống lấy một số từ đại diện để phân tích, không đánh giá tất cả các từ trong bản ghi.</p>}
      </section>
      <aside className="coach-side">
        <section className="coach-section coach-next-steps">
          <div className="coach-section-title"><div><span className="coach-kicker">DÀNH CHO BẠN</span><h3><Lightbulb size={19}/> Nên luyện gì tiếp?</h3></div></div>
          {(result.improvements_vi||[]).filter(s=>!/(Whisper|E2E|GOPT|Docker|Kaldi|API|model|FastAPI|cài INSTALL)/i.test(s)).slice(0,4).map((s,i)=><div className="coach-tip-row" key={i}><span>{i+1}</span><p>{s}</p></div>)}
          {!result.improvements_vi?.length&&<div className="coach-tip-row"><span>1</span><p>Thử đọc lại chậm hơn một chút và so sánh kết quả.</p></div>}
          <Link className="coach-ipa-cta" to="/ipa">Luyện lại âm IPA <ArrowRight size={17}/></Link>
        </section>
        <section className="coach-section coach-positive">
          <h3><CheckCircle2 size={18}/> Điểm bạn làm tốt</h3>
          {(result.strengths_vi||[]).map((s,i)=><p key={i}>{s}</p>)}
        </section>
      </aside>
    </div>

    {tips.length>0&&<section className="coach-section coach-weak-words">
      <div className="coach-section-title"><div><span className="coach-kicker">ƯU TIÊN LUYỆN</span><h3><Lightbulb size={19}/> Những từ nên đọc lại</h3></div></div>
      <div className="coach-weak-list">{tips.map((w,i)=><div key={i}><strong>{w.word}</strong><span className={'coach-weak-tag tag-'+w.color}>/{w.phone}/</span><p>{w.reason_vi}</p></div>)}</div>
    </section>}

    {result.word_alignment?.length>0&&<section className="coach-section coach-readback">
      <h3><BookOpenCheck size={19}/> So sánh với đoạn đọc</h3>
      {readCoverage&&<p>Đã nhận dạng khớp <strong>{readCoverage.matched}/{readCoverage.total}</strong> từ trong đoạn mẫu. Từ chưa khớp cần nghe lại, chưa chắc đã phát âm sai.</p>}
      <div className="speaking-word-row">{result.word_alignment.map((w,i)=><span key={i} className={w.status==='recognized'?'read-word-recognized':'read-word-check'}>{w.word}</span>)}</div>
      <div className="speaking-legend"><span><i className="legend-recognized"/> Nhận dạng khớp</span><span><i className="legend-unverified"/> Cần nghe lại</span></div>
    </section>}

    <section className="coach-section coach-transcript">
      <div className="coach-section-title"><div><span className="coach-kicker">NGHE LẠI BÀI CỦA BẠN</span><h3><MessageSquareQuote size={19}/> Nội dung được nhận dạng</h3></div></div>
      <blockquote>{result.transcript||'Chưa nhận dạng rõ nội dung lời nói.'}</blockquote>
      <small>Đôi khi bản chép lời có thể tự sửa từ bạn phát âm chưa chính xác. Hãy nghe lại bản ghi khi đối chiếu.</small>
    </section>
    {result.content_score!=null&&<section className="coach-section coach-content-review"><h3><BookOpenCheck size={18}/> Mức độ đáp ứng yêu cầu</h3><strong>{result.content_score}/100</strong><p>{result.overall_vi}</p></section>}
    <div className="coach-footnote"><ShieldCheck size={17}/> Kết quả dùng để tự luyện tập, chưa phải điểm TOEIC chính thức. Âm màu đỏ là gợi ý để kiểm tra lại bằng tai.</div>
  </div>
}
