import { useMemo } from 'react'
import { encode } from 'uqr'

/** QR code as crisp SVG; dark modules on a white tile so phones scan it in dark mode too. */
export function QrCode({ value, size = 168, className }) {
  const { path, n } = useMemo(() => {
    const { data } = encode(value, { border: 2 })
    let d = ''
    data.forEach((row, y) => row.forEach((on, x) => on && (d += `M${x} ${y}h1v1h-1z`)))
    return { path: d, n: data.length }
  }, [value])
  return (
    <svg viewBox={`0 0 ${n} ${n}`} width={size} height={size} className={className} role="img" aria-label={`QR code for ${value}`} shapeRendering="crispEdges">
      <rect width={n} height={n} fill="#fff" />
      <path d={path} fill="#09090b" />
    </svg>
  )
}
