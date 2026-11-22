import {useAcademicDemo,academicNotice} from './academic-context'
export default function AcademicDemoNotice({ compact = false }) {
  return useAcademicDemo() ? <p className={compact ? 'academic-demo-notice-compact' : 'academic-demo-notice'} role="note">{academicNotice}</p> : null
}
