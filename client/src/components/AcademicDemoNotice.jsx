import {useAcademicDemo,academicNotice} from './academic-context'
export default function AcademicDemoNotice(){return useAcademicDemo()?<p className="academic-demo-notice" role="note">{academicNotice}</p>:null}
