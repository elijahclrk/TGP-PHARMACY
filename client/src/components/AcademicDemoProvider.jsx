import {useEffect,useState} from 'react'
import {Academic} from './academic-context'
export default function AcademicDemoProvider({children}){
 const [enabled,setEnabled]=useState(false)
 useEffect(()=>{const controller=new AbortController();fetch('/api/health',{credentials:'same-origin',signal:controller.signal}).then(r=>r.ok?r.json():null).then(data=>{if(!controller.signal.aborted&&data?.academic_demo===true)setEnabled(true)}).catch(()=>{});return()=>controller.abort()},[])
 return <Academic.Provider value={enabled}>{children}</Academic.Provider>
}
