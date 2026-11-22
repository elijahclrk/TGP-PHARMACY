// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProductImage from './ProductImage'
import { requestJson } from '../auth/api'

vi.mock('../auth/api', () => ({ requestJson: vi.fn() }))
afterEach(() => { cleanup(); vi.resetAllMocks() })
const product = { product_id: 1, name: 'Test medicine' }
const image = { public_id: 'fixture-id', url: 'https://res.cloudinary.com/test/image.jpg' }
const reply = (current = null, extra = {}) => ({ data: { enabled: true, image: current, ...extra } })

test('employee views images and broken-image fallback without mutation controls', async () => {
  requestJson.mockResolvedValue(reply(image))
  render(<ProductImage product={product} canManage={false} />)
  const img = await screen.findByAltText('Test medicine package')
  expect(img.getAttribute('src')).toBe(image.url)
  expect(screen.queryByLabelText(/Upload image|Replace image/)).toBeNull()
  expect(screen.queryByRole('button', { name: /Remove/ })).toBeNull()
  fireEvent.error(img)
  expect(screen.getByText('No image available')).toBeTruthy()
})
test('manager uploads multipart file, replaces and removes current reference', async () => {
  requestJson.mockResolvedValueOnce(reply()).mockResolvedValueOnce(reply(image)).mockResolvedValueOnce(reply())
  const user = userEvent.setup()
  render(<ProductImage product={product} canManage />)
  const input = await screen.findByLabelText('Upload image for Test medicine')
  await user.upload(input, new File(['fixture'], 'package.png', { type: 'image/png' }))
  await screen.findByLabelText('Replace image for Test medicine')
  const options = requestJson.mock.calls[1][1]
  expect(options.method).toBe('PUT')
  expect(options.body).toBeInstanceOf(FormData)
  expect(options.body.get('expected_image')).toBe('')
  expect(options.body.get('image').name).toBe('package.png')
  await user.click(screen.getByRole('button', { name: 'Remove image for Test medicine' }))
  await screen.findByLabelText('Upload image for Test medicine')
  expect(requestJson.mock.calls[2][1]).toEqual({ method: 'DELETE', body: JSON.stringify({ expected_image: image.public_id }) })
})
test('invalid upload is blocked locally and status reload restores safe controls', async () => {
  requestJson.mockResolvedValue(reply())
  render(<ProductImage product={product} canManage />)
  const input = await screen.findByLabelText('Upload image for Test medicine')
  fireEvent.change(input, { target: { files: [new File(['bad'], 'bad.svg', { type: 'image/svg+xml' })] } })
  expect((await screen.findByRole('alert')).textContent).toContain('JPEG/PNG')
  expect(requestJson).toHaveBeenCalledTimes(1)
  await userEvent.click(screen.getByRole('button', { name: 'Reload image status' }))
  await screen.findByLabelText('Upload image for Test medicine')
})
test('uncertain mutation requires status reload; cleanup warning is visible', async () => {
  requestJson.mockResolvedValueOnce(reply(image)).mockRejectedValueOnce(Object.assign(Error(), { status: 503 }))
    .mockResolvedValueOnce(reply(image)).mockResolvedValueOnce(reply(null, { cleanup_pending: true }))
  render(<ProductImage product={product} canManage />)
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Remove image for Test medicine' }))
  expect((await screen.findByRole('alert')).textContent).toContain('uncertain')
  expect(screen.queryByRole('button', { name: /Remove image/ })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Reload image status' }))
  await user.click(await screen.findByRole('button', { name: 'Remove image for Test medicine' }))
  expect((await screen.findByRole('status')).textContent).toContain('administrator follow-up')
})
test('disabled or failed images do not expose management actions', async () => {
  requestJson.mockResolvedValueOnce({ data: { enabled: false, image: null } }).mockRejectedValueOnce(Error('network'))
  render(<ProductImage product={product} canManage />)
  await waitFor(() => expect(screen.getByText('Images unavailable')).toBeTruthy())
  expect(screen.queryByLabelText(/Upload image/)).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: 'Reload image status' }))
  expect((await screen.findByRole('alert')).textContent).toContain('Product and stock functions remain available')
})
