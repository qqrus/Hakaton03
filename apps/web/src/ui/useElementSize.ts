import { useEffect, useState, type RefObject } from 'react'

export function useElementSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ w: 800, h: 500 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new ResizeObserver((entries) => {
      const e = entries[0]
      if (e) setSize({ w: e.contentRect.width, h: e.contentRect.height })
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [ref])
  return size
}
