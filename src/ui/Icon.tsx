type IconName = 'wallet' | 'history' | 'plus' | 'journey' | 'close' | 'check' | 'sun' | 'moon' | 'logout'

const paths: Record<IconName, string> = {
  close: 'm6 6 12 12M6 18 18 6',
  check: 'm5 12 4 4L19 6',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8m0-6v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5',
  moon: 'M20.5 13A8.5 8.5 0 0 1 11 3.5 8.5 8.5 0 1 0 20.5 13Z',
  logout: 'M9 4H4v16h5m5-12 4 4-4 4m-6-4h12',
  wallet: 'M20 8V6a2 2 0 0 0-2-2H6a3 3 0 0 0 0 6h14v10H6a3 3 0 0 1-3-3V7m17 6h-5v4h5m-3-2h.01',
  history: 'M3 11a9 9 0 1 1 2.6 7.4M3 4v7h7m2-4v5l3 2',
  plus: 'M12 5v14M5 12h14',
  journey: 'm4 17 5-12 4 8 7-6-5 13-5-7-6 4Z',
}

export function Icon({ name }: { name: IconName }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>
}
