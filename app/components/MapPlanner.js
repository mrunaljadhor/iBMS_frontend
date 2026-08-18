'use client'

import { useState, useEffect } from 'react'
import StatCard from './StatCard'
import { GoogleMap, useJsApiLoader, DirectionsRenderer, TrafficLayer } from '@react-google-maps/api'

export default function MapPlanner() {
  const [formData, setFormData] = useState({
    origin: '28.5355,77.3910',  // Default: Delhi
    destination: '28.7041,77.1025',  // Default: Noida
    waypoints: '',
    roundTrip: false,
    chargeAtStops: false,
    baseSoh: 100,
    ambientTempDeltaC: 0,
    avgSpeedKmh: 60,
    accelAggressionPct: 0
  })
  
  const [routeData, setRouteData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [directionsResponse, setDirectionsResponse] = useState(null)

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || 'YOUR_GOOGLE_MAPS_API_KEY'
  })

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  const calculateRoute = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      const payload = {
        ...formData,
        baseSoh: Number(formData.baseSoh),
        ambientTempDeltaC: Number(formData.ambientTempDeltaC),
        avgSpeedKmh: Number(formData.avgSpeedKmh),
        accelAggressionPct: Number(formData.accelAggressionPct),
        waypoints: formData.waypoints ? formData.waypoints.split('\n').map(s => s.trim()).filter(s => s) : []
      }
      
      const res = await fetch('/api/feasibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      setRouteData(data)

      // Generate Google Maps JS API Route for rendering
      if (isLoaded && window.google) {
        const directionsService = new window.google.maps.DirectionsService()
        
        let wypts = []
        if (payload.waypoints && payload.waypoints.length > 0) {
          wypts = payload.waypoints.map(w => ({ location: w, stopover: true }))
        }
        
        let finalDest = formData.destination
        if (payload.roundTrip) {
          wypts.push({ location: formData.destination, stopover: true })
          finalDest = formData.origin
        }
        
        try {
          const results = await directionsService.route({
            origin: formData.origin,
            destination: finalDest,
            waypoints: wypts,
            travelMode: window.google.maps.TravelMode.DRIVING
          })
          setDirectionsResponse(results)
        } catch (err) {
          console.error("DirectionsService failed:", err)
        }
      }
    } catch (error) {
      console.error('Failed to calculate route:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Route Planner Form */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-6">🗺️ Route Planner</h3>
        
        <form onSubmit={calculateRoute} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Origin (Lat,Lng)</label>
              <input
                type="text"
                name="origin"
                value={formData.origin}
                onChange={handleInputChange}
                placeholder="e.g., 28.5355,77.3910"
                className="w-full bg-gray-700 border border-gray-600 rounded px-4 py-2 text-white focus:border-blue-500 focus:outline-none"
              />
              <p className="text-xs text-gray-500 mt-1">Delhi: 28.5355,77.3910</p>
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-2">Destination (Lat,Lng)</label>
              <input
                type="text"
                name="destination"
                value={formData.destination}
                onChange={handleInputChange}
                placeholder="e.g., 28.7041,77.1025"
                className="w-full bg-gray-700 border border-gray-600 rounded px-4 py-2 text-white focus:border-blue-500 focus:outline-none"
              />
              <p className="text-xs text-gray-500 mt-1">Noida: 28.7041,77.1025</p>
            </div>
          </div>
          
          <div>
            <label className="block text-sm text-gray-400 mb-2">Waypoints (One per line)</label>
            <textarea
              name="waypoints"
              value={formData.waypoints}
              onChange={handleInputChange}
              placeholder="e.g., 28.5355,77.3910"
              rows="2"
              className="w-full bg-gray-700 border border-gray-600 rounded px-4 py-2 text-white focus:border-blue-500 focus:outline-none"
            />
          </div>
          
          <div className="border-t border-gray-700 pt-4 mt-4">
            <h4 className="text-sm font-semibold text-gray-300 mb-4">Thermodynamics & Physics</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Battery SoH (%)</label>
                <input type="range" name="baseSoh" min="40" max="100" value={formData.baseSoh} onChange={handleInputChange} className="w-full" />
                <div className="text-right text-xs text-gray-500">{formData.baseSoh}%</div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Ambient Temp (+°C)</label>
                <input type="range" name="ambientTempDeltaC" min="0" max="25" value={formData.ambientTempDeltaC} onChange={handleInputChange} className="w-full" />
                <div className="text-right text-xs text-gray-500">+{formData.ambientTempDeltaC}°C</div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Avg Speed (km/h)</label>
                <input type="range" name="avgSpeedKmh" min="20" max="120" value={formData.avgSpeedKmh} onChange={handleInputChange} className="w-full" />
                <div className="text-right text-xs text-gray-500">{formData.avgSpeedKmh} km/h</div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Acceleration Aggression (%)</label>
                <input type="range" name="accelAggressionPct" min="0" max="100" value={formData.accelAggressionPct} onChange={handleInputChange} className="w-full" />
                <div className="text-right text-xs text-gray-500">{formData.accelAggressionPct}%</div>
              </div>
            </div>
          </div>

          <div className="flex gap-6 mt-2">
            <label className="flex items-center space-x-2 text-sm text-gray-400">
              <input
                type="checkbox"
                name="roundTrip"
                checked={formData.roundTrip}
                onChange={handleInputChange}
                className="form-checkbox h-4 w-4 text-blue-500 rounded bg-gray-700 border-gray-600 focus:ring-blue-500 focus:ring-opacity-25"
              />
              <span>Round Trip</span>
            </label>
            <label className="flex items-center space-x-2 text-sm text-gray-400">
              <input
                type="checkbox"
                name="chargeAtStops"
                checked={formData.chargeAtStops}
                onChange={handleInputChange}
                className="form-checkbox h-4 w-4 text-blue-500 rounded bg-gray-700 border-gray-600 focus:ring-blue-500 focus:ring-opacity-25"
              />
              <span>Charge at Stops</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? '🔄 Calculating...' : '📍 Calculate Route'}
          </button>
        </form>
      </div>

      {/* Route Results */}
      {routeData && (
        <>
          <div className="grid-auto">
            <StatCard
              title="Route Distance"
              value={routeData.distance_km}
              unit="km"
              icon="📏"
              status="info"
            />
            
            <StatCard
              title="Estimated Time"
              value={routeData.duration_minutes}
              unit="min"
              icon="⏱️"
              status="info"
            />
            
            <StatCard
              title="Route Summary"
              value={routeData.route_summary}
              unit=""
              icon="🛣️"
              status="info"
            />

            <StatCard
              title="Avg Route Elevation Grade"
              value={routeData.feasibility?.envParams?.elevationGrade ? routeData.feasibility.envParams.elevationGrade.toFixed(2) : (routeData.elevationGrade ? routeData.elevationGrade.toFixed(2) : '0.00')}
              unit="%"
              icon="⛰️"
              status="warning"
            />
          </div>

          {/* Map Embed */}
          {directionsResponse && isLoaded && (
            <div className="card">
              <h4 className="text-lg font-semibold mb-4">Route Map</h4>
              <div style={{ width: '100%', height: '450px', borderRadius: '8px', overflow: 'hidden' }}>
                <GoogleMap
                  mapContainerStyle={{ width: '100%', height: '100%' }}
                  zoom={10}
                  center={{ lat: 28.6139, lng: 77.2090 }}
                  options={{
                    disableDefaultUI: true,
                    zoomControl: true,
                    styles: [
                      { elementType: "geometry", stylers: [{ color: "#1e293b" }] },
                      { elementType: "labels.text.stroke", stylers: [{ color: "#1e293b" }] },
                      { elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
                      { featureType: "road", elementType: "geometry", stylers: [{ color: "#334155" }] },
                      { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#1e293b" }] },
                      { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f172a" }] },
                    ]
                  }}
                >
                  <TrafficLayer />
                  <DirectionsRenderer
                    directions={directionsResponse}
                    options={{
                      polylineOptions: {
                        strokeColor: '#3b82f6',
                        strokeOpacity: 0.35,
                        strokeWeight: 7
                      }
                    }}
                  />
                </GoogleMap>
              </div>
            </div>
          )}

          {/* Zero-Cost Physics Telemetry Panel */}
          {routeData.physics_metrics && (
            <div className="card bg-gray-800/80 border border-blue-500/30">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold text-blue-400 flex items-center gap-2">
                  <span>⚡</span> Zero-Cost Physics Telemetry
                </h4>
                <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded">OpenTopoData COP30 + TomTom</span>
              </div>
              
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700/50">
                  <div className="text-sm text-gray-400 mb-1 flex items-center justify-between">
                    <span>Uphill Climb</span>
                    <span>⛰️</span>
                  </div>
                  <div className="text-2xl font-bold text-red-400">
                    +{routeData.physics_metrics.uphill_climb_meters} <span className="text-sm font-normal text-gray-500">m</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Grade: +{routeData.physics_metrics.uphill_grade_pct}%</div>
                </div>

                <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700/50">
                  <div className="text-sm text-gray-400 mb-1 flex items-center justify-between">
                    <span>Downhill Descent</span>
                    <span>📉</span>
                  </div>
                  <div className="text-2xl font-bold text-green-400">
                    -{routeData.physics_metrics.downhill_descent_meters} <span className="text-sm font-normal text-gray-500">m</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Grade: -{routeData.physics_metrics.downhill_grade_pct}%</div>
                </div>

                <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700/50">
                  <div className="text-sm text-gray-400 mb-1 flex items-center justify-between">
                    <span>Traffic Torque Penalty</span>
                    <span>🚦</span>
                  </div>
                  <div className="text-2xl font-bold text-orange-400">
                    +{routeData.physics_metrics.torque_penalty_pct}%
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Stop-&-Go Density: {routeData.physics_metrics.traffic_jam_ratio}</div>
                </div>

                <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700/50">
                  <div className="text-sm text-gray-400 mb-1 flex items-center justify-between">
                    <span>Regenerative Bonus</span>
                    <span>🔋</span>
                  </div>
                  <div className="text-2xl font-bold text-emerald-400">
                    +{routeData.physics_metrics.downhill_bonus_pct}%
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Efficiency: {routeData.physics_metrics.regen_efficiency}</div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Popular Routes */}
      <div className="card">
        <h4 className="text-lg font-semibold mb-4">Popular Routes</h4>
        <div className="space-y-2">
          {[
            { name: 'Delhi to Noida', distance: '25 km', time: '45 min' },
            { name: 'Delhi to Gurgaon', distance: '35 km', time: '60 min' },
            { name: 'Delhi to Faridabad', distance: '45 km', time: '75 min' },
            { name: 'Delhi to Meerut', distance: '65 km', time: '90 min' },
          ].map((route, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-gray-700 rounded">
              <span className="text-white font-semibold">{route.name}</span>
              <span className="text-gray-400">{route.distance} • {route.time}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Trip History */}
      <div className="card">
        <h4 className="text-lg font-semibold mb-4">Trip History</h4>
        <div className="space-y-2">
          {[
            { date: 'Today 14:30', route: 'Home → Office', distance: '15 km', comfort: 'ECO' },
            { date: 'Today 10:15', route: 'Office → Mall', distance: '22 km', comfort: 'SPORT' },
            { date: 'Yesterday 18:45', route: 'Delhi → Noida', distance: '28 km', comfort: 'ECO' },
          ].map((trip, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-gray-700 rounded text-sm">
              <div>
                <p className="text-white font-semibold">{trip.route}</p>
                <p className="text-gray-400">{trip.date}</p>
              </div>
              <div className="text-right">
                <p className="text-white font-semibold">{trip.distance}</p>
                <p className={`${trip.comfort === 'ECO' ? 'text-green-400' : 'text-red-400'}`}>
                  {trip.comfort} Mode
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
