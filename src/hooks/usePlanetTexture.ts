import { useCallback, useEffect, useRef } from 'react'
import type { GeoProjection } from 'd3-geo'

type TextureData = {
  data: Uint8ClampedArray
  width: number
  height: number
}

type UsePlanetTextureOptions = {
  textureUrl: string | null
  projection: GeoProjection
  radius: number
  previewSize: number
  solarSystemEnabled: boolean
  loading: boolean
  activeView: 'map' | 'globe'
  isDragging: boolean
}

export const usePlanetTexture = ({
  textureUrl,
  projection,
  radius,
  previewSize,
  solarSystemEnabled,
  loading,
  activeView,
  isDragging,
}: UsePlanetTextureOptions) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const textureDataRef = useRef<TextureData | null>(null)
  const imageDataRef = useRef<{ imageData: ImageData; size: number } | null>(
    null
  )
  const lastDrawRef = useRef(0)

  const drawTexture = useCallback((force = false) => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    const context = canvas.getContext('2d')
    if (!context) {
      return
    }
    const rect = canvas.getBoundingClientRect()
    const cssSize = Math.min(rect.width, rect.height)
    if (!cssSize) {
      return
    }
    const now =
      typeof performance !== 'undefined' ? performance.now() : Date.now()
    if (isDragging && !force && now - lastDrawRef.current < 90) {
      return
    }
    lastDrawRef.current = now
    const devicePixelRatio = window.devicePixelRatio || 1
    const qualityScale = isDragging ? 0.4 : 1
    const pixelSize = Math.max(
      1,
      Math.round(cssSize * devicePixelRatio * qualityScale)
    )
    if (canvas.width !== pixelSize || canvas.height !== pixelSize) {
      canvas.width = pixelSize
      canvas.height = pixelSize
    }
    const scaleFactor = pixelSize / cssSize
    const scale = previewSize / cssSize
    const radiusCss = (radius / previewSize) * cssSize
    const radiusSquared = radiusCss * radiusCss
    const centerCss = cssSize / 2
    const baseColor: [number, number, number] = [10, 18, 36]
    const texture = textureDataRef.current
    const invert = projection.invert
    let imageDataEntry = imageDataRef.current
    if (!imageDataEntry || imageDataEntry.size !== pixelSize) {
      imageDataEntry = {
        imageData: context.createImageData(pixelSize, pixelSize),
        size: pixelSize,
      }
      imageDataRef.current = imageDataEntry
    }
    const output = imageDataEntry.imageData.data
    const point: [number, number] = [0, 0]
    for (let y = 0; y < pixelSize; y += 1) {
      const cssY = y / scaleFactor
      const dy = cssY - centerCss
      for (let x = 0; x < pixelSize; x += 1) {
        const cssX = x / scaleFactor
        const dx = cssX - centerCss
        const destIndex = (y * pixelSize + x) * 4
        if (dx * dx + dy * dy > radiusSquared) {
          output[destIndex] = 0
          output[destIndex + 1] = 0
          output[destIndex + 2] = 0
          output[destIndex + 3] = 0
          continue
        }
        output[destIndex] = baseColor[0]
        output[destIndex + 1] = baseColor[1]
        output[destIndex + 2] = baseColor[2]
        output[destIndex + 3] = 255

        if (!texture || !invert) {
          continue
        }
        point[0] = cssX * scale
        point[1] = cssY * scale
        const lonLat = invert(point)
        if (!lonLat) {
          continue
        }
        const { data, width, height } = texture
        const [lon, lat] = lonLat
        const u = (lon + 180) / 360
        const v = (90 - lat) / 180
        const srcX = Math.min(width - 1, Math.max(0, Math.floor(u * width)))
        const srcY = Math.min(height - 1, Math.max(0, Math.floor(v * height)))
        const srcIndex = (srcY * width + srcX) * 4
        output[destIndex] = data[srcIndex]
        output[destIndex + 1] = data[srcIndex + 1]
        output[destIndex + 2] = data[srcIndex + 2]
      }
    }
    context.putImageData(imageDataEntry.imageData, 0, 0)
  }, [previewSize, projection, radius, isDragging])

  useEffect(() => {
    if (!textureUrl) {
      textureDataRef.current = null
      drawTexture()
      return
    }
    let cancelled = false
    const image = new Image()
    image.decoding = 'async'
    image.src = textureUrl
    image.onload = () => {
      if (cancelled) {
        return
      }
      const offscreen = document.createElement('canvas')
      offscreen.width = image.naturalWidth
      offscreen.height = image.naturalHeight
      const ctx = offscreen.getContext('2d')
      if (!ctx) {
        textureDataRef.current = null
        drawTexture(true)
        return
      }
      ctx.drawImage(image, 0, 0)
      const textureData = ctx.getImageData(
        0,
        0,
        offscreen.width,
        offscreen.height
      )
      textureDataRef.current = {
        data: textureData.data,
        width: offscreen.width,
        height: offscreen.height,
      }
      drawTexture(true)
    }
    image.onerror = () => {
      if (cancelled) {
        return
      }
      textureDataRef.current = null
      drawTexture(true)
    }
    return () => {
      cancelled = true
    }
  }, [textureUrl, drawTexture])

  useEffect(() => {
    if (!solarSystemEnabled || loading) {
      return
    }
    drawTexture()
  }, [solarSystemEnabled, loading, projection, radius, drawTexture])

  useEffect(() => {
    if (activeView !== 'globe' || !solarSystemEnabled || loading) {
      return
    }
    drawTexture()
  }, [activeView, solarSystemEnabled, loading, drawTexture])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || typeof ResizeObserver === 'undefined') {
      return
    }
    let frame = 0
    const observer = new ResizeObserver(() => {
      if (!solarSystemEnabled || loading) {
        return
      }
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => drawTexture())
    })
    observer.observe(canvas)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [activeView, drawTexture, solarSystemEnabled, loading])

  useEffect(() => {
    if (!isDragging) {
      drawTexture(true)
    }
  }, [isDragging, drawTexture])

  return { planetCanvasRef: canvasRef }
}
