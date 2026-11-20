// @vitest-environment jsdom
import { useState } from 'react'
import { afterEach, expect, test } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Modal from './Modal'

afterEach(cleanup)
function Example({ busy = false }) {
  const [open,setOpen]=useState(false)
  return <><button onClick={()=>setOpen(true)}>Open editor</button><button>Background action</button>{open && <Modal title="Product editor" busy={busy} onClose={()=>setOpen(false)}><label>Product name<input/></label><button>Save</button><button onClick={()=>setOpen(false)}>Cancel</button></Modal>}</>
}
test('shared editor dialog contains focus, blocks background interaction and restores opener on Escape',async()=>{
  render(<Example/>)
  const user=userEvent.setup(), opener=screen.getByRole('button',{name:'Open editor'}), background=screen.getByRole('button',{name:'Background action'})
  await user.click(opener)
  const dialog=screen.getByRole('dialog',{name:'Product editor'}), close=within(dialog).getByRole('button',{name:'Close Product editor'})
  expect(document.activeElement).toBe(close)
  expect(background.parentElement.hasAttribute('inert')).toBe(true)
  expect(document.body.style.overflow).toBe('hidden')
  await user.tab({shift:true});expect(document.activeElement).toBe(within(dialog).getByRole('button',{name:'Cancel'}))
  await user.tab();expect(document.activeElement).toBe(close)
  background.focus();expect(dialog.contains(document.activeElement)).toBe(true)
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(document.activeElement).toBe(opener)
  expect(background.parentElement.hasAttribute('inert')).toBe(false)
  expect(document.body.style.overflow).toBe('')
})
test('busy dialogs do not dismiss through Escape or the close control',async()=>{
  render(<Example busy/>)
  await userEvent.click(screen.getByRole('button',{name:'Open editor'}))
  expect(screen.getByRole('button',{name:'Close Product editor'}).disabled).toBe(true)
  await userEvent.keyboard('{Escape}')
  expect(screen.getByRole('dialog',{name:'Product editor'}).getAttribute('aria-busy')).toBe('true')
})
test('shared close control dismisses the dialog and restores focus',async()=>{
  render(<Example/>)
  const opener=screen.getByRole('button',{name:'Open editor'})
  await userEvent.click(opener)
  await userEvent.click(screen.getByRole('button',{name:'Close Product editor'}))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(document.activeElement).toBe(opener)
})
