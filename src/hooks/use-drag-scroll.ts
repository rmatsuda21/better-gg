import { useEffect, type RefObject } from 'react'
import { THRESHOLDS } from '../lib/constants'

const DRAG_THRESHOLD = THRESHOLDS.DRAG_PX

export function useDragScroll(ref: RefObject<HTMLDivElement | null>): void {
  useEffect(() => {
    const container = ref.current
    if (!container) return

    // Only enable on devices with a precise pointer (mouse)
    if (!window.matchMedia('(pointer: fine)').matches) return

    let isPending = false
    let isDragging = false
    let startX = 0
    let startY = 0
    let startScrollLeft = 0
    let startScrollTop = 0

    container.style.cursor = 'grab'

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return

      // Don't initiate drag on interactive elements
      const target = e.target as HTMLElement
      if (target.closest('a, button, [role="button"]')) return

      isPending = true
      isDragging = false
      startX = e.clientX
      startY = e.clientY
      startScrollLeft = container.scrollLeft
      startScrollTop = container.scrollTop
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!isPending && !isDragging) return

      const dx = e.clientX - startX
      const dy = e.clientY - startY

      if (isPending) {
        // Check if we've moved past the threshold
        if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return
        isPending = false
        isDragging = true
        container.style.cursor = 'grabbing'
      }

      container.scrollLeft = startScrollLeft - dx
      container.scrollTop = startScrollTop - dy
    }

    const handleMouseUp = () => {
      const wasDragging = isDragging
      isPending = false
      isDragging = false
      container.style.cursor = 'grab'

      // Suppress the click event that follows mouseup after a drag
      if (wasDragging) {
        const suppressClick = (e: MouseEvent) => {
          e.stopPropagation()
          e.preventDefault()
        }
        container.addEventListener('click', suppressClick, { capture: true, once: true })
      }
    }

    container.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      container.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      container.style.cursor = ''
    }
  }, [ref])
}
