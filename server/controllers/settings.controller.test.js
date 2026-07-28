import { describe, it, expect, vi, beforeEach } from 'vitest'
import bcrypt from 'bcrypt'

vi.mock('../Schema/User.js', () => ({
  default: { findById: vi.fn(), findByIdAndUpdate: vi.fn() },
}))

import User from '../Schema/User.js'
import { deleteAccount, deactivateAccount } from './settings.controller.js'

// Mirrors the real schema: the hash lives at personal_info.password with select:false,
// so it only materializes when the query explicitly selects '+personal_info.password'.
const userDoc = (hash, { google_auth = false } = {}) => ({
  _id: 'u1',
  google_auth,
  personal_info: hash === undefined ? {} : { password: hash },
  account_status: { status: 'active' },
})

// findById(...).select(path) → resolves the doc ONLY if the correct path was selected.
const mockFindById = (hash, opts) => {
  User.findById.mockReturnValue({
    select: vi.fn((path) =>
      Promise.resolve(
        path === '+personal_info.password' ? userDoc(hash, opts) : userDoc(undefined, opts),
      ),
    ),
  })
}

const mockRes = () => {
  const res = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  res.clearCookie = vi.fn(() => res)
  return res
}

// The $set payload handed to User.findByIdAndUpdate on the most recent call.
const lastSet = () => User.findByIdAndUpdate.mock.calls.at(-1)[1].$set
const lastUnset = () => User.findByIdAndUpdate.mock.calls.at(-1)[1].$unset

describe('deleteAccount password verification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    User.findByIdAndUpdate.mockResolvedValue({})
  })

  it('accepts the correct password for a local account (the regression: this used to 500)', async () => {
    const hash = await bcrypt.hash('CorrectHorse1', 10)
    mockFindById(hash)
    const res = mockRes()

    await deleteAccount({ user: 'u1', body: { password: 'CorrectHorse1', reason: 'bye' } }, res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json.mock.calls[0][0]).toMatchObject({ deleted: true })
    expect(User.findByIdAndUpdate).toHaveBeenCalled()
  })

  it('selects the correct schema path', async () => {
    const hash = await bcrypt.hash('CorrectHorse1', 10)
    mockFindById(hash)
    const selectSpy = User.findById().select
    await deleteAccount({ user: 'u1', body: { password: 'CorrectHorse1' } }, mockRes())
    expect(selectSpy).toHaveBeenCalledWith('+personal_info.password')
  })

  it('rejects a wrong password with 403, not 500', async () => {
    const hash = await bcrypt.hash('CorrectHorse1', 10)
    mockFindById(hash)
    const res = mockRes()

    await deleteAccount({ user: 'u1', body: { password: 'wrong' } }, res)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(User.findByIdAndUpdate).not.toHaveBeenCalled()
  })

  it('returns 403 (not 500) when a local account somehow has no stored hash', async () => {
    mockFindById(undefined)
    const res = mockRes()

    await deleteAccount({ user: 'u1', body: { password: 'anything' } }, res)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(User.findByIdAndUpdate).not.toHaveBeenCalled()
  })

  it('requires a password for local accounts', async () => {
    const hash = await bcrypt.hash('CorrectHorse1', 10)
    mockFindById(hash)
    const res = mockRes()

    await deleteAccount({ user: 'u1', body: {} }, res)

    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('skips the password check entirely for Google accounts', async () => {
    mockFindById(undefined, { google_auth: true })
    const res = mockRes()

    await deleteAccount({ user: 'u1', body: {} }, res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(User.findByIdAndUpdate).toHaveBeenCalled()
  })
})

describe('session revocation on deactivate / delete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    User.findByIdAndUpdate.mockResolvedValue({})
  })

  it('deactivateAccount clears ALL refresh_sessions, not just the legacy field', async () => {
    User.findById.mockResolvedValue({ _id: 'u1', account_status: { status: 'active' } })
    const res = mockRes()

    await deactivateAccount({ user: 'u1' }, res)

    expect(res.status).toHaveBeenCalledWith(200)
    // The regression: clearing only `refreshToken` left every per-device session alive.
    expect(lastSet()).toHaveProperty('refresh_sessions')
    expect(lastSet().refresh_sessions).toEqual([])
    expect(lastUnset()).toEqual({ refreshToken: 1 })
  })

  it('deactivateAccount clears the httpOnly refresh cookie', async () => {
    User.findById.mockResolvedValue({ _id: 'u1', account_status: { status: 'active' } })
    const res = mockRes()

    await deactivateAccount({ user: 'u1' }, res)

    expect(res.clearCookie).toHaveBeenCalledWith(
      'refresh_token',
      expect.objectContaining({ httpOnly: true, path: '/api/v1', sameSite: 'lax' }),
    )
  })

  it('deactivateAccount still refuses an account already marked for deletion', async () => {
    User.findById.mockResolvedValue({ _id: 'u1', account_status: { status: 'deleted' } })
    const res = mockRes()

    await deactivateAccount({ user: 'u1' }, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(User.findByIdAndUpdate).not.toHaveBeenCalled()
  })

  it('deleteAccount clears ALL refresh_sessions and the cookie', async () => {
    const hash = await bcrypt.hash('CorrectHorse1', 10)
    mockFindById(hash)
    const res = mockRes()

    await deleteAccount({ user: 'u1', body: { password: 'CorrectHorse1' } }, res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(lastSet().refresh_sessions).toEqual([])
    expect(lastUnset()).toEqual({ refreshToken: 1 })
    expect(res.clearCookie).toHaveBeenCalledWith('refresh_token', expect.any(Object))
  })

  it('deleteAccount does NOT revoke anything when the password is wrong', async () => {
    const hash = await bcrypt.hash('CorrectHorse1', 10)
    mockFindById(hash)
    const res = mockRes()

    await deleteAccount({ user: 'u1', body: { password: 'wrong' } }, res)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(User.findByIdAndUpdate).not.toHaveBeenCalled()
    expect(res.clearCookie).not.toHaveBeenCalled()
  })

  it('deleteAccount preserves the 30-day grace window alongside revocation', async () => {
    mockFindById(undefined, { google_auth: true })
    const res = mockRes()

    await deleteAccount({ user: 'u1', body: {} }, res)

    const set = lastSet()
    expect(set['account_status.status']).toBe('deleted')
    const days = (set['account_status.deletion_scheduled_at'] - Date.now()) / 86400000
    expect(days).toBeGreaterThan(29.9)
    expect(days).toBeLessThan(30.1)
    // Revoking sessions must not block the documented "sign back in to cancel" flow —
    // signin does not inspect account_status and mints a brand-new session.
    expect(set.refresh_sessions).toEqual([])
  })
})
