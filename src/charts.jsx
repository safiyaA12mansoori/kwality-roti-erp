export function Spark({ values, color = '#16a34a' }) {
  const series = values.length ? values : [0]
  const max = Math.max(...series, 1)
  const min = Math.min(...series, 0)
  const width = 120
  const height = 38
  const points = series.map((value, index) => {
    const x = series.length === 1 ? width : (index / (series.length - 1)) * width
    const y = height - 3 - ((value - min) / (max - min || 1)) * (height - 8)
    return `${x},${y}`
  }).join(' ')
  const last = series[series.length - 1]
  const lastX = width
  const lastY = height - 3 - ((last - min) / (max - min || 1)) * (height - 8)
  return (
    <svg className="spark" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" points={points} />
      <circle cx={lastX} cy={lastY} r="3" fill={color} />
    </svg>
  )
}

export function Donut({ slices }) {
  const total = slices.reduce((sum, slice) => sum + (Number(slice.value) || 0), 0)
  const safe = total > 0 ? total : 1
  let angle = 0
  const stops = slices.map((slice) => {
    const start = angle
    angle += ((Number(slice.value) || 0) / safe) * 100
    return `${slice.color} ${start}% ${angle}%`
  }).join(', ')
  return (
    <div className="donut-wrap">
      <div className="donut" style={{ background: `conic-gradient(${stops || '#eef2f7 0 100%'})` }}>
        <div className="donut-hole" />
      </div>
      <ul className="donut-legend">
        {slices.map((slice) => {
          const pct = total ? ((slice.value / total) * 100) : 0
          return (
            <li key={slice.label}>
              <span className="swatch" style={{ background: slice.color }} />
              <div>
                <strong>{slice.label}</strong>
                <em>{new Intl.NumberFormat('en-IN').format(Math.round(slice.value))} ({pct.toFixed(2)}%)</em>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function BarChart({ series, labels }) {
  const width = 640
  const height = 260
  const pad = { left: 48, right: 16, top: 22, bottom: 36 }
  const all = series.flatMap((item) => item.values)
  const max = Math.max(...all, 1)
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const groups = Math.max(labels.length, 1)
  const groupW = innerW / groups
  const barGap = 3
  const barW = Math.max(4, (groupW - 16 - barGap * (series.length - 1)) / series.length)
  const grid = [0, 0.25, 0.5, 0.75, 1]
  return (
    <svg className="bar-chart" viewBox={`0 0 ${width} ${height}`} role="img">
      {grid.map((step) => {
        const gy = pad.top + innerH - step * innerH
        return (
          <g key={step}>
            <line x1={pad.left} x2={width - pad.right} y1={gy} y2={gy} stroke="#edf1f6" />
            <text x={8} y={gy + 4} fill="#8b97a8" fontSize="11">{new Intl.NumberFormat('en-IN', { notation: 'compact' }).format(max * step)}</text>
          </g>
        )
      })}
      {labels.map((label, groupIndex) => {
        const groupX = pad.left + groupIndex * groupW + 8
        return (
          <g key={label}>
            {series.map((item, seriesIndex) => {
              const value = Number(item.values[groupIndex]) || 0
              const h = (value / max) * innerH
              const x = groupX + seriesIndex * (barW + barGap)
              const y = pad.top + innerH - h
              return <rect key={item.label} x={x} y={y} width={barW} height={Math.max(h, value > 0 ? 2 : 0)} rx="2" fill={item.color} />
            })}
            <text x={groupX + (series.length * (barW + barGap) - barGap) / 2} y={height - 10} textAnchor="middle" fill="#8b97a8" fontSize="12">{label}</text>
          </g>
        )
      })}
    </svg>
  )
}
