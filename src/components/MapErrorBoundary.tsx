import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

type MapErrorBoundaryProps = {
  children: ReactNode
  fallback: ReactNode
}

type MapErrorBoundaryState = {
  hasError: boolean
}

// The MapLibre/WebGL views throw synchronously from their mount effect when a
// WebGL context cannot be created (headless renderers, WebGL-disabled browsers,
// and some of Google's rendering environments). Without a boundary that throw
// unmounts the whole React root, taking the page heading and SEO content with
// it. This boundary contains the failure so the surrounding content survives.
class MapErrorBoundary extends Component<
  MapErrorBoundaryProps,
  MapErrorBoundaryState
> {
  state: MapErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): MapErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Map view failed to render:', error, info)
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children
  }
}

export default MapErrorBoundary
