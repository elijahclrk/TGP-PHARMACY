import {createContext,useContext} from 'react'
export const Academic=createContext(false)
export const academicNotice='ACADEMIC DEMO — SYNTHETIC DATA ONLY — NOT FOR REAL PHARMACY OPERATIONS'
export function useAcademicDemo(){return useContext(Academic)}
