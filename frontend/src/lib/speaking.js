import {api} from './api.js'

/** Audio leaves the browser only after explicit click on "Chấm AI". */
export async function gradeSpeaking({blob,part,item}){
  if(!blob)throw new Error('Bạn cần hoàn thành ghi âm trước khi chấm.')
  const form=new FormData()
  const ext=blob.type?.includes('mp4')?'m4a':blob.type?.includes('ogg')?'ogg':'webm'
  form.append('file',blob,`speaking-answer.${ext}`)
  form.append('part',part)
  form.append('task_json',JSON.stringify({text:item.text||'',question:item.question||'',schedule:item.schedule||[]}))
  if(part==='picture'){
    if(!item.image)throw new Error('Đề bài chưa có ảnh để chấm mô tả.')
    const response=await fetch(item.image)
    if(!response.ok)throw new Error('Chưa tải được ảnh đề bài để gửi AI.')
    const image=await response.blob()
    form.append('picture',image,'picture.jpg')
  }
  return api('/speaking/grade',{method:'POST',body:form})
}
