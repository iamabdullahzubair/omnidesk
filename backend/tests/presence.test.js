import { describe, it, expect } from 'vitest';
import { presenceRegistry } from '../src/sockets/presence.registry.js';

describe('In-Memory Presence Registry (Multi-Tab Support)', () => {
  it('correctly manages online and offline transitions across multiple browser tabs', () => {
    const userId = 'user-test-uuid-999';
    const tab1 = 'socket-tab-1';
    const tab2 = 'socket-tab-2';

    // Initial state: offline
    expect(presenceRegistry.isUserOnline(userId)).toBe(false);

    // Tab 1 connects -> user transitions to ONLINE
    const transitionedOnline = presenceRegistry.addSocket(userId, tab1);
    expect(transitionedOnline).toBe(true);
    expect(presenceRegistry.isUserOnline(userId)).toBe(true);
    expect(presenceRegistry.getSocketCount(userId)).toBe(1);

    // Tab 2 connects -> user remains ONLINE (transition should be false)
    const secondConnect = presenceRegistry.addSocket(userId, tab2);
    expect(secondConnect).toBe(false);
    expect(presenceRegistry.isUserOnline(userId)).toBe(true);
    expect(presenceRegistry.getSocketCount(userId)).toBe(2);

    // Tab 1 closes -> user should still be ONLINE because tab 2 is open
    const firstDisconnect = presenceRegistry.removeSocket(userId, tab1);
    expect(firstDisconnect).toBe(false); // Did not become offline yet
    expect(presenceRegistry.isUserOnline(userId)).toBe(true);
    expect(presenceRegistry.getSocketCount(userId)).toBe(1);

    // Tab 2 closes -> user transitions to OFFLINE
    const finalDisconnect = presenceRegistry.removeSocket(userId, tab2);
    expect(finalDisconnect).toBe(true); // Now became offline
    expect(presenceRegistry.isUserOnline(userId)).toBe(false);
    expect(presenceRegistry.getSocketCount(userId)).toBe(0);
  });
});
