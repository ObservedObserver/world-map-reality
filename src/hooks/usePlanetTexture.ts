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
}

export const usePlanetTexture = ({
  textureUrl,
  projection,
  radius,
  previewSize,
  solarSystemEnabled,
  loading,
  activeView,
}: UsePlanetTextureOptions) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const textureDataRef = useRef<TextureData | null>(null)

  const drawTexture = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    const context = canvas.getContext('2d')
    if (!context) {
      return
    }
    if (canvas.width !== previewSize || canvas.height !== previewSize) {
      canvas.width = previewSize
      canvas.height = previewSize
    }
    context.clearRect(0, 0, previewSize, previewSize)
    const radiusSquared = radius * radius
    const center = previewSize / 2
    const baseColor: [number, number, number] = [10, 18, 36]
    const texture = textureDataRef.current
    const imageData = context.createImageData(previewSize, previewSize)
    const output = imageData.data
    for (let y = 0; y < previewSize; y += 1) {
      for (let x = 0; x < previewSize; x += 1) {
        const dx = x - center
        const dy = y - center
        if (dx * dx + dy * dy > radiusSquared) {
          continue
        }
        const destIndex = (y * previewSize + x) * 4
        output[destIndex] = baseColor[0]
        output[destIndex + 1] = baseColor[1]
        output[destIndex + 2] = baseColor[2]
        output[destIndex + 3] = 255

        if (!texture) {
          continue
        }
        const lonLat = projection.invert?.([x, y])
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
    context.putImageData(imageData, 0, 0)
  }, [previewSize, projection, radius])

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
        drawTexture()
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
      drawTexture()
    }
    image.onerror = () => {
      if (cancelled) {
        return
      }
      textureDataRef.current = null
      drawTexture()
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

  return { planetCanvasRef: canvasRef }
}
