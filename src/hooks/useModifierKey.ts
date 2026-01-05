import { useEffect, useState } from 'react'

export const useModifierKey = (
  active: boolean,
  onClear?: () => void
) => {
  const [pressed, setPressed] = useState(false)

  useEffect(() => {
    if (!active) {
      setPressed(false)
      return
    }

    const clearModifier = () => {
      setPressed(false)
      onClear?.()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Meta' || event.key === 'Control') {
        setPressed(true)
      }
    }
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Meta' || event.key === 'Control') {
        clearModifier()
      }
    }
    const handleBlur = () => {
      clearModifier()
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)
    document.addEventListener('visibilitychange', handleBlur)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
      document.removeEventListener('visibilitychange', handleBlur)
    }
  }, [active, onClear])

  return pressed
}
