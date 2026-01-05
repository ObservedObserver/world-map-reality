import { useCallback, useEffect, useState } from 'react'
import type { RefObject } from 'react'

export const useFullscreenState = <T extends HTMLElement>(
  activeView: 'map' | 'globe',
  frameRef: RefObject<T>
) => {
  const [isFullscreen, setIsFullscreen] = useState(false)

  const toggleFullscreen = useCallback(() => {
    const frame = frameRef.current
    if (!frame) {
      return
    }
    if (document.fullscreenElement === frame) {
      document.exitFullscreen?.()
      return
    }
    frame.requestFullscreen?.()
  }, [frameRef])

  useEffect(() => {
    if (activeView !== 'globe') {
      if (document.fullscreenElement) {
        document.exitFullscreen?.()
      } else {
        setIsFullscreen(false)
      }
    }
  }, [activeView])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === frameRef.current)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [frameRef])

  return { isFullscreen, toggleFullscreen }
}
