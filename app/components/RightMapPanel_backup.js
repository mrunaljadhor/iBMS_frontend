'use client';

import { useEffect, useRef, useState } from 'react';

export default function RightMapPanel({ origin, setOrigin, destination, setDestination, batteryData, drivingMode, calculateDTE, routeDistance, setRouteDistance, socSlider }) {
  const [originPlace, setOriginPlace] = useState('New Delhi');
  const [destPlace, setDestPlace] = useState('Noida');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [routeCoordinates, setRouteCoordinates] = useState(null);
  const [routeInfo, setRouteInfo] = useState({ distance: 0, duration: 0 });
  const mapContainer = useRef(null);
  const mapRef = useRef(null);

  // Load Leaflet from CDN on component mount
  useEffect(() => {
    if (window.L) return; // Already loaded
    
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
    script.async = true;
    document.head.appendChild(script);
  }, []);

  // Geocode place name to coordinates using Nominatim
  const geocodePlace = async (placeName) => {
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(placeName)}&format=json&limit=1`;
      console.log('🔍 Geocoding:', placeName);
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.length === 0) {
        throw new Error(`Place not found: ${placeName}`);
      }
      
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
      };
    } catch (err) {
      console.error('❌ Geocoding error:', err);
      setError(err.message);
      throw err;
    }
  };

  // Get shortest path using OSRM
  const getShortestPath = async (originCoords, destCoords) => {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${originCoords.lng},${originCoords.lat};${destCoords.lng},${destCoords.lat}?overview=full&geometries=geojson`;
      console.log('🌐 OSRM routing...');
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        throw new Error('Route not found');
      }

      const route = data.routes[0];
      const distance = (route.distance / 1000).toFixed(2);
      const duration = Math.round(route.duration / 60);

      setRouteCoordinates(route.geometry.coordinates);
      setRouteInfo({ distance: parseFloat(distance), duration: duration });
      setRouteDistance(parseFloat(distance));

      return route.geometry.coordinates;
    } catch (err) {
      console.error('❌ Routing error:', err);
      setError(`Routing error: ${err.message}`);
      throw err;
    }
  };

  // Handle route calculation
  const handleCalculateRoute = async () => {
    setLoading(true);
    setError('');
    
    try {
      const originCoords = await geocodePlace(originPlace);
      const destCoords = await geocodePlace(destPlace);
      
      setOrigin(originCoords);
      setDestination(destCoords);
      
      await getShortestPath(originCoords, destCoords);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const dte = calculateDTE();

  // Calculate SOH
  const calculateSOH = () => {
    let soh = 100;
    const tempStress = Math.abs(batteryData.Max_Temp_C - 25) * 0.5;
    soh -= tempStress;
    
    if (batteryData.Volt_Diff_V > 0.1) {
      soh -= (batteryData.Volt_Diff_V - 0.1) * 30;
    }
    
    const cycleCount = Math.max(0, (100 - socSlider) * 50);
    soh -= (cycleCount / 5000) * 20;
    
    return Math.max(50, Math.min(100, soh));
  };
  
  const soh = calculateSOH();
  
  const getSOHColor = (health) => {
    if (health >= 95) return '#10b981';
    if (health >= 85) return '#3b82f6';
    if (health >= 80) return '#f59e0b';
    return '#ef4444';
  };

  const dteStatus = routeDistance && dte > (routeDistance * 1.1) ? 'safe' : 
                   routeDistance && dte >= (routeDistance * 0.8) ? 'critical' : 
                   'impossible';

  // Map initialization and update
  useEffect(() => {
    if (!window.L) {
      console.log('⏳ Waiting for Leaflet to load...');
      return;
    }

    if (!mapContainer.current) {
      console.log('⏳ Waiting for map container...');
      return;
    }

    const L = window.L;

    // Create map if not exist
    if (!mapRef.current?.map) {
      try {
        console.log('🗺️ Creating map...');
        const map = L.map(mapContainer.current, { preferCanvas: true });
        map.setView([28.5355, 77.391], 11);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19
        }).addTo(map);

        mapRef.current = { map, markers: [], polylines: [] };
        console.log('✅ Map created');
      } catch (e) {
        console.error('❌ Map creation error:', e);
        return;
      }
    }

    const map = mapRef.current.map;

    // Clear previous layers
    mapRef.current.markers.forEach(m => {
      try { map.removeLayer(m); } catch (e) {}
    });
    mapRef.current.polylines.forEach(p => {
      try { map.removeLayer(p); } catch (e) {}
    });
    mapRef.current.markers = [];
    mapRef.current.polylines = [];

    // Add origin marker
    if (origin?.lat && origin?.lng) {
      try {
        const marker = L.circleMarker([origin.lat, origin.lng], {
          radius: 12,
          fillColor: '#3b82f6',
          color: '#1e40af',
          weight: 4,
          fillOpacity: 0.95
        }).addTo(map);
        marker.bindPopup('START');
        mapRef.current.markers.push(marker);
        console.log('📍 Origin marker added');
      } catch (e) {
        console.error('❌ Origin marker error:', e);
      }
    }

    // Add destination marker
    if (destination?.lat && destination?.lng) {
      try {
        const marker = L.circleMarker([destination.lat, destination.lng], {
          radius: 12,
          fillColor: '#ef4444',
          color: '#991b1b',
          weight: 4,
          fillOpacity: 0.95
        }).addTo(map);
        marker.bindPopup('END');
        mapRef.current.markers.push(marker);
        console.log('🎯 Destination marker added');
      } catch (e) {
        console.error('❌ Destination marker error:', e);
      }
    }

    // Add route line if available
    if (routeCoordinates?.length > 1) {
      try {
        const latlngs = routeCoordinates.map(c => [c[1], c[0]]);
        const line = L.polyline(latlngs, {
          color: '#06b6d4',
          weight: 5,
          opacity: 1
        }).addTo(map);
        mapRef.current.polylines.push(line);
        
        const bounds = line.getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [50, 50] });
        }
        console.log('🛣️ Route added');
      } catch (e) {
        console.error('❌ Route error:', e);
      }
    } else if (origin?.lat && destination?.lat) {
      // Fallback straight line
      try {
        const line = L.polyline([
          [origin.lat, origin.lng],
          [destination.lat, destination.lng]
        ], {
          color: '#06b6d4',
          weight: 3,
          opacity: 0.5,
          dashArray: '5, 5'
        }).addTo(map);
        mapRef.current.polylines.push(line);
        console.log('📏 Fallback line added');
      } catch (e) {
        console.error('❌ Fallback error:', e);
      }
    }
  }, [origin, destination, routeCoordinates]);

  const getStatusColor = (status) => {
    if (status === 'safe') return '#10b981';
    if (status === 'critical') return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* ORIGIN/DESTINATION INPUTS */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.4) 100%)',
        border: '1px solid rgba(71, 85, 105, 0.5)',
        borderRadius: '12px',
        padding: '20px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        backdropFilter: 'blur(16px)',
      }}>
        <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: 'white', marginBottom: '16px' }}>📍 Route Planning</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>Starting Point</label>
            <input 
              type="text" 
              value={originPlace}
              onChange={(e) => setOriginPlace(e.target.value)}
              placeholder="e.g., New Delhi"
              style={{
                width: '100%',
                padding: '10px',
                background: 'rgba(51, 65, 85, 0.6)',
                border: '1px solid rgba(71, 85, 105, 0.5)',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '13px'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>Destination</label>
            <input 
              type="text" 
              value={destPlace}
              onChange={(e) => setDestPlace(e.target.value)}
              placeholder="e.g., Noida"
              style={{
                width: '100%',
                padding: '10px',
                background: 'rgba(51, 65, 85, 0.6)',
                border: '1px solid rgba(71, 85, 105, 0.5)',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '13px'
              }}
            />
          </div>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.2)',
            border: '1px solid #ef4444',
            color: '#fca5a5',
            padding: '10px',
            borderRadius: '6px',
            fontSize: '12px',
            marginBottom: '12px'
          }}>
            ❌ {error}
          </div>
        )}

        <button
          onClick={handleCalculateRoute}
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px',
            background: loading ? 'rgba(100, 116, 139, 0.5)' : 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
            border: 'none',
            color: 'white',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 'bold',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? '🔄 Calculating...' : '📍 Calculate Route'}
        </button>

        <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '12px' }}>💡 Tip: Enter place names and click Calculate Route</p>
      </div>

      {/* LEAFLET MAP */}
      <div ref={mapContainer} style={{
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.4) 100%)',
        border: '1px solid rgba(71, 85, 105, 0.5)',
        borderRadius: '12px',
        overflow: 'hidden',
        height: '350px',
        width: '100%',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        backdropFilter: 'blur(16px)',
      }} />

      {/* RANGE CIRCLE INFO */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.4) 100%)',
        border: '1px solid rgba(71, 85, 105, 0.5)',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: 'white' }}>Range Circle</h3>
          <span style={{ fontSize: '28px' }}>🎯</span>
        </div>
        <p style={{ fontSize: '14px', color: '#d1d5db', marginBottom: '12px' }}>Current driving range with {drivingMode} mode (SOC: {socSlider}%)</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '32px', fontWeight: 'bold', color: '#06b6d4' }}>{dte}km</span>
          <span style={{ fontSize: '12px', color: '#9ca3af' }}>Available range</span>
        </div>
      </div>

      {/* ROUTE INFO */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.4) 100%)',
        border: '1px solid rgba(71, 85, 105, 0.5)',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: 'white' }}>Route Information</h3>
          <span style={{ fontSize: '28px' }}>🗺️</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: 'rgba(51, 65, 85, 0.4)', borderRadius: '8px' }}>
            <span style={{ color: '#9ca3af', fontSize: '13px' }}>Est. Distance</span>
            <span style={{ color: '#60a5fa', fontWeight: 'bold' }}>{routeDistance} km</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: 'rgba(51, 65, 85, 0.4)', borderRadius: '8px' }}>
            <span style={{ color: '#9ca3af', fontSize: '13px' }}>Est. Time</span>
            <span style={{ color: '#60a5fa', fontWeight: 'bold' }}>~{Math.round(routeDistance / 60 * 60)} min</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: 'rgba(51, 65, 85, 0.4)', borderRadius: '8px' }}>
            <span style={{ color: '#9ca3af', fontSize: '13px' }}>DTE vs Distance</span>
            <span style={{ color: getStatusColor(dteStatus), fontWeight: 'bold', fontSize: '12px' }}>
              {dte}km / {routeDistance}km
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: 'rgba(51, 65, 85, 0.4)', borderRadius: '8px' }}>
            <span style={{ color: '#9ca3af', fontSize: '13px' }}>Feasibility</span>
            <span style={{ color: getStatusColor(dteStatus), fontWeight: 'bold', textTransform: 'uppercase', fontSize: '12px' }}>
              {dteStatus === 'safe' ? '✅ Safe' : dteStatus === 'critical' ? '⚠️ Critical' : '❌ Impossible'}
            </span>
          </div>
        </div>
      </div>

      {/* CHARGING RECOMMENDATION */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.4) 100%)',
        border: `2px solid ${getStatusColor(dteStatus)}`,
        borderRadius: '12px',
        padding: '24px',
        boxShadow: `0 8px 32px ${getStatusColor(dteStatus)}33`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: getStatusColor(dteStatus) }}>Charging Recommendation</h3>
          <span style={{ fontSize: '28px' }}>🔌</span>
        </div>
        <p style={{ fontSize: '14px', color: '#d1d5db' }}>
          {dteStatus === 'safe'
            ? '✅ Battery level sufficient for the journey'
            : dteStatus === 'critical'
            ? '⚠️ Consider charging before the trip'
            : '❌ Immediate charging required'}
        </p>
        <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'rgba(51, 65, 85, 0.4)', borderRadius: '8px' }}>
          <p style={{ fontSize: '12px', color: '#9ca3af' }}>Current SOC: <span style={{ color: '#60a5fa', fontWeight: 'bold' }}>{socSlider}%</span></p>
          <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '8px' }}>Distance Comparison: <span style={{ color: '#60a5fa', fontWeight: 'bold' }}>{dte}/{routeDistance}</span></p>
        </div>
      </div>

      {/* STATE OF HEALTH (SOH) */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.4) 100%)',
        border: `1px solid ${getSOHColor(soh)}`,
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: 'white' }}>State of Health (SOH)</h3>
          <span style={{ fontSize: '28px' }}>💪</span>
        </div>
        
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '14px', color: '#9ca3af' }}>Battery Health Status</span>
            <span style={{ fontSize: '28px', fontWeight: 'bold', color: getSOHColor(soh) }}>
              {soh.toFixed(1)}%
            </span>
          </div>
          <div style={{
            height: '16px',
            backgroundColor: 'rgba(55, 65, 81, 0.5)',
            borderRadius: '9999px',
            overflow: 'hidden',
            border: '1px solid #4b5563'
          }}>
            <div style={{
              height: '100%',
              width: `${Math.min(soh, 100)}%`,
              background: `linear-gradient(90deg, ${getSOHColor(soh)} 0%, ${getSOHColor(soh)} 100%)`,
              transition: 'width 0.5s ease',
              boxShadow: `0 0 15px ${getSOHColor(soh)}`
            }} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12px', color: '#9ca3af' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', backgroundColor: 'rgba(51, 65, 85, 0.3)', borderRadius: '6px' }}>
            <span>Temperature Impact</span>
            <span style={{color: '#60a5fa'}}>{(Math.abs(batteryData.Max_Temp_C - 25) * 0.5).toFixed(1)}%</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', backgroundColor: 'rgba(51, 65, 85, 0.3)', borderRadius: '6px' }}>
            <span>Cell Imbalance Risk</span>
            <span style={{ color: batteryData.Volt_Diff_V > 0.2 ? '#f59e0b' : '#10b981' }}>{(batteryData.Volt_Diff_V * 100).toFixed(1)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
