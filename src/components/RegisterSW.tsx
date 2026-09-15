'use client'

import { useEffect } from 'react'

export function RegisterSW() {
  useEffect(() => {
    // navigator.serviceWorker is only exposed in secure contexts
    // (https or localhost); on LAN http this silently no-ops.
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])
  return null
}
