'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function ChartComponent({ type = 'soc' }) {
  // Mock data - in production, fetch from backend
  const socData = [
    { time: '00:00', soc: 100 },
    { time: '02:00', soc: 92 },
    { time: '04:00', soc: 85 },
    { time: '06:00', soc: 78 },
    { time: '08:00', soc: 75 },
    { time: '10:00', soc: 68 },
    { time: '12:00', soc: 60 },
    { time: '14:00', soc: 55 },
    { time: '16:00', soc: 45 },
    { time: '18:00', soc: 35 },
  ]

  const tempData = [
    { time: '00:00', temp: 22 },
    { time: '02:00', temp: 23 },
    { time: '04:00', temp: 24 },
    { time: '06:00', temp: 26 },
    { time: '08:00', temp: 28 },
    { time: '10:00', temp: 30 },
    { time: '12:00', temp: 32 },
    { time: '14:00', temp: 31 },
    { time: '16:00', temp: 29 },
    { time: '18:00', temp: 27 },
  ]

  const data = type === 'soc' ? socData : tempData
  const dataKey = type === 'soc' ? 'soc' : 'temp'
  const stroke = type === 'soc' ? '#3b82f6' : '#f59e0b'
  const unit = type === 'soc' ? '%' : '°C'

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="time" stroke="#9ca3af" />
        <YAxis stroke="#9ca3af" label={{ value: unit, angle: -90, position: 'insideLeft' }} />
        <Tooltip 
          contentStyle={{
            backgroundColor: '#1f2937',
            border: '1px solid #374151',
            borderRadius: '8px'
          }}
          labelStyle={{ color: '#fff' }}
        />
        <Line 
          type="monotone" 
          dataKey={dataKey} 
          stroke={stroke} 
          dot={false}
          strokeWidth={2}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
