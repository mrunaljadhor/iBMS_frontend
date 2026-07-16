'use client'

import { useState, useEffect } from 'react'
import StatCard from './StatCard'

export default function BatteryStatus() {
  const [batteryData, setBatteryData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchBatteryData()
  }, [])

  const fetchBatteryData = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/predict/sample')
      const data = await res.json()
      setBatteryData(data)
    } catch (error) {
      console.error('Failed to fetch battery data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center text-gray-400">Loading battery data...</div>
  }

  const soc = batteryData?.SOC || 75

  return (
    <div className="space-y-8">
      {/* SOC Gauge */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-6">State of Charge Gauge</h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-gray-400">Current: {soc.toFixed(1)}%</span>
            <span className="text-gray-400">Full</span>
          </div>

          {/* Visual gauge */}
          <div className="relative h-8 bg-gray-700 rounded-full overflow-hidden border-2 border-gray-600">
            <div  
              className={`h-full transition-all duration-500 flex items-center justify-end pr-4 ${
                soc > 50 ? 'bg-gradient-to-r from-green-600 to-green-400' :
                soc > 20 ? 'bg-gradient-to-r from-yellow-600 to-yellow-400' :
                'bg-gradient-to-r from-red-600 to-red-400'
              }`}
              style={{ width: `${soc}%` }}
            >
              {soc > 10 && <span className="text-white font-bold text-sm">{soc.toFixed(0)}%</span>}
            </div>
          </div>

          <div className="flex items-center justify-between text-sm text-gray-400">
            <span>Empty (0%)</span>
            <span>Full (100%)</span>
          </div>
        </div>
      </div>

      {/* Battery Metrics Grid */}
      <div className="grid-auto">
        <StatCard
          title="Available Capacity"
          value={(soc / 100 * 60).toFixed(1)}
          unit="Ah"
          icon="🔌"
          status={soc > 50 ? 'safe' : 'warning'}
          subtext="Out of 60Ah total"
        />

        <StatCard
          title="Energy"
          value={(soc / 100 * 60 * 63.5).toFixed(0)}
          unit="Wh"
          icon="⚡"
          status={soc > 50 ? 'safe' : 'warning'}
          subtext="Available energy"
        />

        <StatCard
          title="Health (SOH)"
          value="98.5"
          unit="%"
          icon="💪"
          status="safe"
          subtext="Capacity retention"
        />
      </div>

      {/* Detailed Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <h4 className="text-lg font-semibold mb-4">Electrical Parameters</h4>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Operating Voltage:</span>
              <span className="font-semibold">61.5V - 63.8V</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Min Safe Voltage:</span>
              <span className="font-semibold">40V (10%)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Max Voltage:</span>
              <span className="font-semibold">64V (100%)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Cell Configuration:</span>
              <span className="font-semibold">LiFePO4 Series String</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Cycle Count:</span>
              <span className="font-semibold">847 / 5000</span>
            </div>
          </div>
        </div>

        <div className="card">
          <h4 className="text-lg font-semibold mb-4">Thermal Information</h4>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Current Temperature:</span>
              <span className="font-semibold">28°C</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Max Temperature:</span>
              <span className="font-semibold">35°C (Safe)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Min Temperature:</span>
              <span className="font-semibold">0°C</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Warning Threshold:</span>
              <span className="font-semibold">45°C</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Critical Threshold:</span>
              <span className="font-semibold">55°C</span>
            </div>
          </div>
        </div>
      </div>

      {/* Health Status */}
      <div className="card border-2 border-green-500 bg-green-500/10">
        <h4 className="text-lg font-semibold text-green-400 mb-4">✅ Battery Health - Excellent</h4>
        <p className="text-gray-300 mb-4">
          Your battery is in excellent condition. No issues detected.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-400">Internal Resistance</p>
            <p className="text-white font-semibold">0.85 mΩ</p>
          </div>
          <div>
            <p className="text-gray-400">Estimated RUL</p>
            <p className="text-white font-semibold">2847 cycles</p>
          </div>
          <div>
            <p className="text-gray-400">Degradation Rate</p>
            <p className="text-white font-semibold">0.02% / cycle</p>
          </div>
          <div>
            <p className="text-gray-400">Last Known Good</p>
            <p className="text-white font-semibold">2 hours ago</p>
          </div>
        </div>
      </div>
    </div>
  )
}
