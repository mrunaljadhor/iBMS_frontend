'use client'

import { useState, useEffect } from 'react'
import StatCard from './StatCard'
import ChartComponent from './ChartComponent'

export default function Dashboard() {
  const [stats, setStats] = useState({
    soc: 75,
    dte_eco: 450,
    dte_sport: 280,
    temperature: 28,
    voltage: 61.5,
    current: -2.5,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
    const interval = setInterval(fetchDashboardData, 10000) // Every 10s
    return () => clearInterval(interval)
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      
      // Fetch sample predictions
      const socRes = await fetch('/api/predict/sample')
      const socData = await socRes.json()
      
      // Fetch DTE for both modes
      const dteEcoRes = await fetch('/api/predict/dte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_soc: socData.SOC || 75, drive_mode: 'ECO' })
      })
      const dteEcoData = await dteEcoRes.json()
      
      const dteSportRes = await fetch('/api/predict/dte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_soc: socData.SOC || 75, drive_mode: 'SPORT' })
      })
      const dteSportData = await dteSportRes.json()
      
      setStats({
        soc: socData.SOC || 75,
        dte_eco: parseFloat(dteEcoData.estimated_range_km) || 450,
        dte_sport: parseFloat(dteSportData.estimated_range_km) || 280,
        temperature: socData.temperature || 28,
        voltage: socData.voltage || 61.5,
        current: socData.current || -2.5,
      })
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Main Stats Grid */}
      <div className="grid-auto">
        <StatCard 
          title="State of Charge"
          value={`${stats.soc.toFixed(1)}%`}
          unit=""
          icon="🔋"
          status={stats.soc > 50 ? 'safe' : stats.soc > 20 ? 'warning' : 'critical'}
          subtext={`${(stats.soc / 100 * 60).toFixed(1)}Ah / 60Ah`}
        />
        
        <StatCard 
          title="ECO Mode Range"
          value={`${stats.dte_eco.toFixed(0)}`}
          unit="km"
          icon="🌱"
          status="info"
          subtext="Estimated distance to empty"
        />
        
        <StatCard 
          title="SPORT Mode Range"
          value={`${stats.dte_sport.toFixed(0)}`}
          unit="km"
          icon="🏎️"
          status="info"
          subtext="Estimated distance to empty"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid-auto">
        <StatCard 
          title="Temperature"
          value={`${stats.temperature.toFixed(1)}`}
          unit="°C"
          icon="🌡️"
          status={stats.temperature < 35 ? 'safe' : 'warning'}
        />
        
        <StatCard 
          title="Voltage"
          value={`${stats.voltage.toFixed(1)}`}
          unit="V"
          icon="⚡"
          status="info"
        />
        
        <StatCard 
          title="Current"
          value={`${Math.abs(stats.current).toFixed(2)}`}
          unit="A"
          icon="→"
          status={Math.abs(stats.current) < 5 ? 'safe' : 'warning'}
          subtext={stats.current < 0 ? 'Discharging' : 'Charging'}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">SOC History</h3>
          <ChartComponent type="soc" />
        </div>
        
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Temperature Trend</h3>
          <ChartComponent type="temperature" />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <button className="btn-primary">📍 Plan Route</button>
          <button className="btn-secondary">📊 View History</button>
          <button className="btn-secondary">⚙️ Settings</button>
          <button className="btn-secondary">📄 Export Data</button>
        </div>
      </div>

      {/* System Info */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">System Information</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-400">Battery Type</p>
            <p className="text-white font-semibold">LiFePO4</p>
          </div>
          <div>
            <p className="text-gray-400">Capacity</p>
            <p className="text-white font-semibold">60 Ah</p>
          </div>
          <div>
            <p className="text-gray-400">Voltage</p>
            <p className="text-white font-semibold">63.5 V</p>
          </div>
          <div>
            <p className="text-gray-400">Last Update</p>
            <p className="text-white font-semibold">{new Date().toLocaleTimeString()}</p>
          </div>
        </div>
      </div>

      {loading && <div className="text-center text-gray-400">Loading latest data...</div>}
    </div>
  )
}
