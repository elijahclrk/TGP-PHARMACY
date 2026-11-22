import {useEffect,useState} from 'react'
import {requestJson} from '../auth/api'
export function useOperations(){
 const [state,setState]=useState({preferences:false,purchasing:false,metadata:false})
 useEffect(()=>{let active=true;async function load(){try{const r=await requestJson('/operations/availability');if(active&&r?.data)setState({preferences:r.data.preferences===true,purchasing:r.data.purchasing===true,metadata:r.data.metadata===true})}catch{/* Unavailable capabilities stay disabled. */}}load();return()=>{active=false}},[])
 return state
}
