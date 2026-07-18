import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// A mutable holder the io() mock returns, swapped fresh per test. vi.hoisted so the (hoisted)
// vi.mock factory can reference it.
const h = vi.hoisted(() => ({ current: null }));

const makeFakeSocket = () => ({
  id: 'sock-' + Math.random().toString(36).slice(2, 6),
  connected: false,
  active: false,
  on: vi.fn(),
  connect: vi.fn(function () { this.connected = true; }),
  disconnect: vi.fn(function () { this.connected = false; }),
});

vi.mock('socket.io-client', () => ({
  // io() auto-connects (autoConnect default true) → mark connected, like the real client.
  io: vi.fn(() => { h.current.connected = true; return h.current; }),
}));
vi.mock('./api', () => ({ ensureFreshToken: vi.fn(() => Promise.resolve('tok')) }));
vi.mock('./session', () => ({
  lookInSession: vi.fn(() => JSON.stringify({ access_token: 'tok', refresh_token: 'r' })),
}));

// Imported once → the visibility/online listeners register a single time on jsdom's document/window.
import { getSocket, disconnectSocket, connectSocketToQueryCache } from './socket';

const setVisibility = (state) => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => state === 'hidden' });
  document.dispatchEvent(new Event('visibilitychange'));
};

const GRACE = 60_000;

describe('socket tab-visibility power saver', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    h.current = makeFakeSocket();
    setVisibility('visible');
  });

  afterEach(() => {
    disconnectSocket();       // null the module socket so the next test starts clean
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('closes the socket after the grace period once hidden, and reopens + refetches on return', () => {
    const qc = { invalidateQueries: vi.fn() };
    const socket = getSocket();
    connectSocketToQueryCache(socket, qc);
    expect(socket.connected).toBe(true);

    setVisibility('hidden');
    // Not closed immediately — rides out quick tab-switches.
    vi.advanceTimersByTime(GRACE - 1);
    expect(socket.disconnect).not.toHaveBeenCalled();

    // Grace elapsed while still hidden → idle-close.
    vi.advanceTimersByTime(1);
    expect(socket.disconnect).toHaveBeenCalledTimes(1);
    expect(socket.connected).toBe(false);

    // Back to foreground → reconnect + catch-up refetch of the live badges.
    setVisibility('visible');
    expect(socket.connect).toHaveBeenCalledTimes(1);
    expect(socket.connected).toBe(true);
    expect(qc.invalidateQueries).toHaveBeenCalled();
  });

  it('does NOT close on a quick hide→show within the grace window (no churn)', () => {
    const socket = getSocket();

    setVisibility('hidden');
    vi.advanceTimersByTime(GRACE / 2);
    setVisibility('visible');              // returned before the grace elapsed
    vi.advanceTimersByTime(GRACE);         // the pending timer must have been cancelled

    expect(socket.disconnect).not.toHaveBeenCalled();
    expect(socket.connect).not.toHaveBeenCalled(); // nothing to resume — was never closed
  });

  it('stays closed while hidden — an online event must not silently reopen a backgrounded tab', () => {
    const socket = getSocket();

    setVisibility('hidden');
    vi.advanceTimersByTime(GRACE);
    expect(socket.disconnect).toHaveBeenCalledTimes(1);

    socket.connect.mockClear();
    window.dispatchEvent(new Event('online')); // network blip while backgrounded
    expect(socket.connect).not.toHaveBeenCalled(); // suppressed until the tab is shown again
  });
});
