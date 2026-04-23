'use client'

export default function StatCard({ 
  title, 
  value, 
  unit, 
  icon, 
  status = 'info', 
  subtext,
  trend 
}) {
  const statusColors = {
    safe: 'border-green-500 bg-green-500/10',
    warning: 'border-yellow-500 bg-yellow-500/10',
    critical: 'border-red-500 bg-red-500/10',
    info: 'border-blue-500 bg-blue-500/10',
  }

  const statusTextColors = {
    safe: 'text-green-400',
    warning: 'text-yellow-400',
    critical: 'text-red-400',
    info: 'text-blue-400',
  }

  return (
    <div className={`card border-2 ${statusColors[status]}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-gray-400 text-sm mb-2">{title}</p>
          <div className="flex items-baseline gap-2">
            <p className={`text-3xl font-bold ${statusTextColors[status]}`}>
              {value}
            </p>
            {unit && <p className="text-xl text-gray-400">{unit}</p>}
          </div>
          {subtext && <p className="text-gray-500 text-sm mt-1">{subtext}</p>}
          {trend && (
            <p className={`text-sm mt-2 ${trend > 0 ? 'text-red-400' : 'text-green-400'}`}>
              {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}% vs last hour
            </p>
          )}
        </div>
        <div className="text-4xl opacity-50">{icon}</div>
      </div>
    </div>
  )
}
