const STORAGE_KEY='toeic-studio-session-v1'
export const getSession=()=>{try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')}catch{return null}}
export const setSession=value=>{if(value)localStorage.setItem(STORAGE_KEY,JSON.stringify(value));else localStorage.removeItem(STORAGE_KEY)}
export async function api(path,{method='GET',body,token,...rest}={}){
  const headers={...(body instanceof FormData?{}:{'Content-Type':'application/json'}),...(token?{Authorization:`Bearer ${token}`}:{})}
  let response
  try{response=await fetch(`/api${path}`,{method,headers,body:body instanceof FormData?body:body===undefined?undefined:JSON.stringify(body),...rest})}
  catch{throw new Error('Không kết nối được hệ thống lúc này. Vui lòng thử lại sau ít phút.')}
  const payload=await response.json().catch(()=>null)
  if(!response.ok)throw new Error(typeof payload?.detail==='string'?payload.detail:`Máy chủ trả về lỗi HTTP ${response.status}`)
  return payload
}
export function saveLocalAttempt(attempt){
  const key='toeic-studio-local-attempts';let items=[]
  try{items=JSON.parse(localStorage.getItem(key)||'[]')}catch{}
  localStorage.setItem(key,JSON.stringify([{...attempt,created_at:new Date().toISOString()},...items].slice(0,100)))
  window.dispatchEvent(new Event('toeic-progress-updated'))
}
export function getLocalAttempts(){try{return JSON.parse(localStorage.getItem('toeic-studio-local-attempts')||'[]')}catch{return []}}
export async function recordAttempt(attempt,session){
  saveLocalAttempt(attempt)
  if(session?.token){try{await api('/attempts',{method:'POST',body:attempt,token:session.token})}catch(err){console.warn('Không thể lưu tiến độ lên MySQL:',err.message)}}
}
