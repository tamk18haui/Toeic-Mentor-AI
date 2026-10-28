import React from 'react'
import {Mail,ClipboardList} from 'lucide-react'
import {Photo} from './Ui.jsx'

export function WritingPrompt({item,part,showRequirements=true,exam=false}){
  const requirementList = exam ? item.requirements : (item.requirementsVi || item.requirements)
  return <div className="writing-prompt-content">
    <div className="prompt-label">{part==='picture'?'LOOK AT THE PICTURE':part==='email'?'READ THE EMAIL':'ESSAY TOPIC'}</div>
    {part==='picture'&&<>
      <Photo className="writing-photo" src={item.image} alt={item.title}/>
      <div className="keywords-prompt"><span>{exam?'Use both words:':'Hai từ bắt buộc:'}</span>{item.keywords.map(x=><b key={x}>{x}</b>)}</div>
      <p className="prompt-instruction">{exam?'Write ONE sentence about the picture. Use both words or phrases. You may change their forms.':'Viết một câu tiếng Anh phù hợp với bức ảnh, sử dụng cả hai từ/cụm từ cho sẵn (có thể đổi dạng từ).'}</p>
    </>}
    {part==='email'&&<>
      <p className="exam-direction">{exam?'Directions: Read the email. Write a reply addressing ALL the requests listed below.':'Đọc email rồi trả lời đầy đủ các yêu cầu của người gửi.'}</p>
      <div className="email-preview"><div className="email-preview-head"><div className="sender-avatar">{item.sender.slice(0,1)}</div><div><strong>{item.sender}</strong><small>Subject: {item.subject}</small></div><Mail size={19}/></div><div className="email-body">{item.text}</div></div>
      {showRequirements&&<div className="requirements exam-email-requirements"><strong><ClipboardList size={16}/>{exam?'Your reply must include:':'Hãy trả lời đủ các yêu cầu:'}</strong>{requirementList.map((r,i)=><div key={i}><span>{i+1}</span>{r}</div>)}</div>}
    </>}
    {part==='essay'&&<>
      <div className="essay-question"><span className="quote-mark">“</span>{item.question}</div>
      {showRequirements&&<div className="requirements"><strong>{exam?'Your response should:':'Gợi ý bố cục:'}</strong>{(exam?['State your opinion clearly.','Support your opinion with reasons and examples.','Organize your response into paragraphs.']:item.prompts).map((p,i)=><div key={i}><span>{i+1}</span>{p}</div>)}</div>}
      <p className="prompt-instruction">{exam?'Write an essay explaining and supporting your opinion. An effective response is usually at least 300 words.':'Mục tiêu khoảng 300 từ hoặc hơn nếu đủ thời gian. Ưu tiên luận điểm rõ, dẫn chứng cụ thể và kết luận tự nhiên.'}</p>
    </>}
  </div>
}
