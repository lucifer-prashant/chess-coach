'use client';

import { useEffect } from 'react';
import { useGame } from '@/lib/store';

export default function StoreHydrator() {
  const hydrateSettings = useGame((s) => s.hydrateSettings);

  useEffect(() => {
    hydrateSettings();
  }, [hydrateSettings]);

  return null;
}
