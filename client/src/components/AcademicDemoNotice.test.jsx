// @vitest-environment jsdom
import {afterEach,expect,test,vi} from 'vitest'
import {cleanup,render,screen,waitFor} from '@testing-library/react'
import AcademicDemoProvider from './AcademicDemoProvider'
import AcademicDemoNotice from './AcademicDemoNotice'
import {Academic,academicNotice} from './academic-context'
import {Receipt} from '../pages/Pos'
afterEach(()=>{cleanup();vi.unstubAllGlobals()})
test('verified academic status renders permanent notice on login shell and internal receipt',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({academic_demo:true})}))
 render(<AcademicDemoProvider><AcademicDemoNotice/><div>Login shell</div></AcademicDemoProvider>)
 await screen.findByText(academicNotice)
 cleanup()
 render(<Academic.Provider value={true}><Receipt data={{receipt_no:'SYNTHETIC',username:'demo_employee',sale_date:'2026-11-22T00:00:00Z',items:[],payments:[],total_amount:'0.00'}} onClose={()=>{}}/></Academic.Provider>)
 expect(screen.getByLabelText('Receipt').textContent).toContain(academicNotice)
})
test('normal production status does not activate synthetic labeling',async()=>{
 const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({success:true})});vi.stubGlobal('fetch',fetch)
 render(<AcademicDemoProvider><AcademicDemoNotice/></AcademicDemoProvider>)
 await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(1))
 expect(screen.queryByText(academicNotice)).toBeNull()
})
