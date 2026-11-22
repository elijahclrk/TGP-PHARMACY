import { expect, test } from 'vitest'
import { formatPHP } from './money'
import { receivingSummary } from '../purchasing/receiving-summary'

test('PHP display rounds exact decimals consistently without losing large-value precision', () => {
  expect(formatPHP('9007199254740993.005')).toBe('PHP 9,007,199,254,740,993.01')
  expect(formatPHP('1234.5')).toBe('PHP 1,234.50')
  expect(formatPHP('1.0049')).toBe('PHP 1.00')
  expect(formatPHP('-1.005')).toBe('PHP -1.01')
  expect(formatPHP('-0.001')).toBe('PHP 0.00')
  for (const input of [null, undefined, '', '1e3', 'not money']) expect(formatPHP(input)).toBe('Unavailable')
})
test('receiving preview multiplies unrounded unit costs before display and recalculates line removal', () => {
  const lines = [{ quantity: '3', cost_price: '0.335' }, { quantity: '2', cost_price: '1.0001' }]
  expect(receivingSummary(lines)).toEqual({ units: '5', cost: '3.0052' })
  expect(formatPHP(receivingSummary(lines).cost)).toBe('PHP 3.01')
  expect(receivingSummary(lines.slice(0, 1))).toEqual({ units: '3', cost: '1.005' })
  expect(receivingSummary([{quantity:2,unit_cost:'9007199254740993.01'}])).toEqual({units:'2',cost:'18014398509481986.02'})
})
test('incomplete or invalid receiving inputs never masquerade as zero cost or valid stock', () => {
  for (const quantity of ['', '0', '-1', '1.5', '2147483648']) expect(receivingSummary([{ quantity, cost_price: '1' }])).toEqual({ units: null, cost: null })
  for (const cost_price of ['', '-1', 'abc']) expect(receivingSummary([{ quantity: '2', cost_price }])).toEqual({ units: '2', cost: null })
  expect(receivingSummary([])).toEqual({ units: null, cost: null })
})
