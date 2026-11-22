// @vitest-environment jsdom
import {afterEach,test,expect} from 'vitest'
import {render,screen,cleanup} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {useState} from 'react'
import BenefitCheckout from './BenefitCheckout'
import {emptyBenefitDraft} from './benefit-draft'
afterEach(cleanup)
function Form({disabled=false}){const[draft,setDraft]=useState(emptyBenefitDraft);return <BenefitCheckout draft={draft} onChange={setDraft} disabled={disabled}/>}
test('local benefit form separates scheme documents and clears identity when scheme changes',async()=>{
 const user=userEvent.setup();render(<Form/>);expect(screen.queryByLabelText('Beneficiary name')).toBeNull()
 await user.selectOptions(screen.getByLabelText('Customer benefit'),'senior')
 await user.type(screen.getByLabelText('Beneficiary name'),'SYNTHETIC');await user.type(screen.getByLabelText('Beneficiary identification number'),'TEST-ID')
 expect(screen.getByText('Senior medicine purchase booklet is not required.')).toBeTruthy()
 expect(screen.queryByLabelText('PWD medicine booklet verified')).toBeNull()
 await user.selectOptions(screen.getByLabelText('Customer benefit'),'pwd')
 expect(screen.getByLabelText('Beneficiary name').value).toBe('');expect(screen.getByLabelText('Presented document').value).toBe('pwd_lgu')
 expect(screen.getByLabelText('PWD medicine booklet verified').checked).toBe(false)
 await user.selectOptions(screen.getByLabelText('Purchaser'),'guardian')
 expect(screen.getByLabelText('authorizationRef')).toBeTruthy()
})
test('saved checkout locks scheme and identity inputs',()=>{
 render(<Form disabled/>);expect(screen.getByLabelText('Customer benefit').closest('fieldset').disabled).toBe(true)
})
