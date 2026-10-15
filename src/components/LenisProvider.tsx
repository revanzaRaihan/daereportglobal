'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Lenis from 'lenis'

export default function LenisProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  useEffect(() => {
    // 1. Never hijack scrolling on LMS Reader and zero-login student view routes
    if (pathname?.startsWith('/learn')) {
      return
    }

    // 2. Only use <main> as wrapper IF it actually has an explicit scrollable overflow
    const mainEl = document.querySelector('main')
    let scrollContainer: HTMLElement | undefined = undefined

    if (mainEl && mainEl instanceof HTMLElement) {
      const style = window.getComputedStyle(mainEl)
      if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
        scrollContainer = mainEl
      }
    }

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      ...(scrollContainer ? { wrapper: scrollContainer } : {})
    })

    let rafId: number

    function raf(time: number) {
      lenis.raf(time)
      rafId = requestAnimationFrame(raf)
    }

    rafId = requestAnimationFrame(raf)

    // Automatically detect and prevent Lenis from hijacking scrolls on textareas, inputs, and other scrollable containers
    const preventScrollHijack = (e: Event) => {
      const target = e.target
      if (!target || !(target instanceof Element)) return

      let curr: Element | null = target
      while (curr && curr !== document.body) {
        if (curr.hasAttribute('data-lenis-prevent')) {
          break
        }

        const tagName = curr.tagName.toUpperCase()
        if (tagName === 'TEXTAREA' || tagName === 'INPUT') {
          curr.setAttribute('data-lenis-prevent', '')
          break
        }

        // Quick check if the element has potential overflow scrolling
        if (curr.scrollHeight > curr.clientHeight || curr.scrollWidth > curr.clientWidth) {
          const style = window.getComputedStyle(curr)
          if (
            style.overflowY === 'auto' ||
            style.overflowY === 'scroll' ||
            style.overflowX === 'auto' ||
            style.overflowX === 'scroll'
          ) {
            curr.setAttribute('data-lenis-prevent', '')
            break
          }
        }

        curr = curr.parentElement
      }
    }

    window.addEventListener('wheel', preventScrollHijack, { capture: true, passive: true })
    window.addEventListener('touchstart', preventScrollHijack, { capture: true, passive: true })

    return () => {
      cancelAnimationFrame(rafId)
      lenis.destroy()
      window.removeEventListener('wheel', preventScrollHijack, { capture: true })
      window.removeEventListener('touchstart', preventScrollHijack, { capture: true })
    }
  }, [pathname])

  return <>{children}</>
}
