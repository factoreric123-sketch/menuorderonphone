import { useRef, useCallback, useEffect } from 'react';

/**
 * Plays a short alert tone and shows a browser notification when new orders arrive.
 * Uses Web Audio API — no external sound files needed.
 */
export function useNewOrderAlert() {
  const lastPlayed = useRef(0);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const playAlert = useCallback((orderInfo?: { guestName?: string; tableName?: string }) => {
    // Throttle to 1 alert per 3 seconds
    const now = Date.now();
    if (now - lastPlayed.current < 3000) return;
    lastPlayed.current = now;

    // Browser notification
    if ('Notification' in window && Notification.permission === 'granted') {
      const body = orderInfo?.tableName
        ? `${orderInfo.guestName || 'Guest'} · ${orderInfo.tableName}`
        : orderInfo?.guestName || 'A new order just came in';
      new Notification('🔔 New Order', { body, icon: '/favicon.png', tag: 'new-order' });
    }

    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1); // C#6
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.2);

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);

      // Cleanup
      osc.onended = () => ctx.close();
    } catch {
      // Silently fail if audio not available
    }
  }, []);

  return { playAlert };
}
