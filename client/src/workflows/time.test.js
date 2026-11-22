import {expect,test} from 'vitest'
import {workflowTime} from './time'
test('workflow history presents a verified instant in Manila, never the browser local timezone',()=>{
  expect(workflowTime('2026-11-21T13:46:28.577Z')).toBe('21 Nov 2026, 21:46:28')
  for(const value of [null,'invalid','2026-11-21 13:46:28'])expect(workflowTime(value)).toBe('Not recorded')
})
