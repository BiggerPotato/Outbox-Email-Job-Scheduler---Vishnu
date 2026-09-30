'use client';

import { useEffect, useState } from 'react';

/**
 * Track whether the document is visible for polling control.
 */
export function usePageVisibility() {
  const [visible, setVisible] = useState(
    typeof document === 'undefined' ? true : document.visibilityState === 'visible'
  );

  useEffect(() => {
    const handleVisibility = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  return visible;
}
