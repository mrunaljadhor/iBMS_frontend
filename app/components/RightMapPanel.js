'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  GoogleMap,
  Marker,
  Polyline,
  TrafficLayer,
  useJsApiLoader
} from '@react-google-maps/api';
import { calculateBatteryHealthMetrics } from '../utils/batteryHealth';
import { TRINITY_DATASET_PROFILE } from '../utils/trinityDatasetProfile';

const DEFAULT_MAP_CENTER = { lat: 28.6139, lng: 77.2090 };
const ROUTE_COLOR_PALETTE = ['#3b82f6', '#8b5cf6', '#06b6d4', '#f97316', '#22c55e', '#ec4899'];

const trafficSeverityFromDelay = (delayRatio) => {
  if (delayRatio >= 0.35) return 'heavy';
  if (delayRatio >= 0.15) return 'moderate';
  return 'light';
};

const trafficSeverityColor = (severity) => {
  if (severity === 'heavy') return '#ef4444';
  if (severity === 'moderate') return '#f59e0b';
  return '#22c55e';
};

const trafficSeverityLabel = (severity) => {
  if (severity === 'heavy') return 'Heavy';
  if (severity === 'moderate') return 'Moderate';
  return 'Smooth';
};

const trafficSegmentColor = (speedClass) => {
  if (speedClass === 'TRAFFIC_JAM') return '#ef4444';
  if (speedClass === 'SLOW') return '#f59e0b';
  return '#22c55e';
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const parseDurationToMinutes = (durationText) => {
  if (!durationText || typeof durationText !== 'string') {
    return 0;
  }

  // Routes API duration is in protobuf format, e.g. "845s".
  const seconds = Number.parseFloat(durationText.replace('s', ''));
  if (!Number.isFinite(seconds)) {
    return 0;
  }

  return Number((seconds / 60).toFixed(1));
};

const getSocRouteAdjustment = (socPercent) => {
  const soc = clamp(Number(socPercent) || 0, 0, 100);

  if (soc >= 70) return 0;
  if (soc >= 40) return Number(((70 - soc) / 300).toFixed(3));
  if (soc >= 20) return Number((0.10 + (40 - soc) / 160).toFixed(3));
  return Number((0.23 + (20 - soc) / 80).toFixed(3));
};

const applySocToRouteOutputs = (effectiveDistanceKm, trafficMinutes, socPercent) => {
  const factor = getSocRouteAdjustment(socPercent);

  const socAdjustedDistance = Number(
    (effectiveDistanceKm * (1 + factor * 0.55)).toFixed(2)
  );
  const socAdjustedDuration = Number(
    (trafficMinutes * (1 + factor)).toFixed(1)
  );

  return {
    factor,
    socAdjustedDistance,
    socAdjustedDuration
  };
};

const getRouteColorByIndex = (index) => ROUTE_COLOR_PALETTE[index % ROUTE_COLOR_PALETTE.length];

export default function RightMapPanel({
  origin,
  setOrigin,
  destination,
  setDestination,
  batteryData,
  drivingMode,
  calculateDTE,
  routeDistance,
  setRouteDistance,
  socSlider,
  datasetProfile
}) {

  const mapRef = useRef(null);
  const googleLibraries = useMemo(() => ['places', 'geometry'], []);

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'ibms-google-map',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || '',
    libraries: googleLibraries
  });

  const [originPlace, setOriginPlace] = useState('');
  const [destPlace, setDestPlace] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [fallbackRoutePath, setFallbackRoutePath] = useState([]);
  const [trafficSegments, setTrafficSegments] = useState([]);
  const [routeCandidates, setRouteCandidates] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [routeInfo, setRouteInfo] = useState({
    distance: Number(routeDistance) || 0,
    duration: 0,
    staticDuration: 0,
    durationInTraffic: 0,
    delayMinutes: 0,
    congestionRatio: 1,
    severity: 'light',
    effectiveDistance: Number(routeDistance) || 0,
    routeProvider: '',
    hasLiveTraffic: false,
    socAdjustmentFactor: 0,
    socAdjustedDuration: 0,
    socAdjustedDistance: Number(routeDistance) || 0,
    alternativesEvaluated: 0,
    optimizationSummary: ''
  });

  const buildRouteOptionLabel = (candidate, index) => {
    const distance = Number.isFinite(candidate?.distanceKm) ? `${candidate.distanceKm} km` : 'n/a';
    const eta = Number.isFinite(candidate?.trafficMinutes) ? `${candidate.trafficMinutes} min` : 'n/a';

    return `Route ${index + 1} - ${distance} - ${eta}`;
  };

  const applySelectedRouteCandidate = (candidate, candidates, optimizationSummary) => {
    if (!candidate) {
      return;
    }

    const socAdjustedOutputs = applySocToRouteOutputs(
      candidate.effectiveDistance,
      candidate.trafficMinutes,
      socSlider
    );

    setFallbackRoutePath(candidate.path || []);
    setTrafficSegments(candidate.segments || []);
    setRouteInfo({
      distance: candidate.distanceKm,
      duration: candidate.staticMinutes,
      staticDuration: candidate.staticMinutes,
      durationInTraffic: candidate.trafficMinutes,
      delayMinutes: candidate.delayMinutes,
      congestionRatio: candidate.congestionRatio,
      severity: candidate.severity,
      effectiveDistance: candidate.effectiveDistance,
      routeProvider: candidate.routeProvider || '',
      hasLiveTraffic: Boolean(candidate.hasLiveTraffic),
      socAdjustmentFactor: socAdjustedOutputs.factor,
      socAdjustedDuration: socAdjustedOutputs.socAdjustedDuration,
      socAdjustedDistance: socAdjustedOutputs.socAdjustedDistance,
      alternativesEvaluated: candidates.length || 1,
      optimizationSummary: optimizationSummary || candidate.optimizationSummary || ''
    });
    setRouteDistance(socAdjustedOutputs.socAdjustedDistance);
    setSelectedRouteId(candidate.id || '');
    setRouteCandidates(candidates);
  };

  const geocodePlace = async (placeName) => {
    const normalizedPlace = placeName.trim();

    if (!normalizedPlace) {
      throw new Error('Please enter a place name.');
    }

    const googleGeocode = async (query) =>
      new Promise((resolve, reject) => {
        if (!window.google?.maps) {
          reject(new Error('Google Maps is not ready yet.'));
          return;
        }

        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode(
          {
            address: query,
            region: 'in',
            componentRestrictions: { country: 'IN' }
          },
          (results, status) => {
            if (status === 'OK' && results && results[0]) {
              const location = results[0].geometry.location;
              resolve({
                lat: location.lat(),
                lng: location.lng()
              });
              return;
            }

            reject(new Error(status || 'Google geocode failed'));
          }
        );
      });

    const googlePlacesSearch = async (query) =>
      new Promise((resolve, reject) => {
        if (!window.google?.maps?.places) {
          reject(new Error('Google Places is not ready yet.'));
          return;
        }

        const service = new window.google.maps.places.PlacesService(document.createElement('div'));
        service.textSearch(
          {
            query,
            region: 'in'
          },
          (results, status) => {
            if (status === window.google.maps.places.PlacesServiceStatus.OK && results?.length) {
              const location = results[0].geometry?.location;
              if (location) {
                resolve({
                  lat: location.lat(),
                  lng: location.lng()
                });
                return;
              }
            }

            reject(new Error(status || 'Google Places search failed'));
          }
        );
      });

    const fallbackGeocode = async (query) => {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=in&q=${encodeURIComponent(query)}`,
        {
          headers: {
            Accept: 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Fallback geocoder failed.');
      }

      const results = await response.json();
      if (!results?.length) {
        throw new Error(`Place not found: ${placeName}`);
      }

      return {
        lat: Number(results[0].lat),
        lng: Number(results[0].lon)
      };
    };

    const queries = [
      normalizedPlace,
      `${normalizedPlace}, India`,
      `${normalizedPlace}, New Delhi, India`
    ];

    for (const query of queries) {
      try {
        return await googleGeocode(query);
      } catch {
        try {
          return await googlePlacesSearch(query);
        } catch {
          // Try the next query candidate.
        }
      }
    }

    try {
      return await fallbackGeocode(normalizedPlace);
    } catch {
      throw new Error(`Place not found: ${placeName}. Try a fuller address or landmark.`);
    }
  };

  const buildTrafficAwareRoute = async (originCoords, destCoords) => {
    if (!window.google?.maps) {
      throw new Error('Google Maps is not ready yet.');
    }

    if (
      !Number.isFinite(originCoords?.lat)
      || !Number.isFinite(originCoords?.lng)
      || !Number.isFinite(destCoords?.lat)
      || !Number.isFinite(destCoords?.lng)
    ) {
      throw new Error('Invalid origin/destination coordinates.');
    }

    const service = new window.google.maps.DirectionsService();

    const requestDirections = (request) =>
      new Promise((resolve) => {
        service.route(request, (result, status) => {
          resolve({ result, status });
        });
      });

    const baseRequest = {
      origin: originCoords,
      destination: destCoords,
      travelMode: window.google.maps.TravelMode.DRIVING,
      unitSystem: window.google.maps.UnitSystem.METRIC,
      region: 'IN'
    };

    let trafficDataAvailable = true;
    let directionStatus = 'UNKNOWN_ERROR';

    const liveTrafficAttempt = await requestDirections({
      ...baseRequest,
      provideRouteAlternatives: true,
      drivingOptions: {
        departureTime: new Date(Date.now() + 60 * 1000),
        trafficModel: window.google.maps.TrafficModel.BEST_GUESS
      }
    });

    directionStatus = liveTrafficAttempt.status;
    let directionResult = liveTrafficAttempt.result;

    if (directionStatus !== 'OK' || !directionResult?.routes?.length) {
      trafficDataAvailable = false;

      const standardAttempt = await requestDirections({
        ...baseRequest,
        provideRouteAlternatives: true
      });

      directionStatus = standardAttempt.status;
      directionResult = standardAttempt.result;
    }

    if (directionStatus !== 'OK' || !directionResult?.routes?.length) {
      const minimalAttempt = await requestDirections(baseRequest);
      directionStatus = minimalAttempt.status;
      directionResult = minimalAttempt.result;
      trafficDataAvailable = false;
    }

    if (directionStatus !== 'OK' || !directionResult?.routes?.length) {
      throw new Error(`Route not found (${directionStatus}).`);
    }

    const candidates = directionResult.routes
      .map((route, index) => {
        const leg = route?.legs?.[0];
        if (!leg?.distance?.value || !leg?.duration?.value || !route?.overview_path?.length) {
          return null;
        }

        const distanceKm = Number((leg.distance.value / 1000).toFixed(2));
        const baseMinutes = Number((leg.duration.value / 60).toFixed(1));
        const trafficDurationSec = leg.duration_in_traffic?.value;
        const hasLiveTrafficDuration = Number.isFinite(trafficDurationSec);
        const trafficMinutes = Number(
          (((hasLiveTrafficDuration ? trafficDurationSec : leg.duration.value) || 0) / 60).toFixed(1)
        );
        const delayMinutes = Number(Math.max(0, trafficMinutes - baseMinutes).toFixed(1));
        const delayRatio = baseMinutes > 0 ? delayMinutes / baseMinutes : 0;
        const congestionRatio = baseMinutes > 0
          ? Number((trafficMinutes / baseMinutes).toFixed(2))
          : 1;
        const severity = trafficSeverityFromDelay(delayRatio);
        const effectiveDistance = Number((distanceKm * (1 + delayRatio * 0.35)).toFixed(2));
        const hasLiveTraffic = trafficDataAvailable && hasLiveTrafficDuration;

        return {
          id: `google-directions-${index + 1}`,
          path: route.overview_path.map((point) => ({ lat: point.lat(), lng: point.lng() })),
          segments: [],
          distanceKm,
          staticMinutes: baseMinutes,
          trafficMinutes,
          delayMinutes,
          congestionRatio,
          severity,
          effectiveDistance,
          routeProvider: hasLiveTraffic ? 'google-traffic' : 'google-standard',
          hasLiveTraffic,
          optimizationSummary: hasLiveTraffic
            ? 'Google Directions traffic-aware route with alternatives.'
            : 'Google Directions standard route without live traffic durations.'
        };
      })
      .filter(Boolean);

    if (!candidates.length) {
      throw new Error('Invalid route response.');
    }

    return {
      result: directionResult,
      candidates,
      trafficDataAvailable: candidates.some((candidate) => candidate.hasLiveTraffic)
    };
  };

  const buildOptimizedTrafficRoute = async (originCoords, destCoords) => {
    if (!window.google?.maps?.geometry?.encoding) {
      throw new Error('Google geometry library is not ready yet.');
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || '';
    if (!apiKey) {
      throw new Error('Google Maps API key is missing.');
    }

    const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': [
          'routes.duration',
          'routes.staticDuration',
          'routes.distanceMeters',
          'routes.polyline.encodedPolyline',
          'routes.travelAdvisory.speedReadingIntervals'
        ].join(',')
      },
      body: JSON.stringify({
        origin: {
          location: {
            latLng: {
              latitude: originCoords.lat,
              longitude: originCoords.lng
            }
          }
        },
        destination: {
          location: {
            latLng: {
              latitude: destCoords.lat,
              longitude: destCoords.lng
            }
          }
        },
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE_OPTIMAL',
        computeAlternativeRoutes: true,
        units: 'METRIC',
        languageCode: 'en-IN',
        extraComputations: ['TRAFFIC_ON_POLYLINE']
      })
    });

    if (!response.ok) {
      throw new Error('Routes API unavailable for live traffic segmentation.');
    }

    const data = await response.json();
    const routes = data?.routes;
    if (!Array.isArray(routes) || routes.length === 0) {
      throw new Error('No routes returned by Routes API.');
    }

    const candidates = routes
      .map((route, index) => {
        const encodedPolyline = route?.polyline?.encodedPolyline;
        if (!encodedPolyline) {
          return null;
        }

        const decodedPath = window.google.maps.geometry.encoding.decodePath(encodedPolyline);
        const path = decodedPath.map((point) => ({ lat: point.lat(), lng: point.lng() }));
        if (!path.length) {
          return null;
        }

        const distanceKm = Number(((route.distanceMeters || 0) / 1000).toFixed(2));
        const trafficMinutes = parseDurationToMinutes(route.duration);
        const staticMinutes = parseDurationToMinutes(route.staticDuration || route.duration);
        const delayMinutes = Number(Math.max(0, trafficMinutes - staticMinutes).toFixed(1));
        const delayRatio = staticMinutes > 0 ? delayMinutes / staticMinutes : 0;
        const congestionRatio = staticMinutes > 0
          ? Number((trafficMinutes / staticMinutes).toFixed(2))
          : 1;
        const severity = trafficSeverityFromDelay(delayRatio);
        const effectiveDistance = Number((distanceKm * (1 + delayRatio * 0.35)).toFixed(2));

        const intervals = route?.travelAdvisory?.speedReadingIntervals || [];
        const segments = intervals
          .map((interval, segmentIndex) => {
            const startIndex = clamp(Number(interval.startPolylinePointIndex ?? 0), 0, path.length - 1);
            const endIndex = clamp(Number(interval.endPolylinePointIndex ?? (path.length - 1)), 0, path.length - 1);

            if (endIndex <= startIndex) {
              return null;
            }

            return {
              id: `${index}-${segmentIndex}`,
              speed: interval.speed || 'NORMAL',
              color: trafficSegmentColor(interval.speed || 'NORMAL'),
              path: path.slice(startIndex, endIndex + 1)
            };
          })
          .filter(Boolean);

        return {
          id: `google-routes-${index + 1}`,
          index,
          path,
          segments,
          distanceKm,
          trafficMinutes,
          staticMinutes,
          delayMinutes,
          delayRatio,
          congestionRatio,
          severity,
          effectiveDistance,
          routeProvider: 'google-routes-segmented',
          hasLiveTraffic: true,
          optimizationSummary: 'Optimized for fastest ETA, lower congestion, and shorter distance.'
        };
      })
      .filter(Boolean);

    if (!candidates.length) {
      throw new Error('No valid route geometry available.');
    }

    const distanceValues = candidates.map((candidate) => candidate.distanceKm);
    const timeValues = candidates.map((candidate) => candidate.trafficMinutes);
    const delayValues = candidates.map((candidate) => candidate.delayRatio);

    const minDistance = Math.min(...distanceValues);
    const maxDistance = Math.max(...distanceValues);
    const minTime = Math.min(...timeValues);
    const maxTime = Math.max(...timeValues);
    const minDelay = Math.min(...delayValues);
    const maxDelay = Math.max(...delayValues);

    const weightedCandidates = candidates.map((candidate) => {
      const normalizedDistance = normalizeMetric(candidate.distanceKm, minDistance, maxDistance);
      const normalizedTime = normalizeMetric(candidate.trafficMinutes, minTime, maxTime);
      const normalizedDelay = normalizeMetric(candidate.delayRatio, minDelay, maxDelay);

      // Prioritize fastest route, then lower congestion, then shorter distance.
      const score = Number((normalizedTime * 0.5 + normalizedDelay * 0.3 + normalizedDistance * 0.2).toFixed(4));

      return {
        ...candidate,
        score
      };
    });

    const rankedCandidates = [...weightedCandidates].sort((first, second) => first.score - second.score);
    const bestRoute = rankedCandidates[0];

    return {
      bestRoute,
      alternatives: rankedCandidates.filter((candidate) => candidate.index !== bestRoute.index),
      candidates: rankedCandidates
    };
  };

  const buildOsrmRoute = async (originCoords, destCoords) => {
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${originCoords.lng},${originCoords.lat};${destCoords.lng},${destCoords.lat}?overview=full&alternatives=true&geometries=geojson`;

    const response = await fetch(osrmUrl);
    if (!response.ok) {
      throw new Error('OSRM route service is unavailable.');
    }

    const data = await response.json();
    const routes = Array.isArray(data?.routes) ? data.routes : [];
    if (!routes.length) {
      throw new Error('Fallback route could not be generated.');
    }

    const candidates = routes
      .map((route, index) => {
        const coordinates = route?.geometry?.coordinates;
        if (!coordinates?.length) {
          return null;
        }

        const path = coordinates.map(([lng, lat]) => ({ lat, lng }));
        const distanceKm = Number((route.distance / 1000).toFixed(2));
        const baseMinutes = Number((route.duration / 60).toFixed(1));

        return {
          id: `osrm-${index + 1}`,
          path,
          segments: [],
          distanceKm,
          staticMinutes: baseMinutes,
          trafficMinutes: baseMinutes,
          delayMinutes: 0,
          congestionRatio: 1,
          severity: 'light',
          effectiveDistance: distanceKm,
          routeProvider: 'osrm',
          hasLiveTraffic: false,
          optimizationSummary: index === 0
            ? 'Google traffic services unavailable; using shortest fallback route.'
            : 'Alternative fallback route from OSRM (no live traffic).'
        };
      })
      .filter(Boolean);

    if (!candidates.length) {
      throw new Error('Fallback route could not be generated.');
    }

    return {
      candidates,
      routeProvider: 'osrm'
    };
  };

  const handleCalculateRoute = async () => {
    setLoading(true);
    setError('');
    setNotice('');

    const fitPathBounds = (path) => {
      if (!mapRef.current || !Array.isArray(path) || path.length === 0 || !window.google?.maps) {
        return;
      }

      const bounds = new window.google.maps.LatLngBounds();
      path.forEach((point) => bounds.extend(point));
      mapRef.current.fitBounds(bounds, 50);
    };

    try {
      const originCoords = await geocodePlace(originPlace);
      const destCoords = await geocodePlace(destPlace);

      setOrigin(originCoords);
      setDestination(destCoords);

      try {
        const optimizedTrafficRoute = await buildOptimizedTrafficRoute(originCoords, destCoords);
        const candidates = optimizedTrafficRoute.candidates || [];
        const selectedRoute = optimizedTrafficRoute.bestRoute || candidates[0];

        applySelectedRouteCandidate(
          selectedRoute,
          candidates,
          'Optimized for fastest ETA, lower congestion, and shorter distance.'
        );
        setNotice(`Optimized live-traffic route selected from ${candidates.length} route options.`);
        fitPathBounds(selectedRoute?.path);
      } catch {
        try {
          const trafficRoute = await buildTrafficAwareRoute(originCoords, destCoords);
          const candidates = trafficRoute.candidates || [];
          const selectedRoute = candidates[0];

          applySelectedRouteCandidate(
            selectedRoute,
            candidates,
            'Optimized route unavailable from segmented feed; using Google Directions fallback.'
          );

          if (!trafficRoute.trafficDataAvailable) {
            setNotice('Live segment colors unavailable. Showing Google Directions fallback routes.');
          } else {
            setNotice(`Traffic-aware fallback selected from ${candidates.length} route options.`);
          }
          fitPathBounds(selectedRoute?.path);
        } catch {
          const fallbackRoute = await buildOsrmRoute(originCoords, destCoords);
          const candidates = fallbackRoute.candidates || [];
          const selectedRoute = candidates[0];

          applySelectedRouteCandidate(
            selectedRoute,
            candidates,
            'Google traffic services unavailable; using shortest fallback route.'
          );

          if (candidates.length > 1) {
            setNotice('Showing OSRM fallback routes (no live traffic). Use Route Options to switch routes.');
          } else {
            setNotice('Showing fallback route. Enable Google Routes API for segment-level traffic colors.');
          }

          fitPathBounds(selectedRoute?.path);
        }
      }
    } catch (routeError) {
      setError(routeError.message || 'Unable to calculate traffic-aware route.');
      setFallbackRoutePath([]);
      setRouteCandidates([]);
      setSelectedRouteId('');
      setTrafficSegments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRouteOptionChange = (event) => {
    const nextRouteId = event.target.value;
    const candidate = routeCandidates.find((routeCandidate) => routeCandidate.id === nextRouteId);
    if (!candidate) {
      return;
    }

    const selectedIndex = routeCandidates.findIndex((routeCandidate) => routeCandidate.id === nextRouteId);
    applySelectedRouteCandidate(candidate, routeCandidates, routeInfo.optimizationSummary);
    setNotice(`Viewing ${buildRouteOptionLabel(candidate, selectedIndex)}.`);
  };

  useEffect(() => {
    if (!routeInfo.effectiveDistance || !routeInfo.durationInTraffic) {
      return;
    }

    const socAdjustedOutputs = applySocToRouteOutputs(
      routeInfo.effectiveDistance,
      routeInfo.durationInTraffic,
      socSlider
    );

    setRouteInfo((previous) => {
      if (
        previous.socAdjustmentFactor === socAdjustedOutputs.factor
        && previous.socAdjustedDuration === socAdjustedOutputs.socAdjustedDuration
        && previous.socAdjustedDistance === socAdjustedOutputs.socAdjustedDistance
      ) {
        return previous;
      }

      return {
        ...previous,
        socAdjustmentFactor: socAdjustedOutputs.factor,
        socAdjustedDuration: socAdjustedOutputs.socAdjustedDuration,
        socAdjustedDistance: socAdjustedOutputs.socAdjustedDistance
      };
    });

    setRouteDistance(socAdjustedOutputs.socAdjustedDistance);
  }, [routeInfo.effectiveDistance, routeInfo.durationInTraffic, socSlider, setRouteDistance]);

  const dte = calculateDTE();

  const getNumeric = (...values) => {
    for (const value of values) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return undefined;
  };

  const estimatedVoltDiff = socSlider > 90
    ? 0.04 + (socSlider - 90) * 0.008
    : socSlider < 15
      ? 0.07 + (15 - socSlider) * 0.01
      : 0.01 + Math.abs(socSlider - 50) * 0.0015;

  const activeDatasetProfile = datasetProfile || TRINITY_DATASET_PROFILE;

  const healthMetrics = calculateBatteryHealthMetrics({
    soc: getNumeric(socSlider, batteryData?.Actual_SOC, batteryData?.SOC, 0),
    temperatureC: getNumeric(batteryData?.Max_Temp_C, batteryData?.temperature, 25),
    voltageDiffV: getNumeric(
      Math.max(Number(batteryData?.Volt_Diff_V || 0), Math.min(0.6, estimatedVoltDiff)),
      batteryData?.voltage_diff,
      batteryData?.volt_diff,
      estimatedVoltDiff,
      0.05
    ),
    datasetProfile: {
      ...TRINITY_DATASET_PROFILE,
      ...activeDatasetProfile,
      datasetName: activeDatasetProfile.datasetName || batteryData?.Dataset_Name || TRINITY_DATASET_PROFILE.datasetName,
      rows: getNumeric(activeDatasetProfile.rows, batteryData?.Dataset_Rows, TRINITY_DATASET_PROFILE.rows),
      cycleCount: getNumeric(
        batteryData?.Cycle_Count,
        batteryData?.cycle_count,
        batteryData?.cycleCount,
        batteryData?.cycles,
        activeDatasetProfile.cycleCount,
        TRINITY_DATASET_PROFILE.cycleCount
      ),
      designCycleLife: getNumeric(
        batteryData?.Design_Cycle_Life,
        batteryData?.design_cycle_life,
        batteryData?.designCycleLife,
        batteryData?.rated_cycles,
        activeDatasetProfile.designCycleLife,
        TRINITY_DATASET_PROFILE.designCycleLife
      ),
      batteryAgeYears: getNumeric(
        batteryData?.Battery_Age_Years,
        batteryData?.battery_age_years,
        batteryData?.batteryAgeYears,
        batteryData?.age_years,
        activeDatasetProfile.batteryAgeYears,
        TRINITY_DATASET_PROFILE.batteryAgeYears
      ),
      baselineSoh: getNumeric(
        batteryData?.SOH_Baseline,
        batteryData?.soh_baseline,
        batteryData?.baselineSoh,
        activeDatasetProfile.baselineSoh,
        TRINITY_DATASET_PROFILE.baselineSoh
      ),
      eolThreshold: getNumeric(
        batteryData?.EOL_Threshold,
        batteryData?.eol_threshold,
        activeDatasetProfile.eolThreshold,
        TRINITY_DATASET_PROFILE.eolThreshold
      ),
      nominalTemperatureC: getNumeric(
        activeDatasetProfile.nominalTemperatureC,
        TRINITY_DATASET_PROFILE.nominalTemperatureC
      ),
      nominalVoltDiffV: getNumeric(
        activeDatasetProfile.nominalVoltDiffV,
        TRINITY_DATASET_PROFILE.nominalVoltDiffV
      )
    }
  });

  const soh = healthMetrics.soh;

  const getSOHColor = (health) => {
    if (health >= 95) return '#10b981';
    if (health >= 85) return '#3b82f6';
    if (health >= 80) return '#f59e0b';
    return '#ef4444';
  };

  const socAdjustedDistance = routeInfo.socAdjustedDistance || routeInfo.effectiveDistance || routeDistance;
  const socAdjustedDuration = routeInfo.socAdjustedDuration || routeInfo.durationInTraffic || routeInfo.duration;

  const feasibilityDistance = socAdjustedDistance;
  const dteStatus = feasibilityDistance && dte > (feasibilityDistance * 1.1)
    ? 'safe'
    : feasibilityDistance && dte >= (feasibilityDistance * 0.8)
      ? 'critical'
      : 'impossible';

  const getStatusColor = (status) => {
    if (status === 'safe') return '#10b981';
    if (status === 'critical') return '#f59e0b';
    return '#ef4444';
  };

  const trafficColor = trafficSeverityColor(routeInfo.severity);
  const hasLiveTrafficData = Boolean(
    routeInfo.hasLiveTraffic
    && (routeInfo.routeProvider === 'google-routes-segmented' || routeInfo.routeProvider === 'google-traffic')
  );
  const selectedRouteIndex = routeCandidates.findIndex((candidate) => candidate.id === selectedRouteId);
  const activeRouteCandidate = selectedRouteIndex >= 0 ? routeCandidates[selectedRouteIndex] : routeCandidates[0];
  const activeRouteLabel = activeRouteCandidate
    ? buildRouteOptionLabel(activeRouteCandidate, Math.max(selectedRouteIndex, 0))
    : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      <div style={{
        background: 'linear-gradient(160deg, rgba(8, 10, 14, 0.96) 0%, rgba(2, 3, 6, 0.96) 100%)',
        border: '1px solid rgba(148, 163, 184, 0.22)',
        borderRadius: '12px',
        padding: '20px',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(16px)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#f8fafc' }}>Route Planning</h3>
          <span style={{ fontSize: '11px', color: '#38bdf8', letterSpacing: '0.1em', textTransform: 'uppercase', border: '1px solid rgba(56, 189, 248, 0.5)', borderRadius: '9999px', padding: '4px 10px' }}>Traffic-Aware</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>Starting Point</label>
            <input
              type="text"
              value={originPlace}
              onChange={(event) => setOriginPlace(event.target.value)}
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
              onChange={(event) => setDestPlace(event.target.value)}
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
            Error: {error}
          </div>
        )}

        {!error && notice && (
          <div style={{
            background: 'rgba(59, 130, 246, 0.16)',
            border: '1px solid rgba(59, 130, 246, 0.55)',
            color: '#bfdbfe',
            padding: '10px',
            borderRadius: '6px',
            fontSize: '12px',
            marginBottom: '12px'
          }}>
            {notice}
          </div>
        )}

        <button
          onClick={handleCalculateRoute}
          disabled={loading || !isLoaded || !!loadError}
          style={{
            width: '100%',
            padding: '12px',
            background: loading
              ? 'rgba(100, 116, 139, 0.5)'
              : 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
            border: 'none',
            color: 'white',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 'bold',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Computing Live Traffic Route...' : 'Calculate Route'}
        </button>

        {routeCandidates.length > 0 && (
          <div style={{
            marginTop: '12px',
            padding: '12px',
            background: 'rgba(15, 23, 42, 0.4)',
            border: '1px solid rgba(71, 85, 105, 0.45)',
            borderRadius: '8px'
          }}>
            <div style={{
              fontSize: '11px',
              color: '#38bdf8',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: '10px'
            }}>
              Route Options
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              background: 'rgba(30, 41, 59, 0.6)',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              borderRadius: '6px',
              padding: '8px 10px',
              marginBottom: '10px'
            }}>
              <span style={{ fontSize: '12px', color: '#cbd5e1' }}>{activeRouteLabel}</span>
              <span style={{
                fontSize: '10px',
                fontWeight: 'bold',
                letterSpacing: '0.08em',
                color: '#22c55e',
                textTransform: 'uppercase',
                border: '1px solid rgba(34, 197, 94, 0.45)',
                borderRadius: '9999px',
                padding: '3px 8px'
              }}>
                Active
              </span>
            </div>

            <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>
              Selected Route
            </label>
            <select
              value={selectedRouteId}
              onChange={handleRouteOptionChange}
              style={{
                width: '100%',
                padding: '10px',
                background: 'rgba(30, 41, 59, 0.7)',
                border: '1px solid rgba(71, 85, 105, 0.5)',
                borderRadius: '6px',
                color: '#e2e8f0',
                fontSize: '12px',
                marginBottom: '10px'
              }}
            >
              {routeCandidates.map((candidate, index) => (
                <option key={candidate.id} value={candidate.id}>
                  {buildRouteOptionLabel(candidate, index)}
                </option>
              ))}
            </select>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '2px' }}>
              {activeRouteCandidate && (
                <span
                  key={`route-color-chip-${activeRouteCandidate.id}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 8px',
                    borderRadius: '9999px',
                    border: '1px solid rgba(148, 163, 184, 0.7)',
                    background: 'rgba(30, 41, 59, 0.7)',
                    color: '#cbd5e1',
                    fontSize: '11px'
                  }}
                >
                  <span style={{ color: getRouteColorByIndex(selectedRouteIndex >= 0 ? selectedRouteIndex : 0), fontSize: '12px', lineHeight: 1 }}>■</span>
                  {`Route ${selectedRouteIndex >= 0 ? selectedRouteIndex + 1 : 1} - Selected`}
                </span>
              )}
            </div>
          </div>
        )}

        <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '12px' }}>
          {hasLiveTrafficData
            ? 'Route-level live traffic is active: red (heavy), yellow (moderate), green (smooth)'
            : 'Only map traffic overlay is active. Route-level live traffic metrics are unavailable for this provider.'}
        </p>
      </div>

      <div style={{
        background: 'linear-gradient(160deg, rgba(8, 10, 14, 0.96) 0%, rgba(2, 3, 6, 0.96) 100%)',
        border: '1px solid rgba(148, 163, 184, 0.22)',
        borderRadius: '12px',
        overflow: 'hidden',
        height: '350px',
        width: '100%',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(16px)'
      }}>
        {!isLoaded && !loadError && (
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#cbd5e1',
            fontSize: '13px'
          }}>
            Loading Google Maps...
          </div>
        )}

        {loadError && (
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fca5a5',
            fontSize: '13px',
            padding: '16px',
            textAlign: 'center'
          }}>
            Unable to load Google Maps. Check NEXT_PUBLIC_GOOGLE_MAPS_KEY.
          </div>
        )}

        {isLoaded && !loadError && (
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={origin?.lat && origin?.lng ? { lat: origin.lat, lng: origin.lng } : DEFAULT_MAP_CENTER}
            zoom={11}
            onLoad={(map) => {
              mapRef.current = map;
            }}
            options={{
              mapTypeControl: false,
              streetViewControl: false,
              fullscreenControl: false,
              clickableIcons: false
            }}
          >
            <TrafficLayer autoUpdate />

            {origin?.lat && origin?.lng && (
              <Marker position={{ lat: origin.lat, lng: origin.lng }} label="S" />
            )}

            {destination?.lat && destination?.lng && (
              <Marker position={{ lat: destination.lat, lng: destination.lng }} label="E" />
            )}

            {routeCandidates.length > 0 && routeCandidates.map((candidate, index) => {
              const isSelected = candidate.id === selectedRouteId;
              return (
                <Polyline
                  key={`candidate-route-${candidate.id}`}
                  path={candidate.path}
                  options={{
                    strokeColor: getRouteColorByIndex(index),
                    strokeOpacity: isSelected
                      ? (trafficSegments.length > 0 ? 0.34 : 0.95)
                      : 0.68,
                    strokeWeight: isSelected ? 7 : 5,
                    zIndex: isSelected ? 10 : 6
                  }}
                />
              );
            })}

            {routeCandidates.length === 0 && fallbackRoutePath.length > 0 && (
              <Polyline
                key={`selected-route-${selectedRouteId || 'default'}`}
                path={fallbackRoutePath}
                options={{
                  strokeColor: '#3b82f6',
                  strokeOpacity: trafficSegments.length > 0 ? 0.28 : 0.45,
                  strokeWeight: 7
                }}
              />
            )}

            {trafficSegments.map((segment) => (
              segment.path.length > 1 && (
                <Polyline
                  key={`traffic-segment-${selectedRouteId || 'default'}-${segment.id}`}
                  path={segment.path}
                  options={{
                    strokeColor: segment.color,
                    strokeOpacity: 0.92,
                    strokeWeight: 6,
                    zIndex: 20
                  }}
                />
              )
            ))}
          </GoogleMap>
        )}
      </div>

      <div style={{
        background: 'linear-gradient(160deg, rgba(8, 10, 14, 0.96) 0%, rgba(2, 3, 6, 0.96) 100%)',
        border: '1px solid rgba(148, 163, 184, 0.22)',
        borderRadius: '12px',
        padding: '16px',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.45)'
      }}>
        <h4 style={{ fontSize: '14px', color: '#e2e8f0', marginBottom: '8px', fontWeight: 700 }}>Traffic Legend</h4>
        <div style={{ display: 'flex', gap: '18px', fontSize: '12px', color: '#cbd5e1' }}>
          <span><span style={{ color: '#ef4444' }}>■</span> Heavy</span>
          <span><span style={{ color: '#f59e0b' }}>■</span> Moderate</span>
          <span><span style={{ color: '#22c55e' }}>■</span> Smooth</span>
        </div>
      </div>

      <div style={{
        background: 'linear-gradient(160deg, rgba(8, 10, 14, 0.96) 0%, rgba(2, 3, 6, 0.96) 100%)',
        border: '1px solid rgba(148, 163, 184, 0.22)',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.45)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#f8fafc' }}>Range Envelope</h3>
          <span style={{ fontSize: '11px', color: '#22c55e', letterSpacing: '0.1em', textTransform: 'uppercase', border: '1px solid rgba(34, 197, 94, 0.45)', borderRadius: '9999px', padding: '4px 10px' }}>Range</span>
        </div>
        <p style={{ fontSize: '14px', color: '#d1d5db', marginBottom: '12px' }}>
          Current driving range with {drivingMode} mode (SOC: {socSlider}%)
        </p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '32px', fontWeight: 'bold', color: '#06b6d4' }}>{dte}km</span>
          <span style={{ fontSize: '12px', color: '#9ca3af' }}>Available range</span>
        </div>
      </div>

      <div style={{
        background: 'linear-gradient(160deg, rgba(8, 10, 14, 0.96) 0%, rgba(2, 3, 6, 0.96) 100%)',
        border: '1px solid rgba(148, 163, 184, 0.22)',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.45)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#f8fafc' }}>Route Information</h3>
          <span style={{ fontSize: '11px', color: trafficColor, letterSpacing: '0.1em', textTransform: 'uppercase', border: `1px solid ${trafficColor}99`, borderRadius: '9999px', padding: '4px 10px' }}>
            {trafficSeverityLabel(routeInfo.severity)} Traffic
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: 'rgba(51, 65, 85, 0.4)', borderRadius: '8px' }}>
            <span style={{ color: '#9ca3af', fontSize: '13px' }}>Route Distance</span>
            <span style={{ color: '#60a5fa', fontWeight: 'bold' }}>{routeInfo.distance || routeDistance} km</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: 'rgba(51, 65, 85, 0.4)', borderRadius: '8px' }}>
            <span style={{ color: '#9ca3af', fontSize: '13px' }}>Base ETA</span>
            <span style={{ color: '#60a5fa', fontWeight: 'bold' }}>{routeInfo.duration ? `${routeInfo.duration} min` : 'n/a'}</span>
          </div>
          {hasLiveTrafficData && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: 'rgba(51, 65, 85, 0.4)', borderRadius: '8px' }}>
              <span style={{ color: '#9ca3af', fontSize: '13px' }}>Live Traffic ETA</span>
              <span style={{ color: trafficColor, fontWeight: 'bold' }}>
                {routeInfo.durationInTraffic ? `${routeInfo.durationInTraffic} min` : 'n/a'}
              </span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: 'rgba(51, 65, 85, 0.4)', borderRadius: '8px' }}>
            <span style={{ color: '#9ca3af', fontSize: '13px' }}>SOC-Adjusted ETA</span>
            <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>
              {socAdjustedDuration ? `${socAdjustedDuration} min` : 'n/a'}
            </span>
          </div>
          {hasLiveTrafficData && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: 'rgba(51, 65, 85, 0.4)', borderRadius: '8px' }}>
              <span style={{ color: '#9ca3af', fontSize: '13px' }}>Traffic Delay</span>
              <span style={{ color: routeInfo.delayMinutes > 0 ? '#f59e0b' : '#10b981', fontWeight: 'bold' }}>
                {routeInfo.delayMinutes ? `+${routeInfo.delayMinutes} min` : '0 min'}
              </span>
            </div>
          )}
          {hasLiveTrafficData && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: 'rgba(51, 65, 85, 0.4)', borderRadius: '8px' }}>
              <span style={{ color: '#9ca3af', fontSize: '13px' }}>Traffic Distance</span>
              <span style={{ color: trafficColor, fontWeight: 'bold' }}>
                {routeInfo.effectiveDistance || routeDistance} km
              </span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: 'rgba(51, 65, 85, 0.4)', borderRadius: '8px' }}>
            <span style={{ color: '#9ca3af', fontSize: '13px' }}>SOC-Adjusted Distance</span>
            <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>
              {socAdjustedDistance} km
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: 'rgba(51, 65, 85, 0.4)', borderRadius: '8px' }}>
            <span style={{ color: '#9ca3af', fontSize: '13px' }}>DTE vs SOC Distance</span>
            <span style={{ color: getStatusColor(dteStatus), fontWeight: 'bold', fontSize: '12px' }}>
              {dte}km / {socAdjustedDistance}km
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: 'rgba(51, 65, 85, 0.4)', borderRadius: '8px' }}>
            <span style={{ color: '#9ca3af', fontSize: '13px' }}>SOC Impact Factor</span>
            <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>
              +{(routeInfo.socAdjustmentFactor * 100).toFixed(1)}%
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: 'rgba(51, 65, 85, 0.4)', borderRadius: '8px' }}>
            <span style={{ color: '#9ca3af', fontSize: '13px' }}>Routes Evaluated</span>
            <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>
              {routeInfo.alternativesEvaluated || 1}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: 'rgba(51, 65, 85, 0.4)', borderRadius: '8px' }}>
            <span style={{ color: '#9ca3af', fontSize: '13px' }}>Traffic Source</span>
            <span style={{ color: '#38bdf8', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '12px' }}>
              {routeInfo.routeProvider || 'n/a'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: 'rgba(51, 65, 85, 0.4)', borderRadius: '8px' }}>
            <span style={{ color: '#9ca3af', fontSize: '13px' }}>Feasibility</span>
            <span style={{ color: getStatusColor(dteStatus), fontWeight: 'bold', textTransform: 'uppercase', fontSize: '12px' }}>
              {dteStatus === 'safe' ? 'Safe' : dteStatus === 'critical' ? 'Critical' : 'Impossible'}
            </span>
          </div>
        </div>
      </div>

      <div style={{
        background: 'linear-gradient(160deg, rgba(8, 10, 14, 0.96) 0%, rgba(2, 3, 6, 0.96) 100%)',
        border: `2px solid ${getStatusColor(dteStatus)}`,
        borderRadius: '12px',
        padding: '24px',
        boxShadow: `0 10px 30px ${getStatusColor(dteStatus)}22`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: getStatusColor(dteStatus) }}>Charging Recommendation</h3>
          <span style={{ fontSize: '11px', color: getStatusColor(dteStatus), letterSpacing: '0.1em', textTransform: 'uppercase', border: `1px solid ${getStatusColor(dteStatus)}99`, borderRadius: '9999px', padding: '4px 10px' }}>
            Charge
          </span>
        </div>
        <p style={{ fontSize: '14px', color: '#d1d5db' }}>
          {dteStatus === 'safe'
            ? 'Battery level is sufficient for the trip under current traffic.'
            : dteStatus === 'critical'
              ? 'Traffic load reduces margin. Charging before departure is recommended.'
              : 'Immediate charging is required for this route under live traffic.'}
        </p>
        <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'rgba(51, 65, 85, 0.4)', borderRadius: '8px' }}>
          <p style={{ fontSize: '12px', color: '#9ca3af' }}>
            Current SOC: <span style={{ color: '#60a5fa', fontWeight: 'bold' }}>{socSlider}%</span>
          </p>
          <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '8px' }}>
            Congestion Ratio: <span style={{ color: trafficColor, fontWeight: 'bold' }}>{routeInfo.congestionRatio}x</span>
          </p>
        </div>
      </div>

      <div style={{
        background: 'linear-gradient(160deg, rgba(8, 10, 14, 0.96) 0%, rgba(2, 3, 6, 0.96) 100%)',
        border: `1px solid ${getSOHColor(soh)}`,
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.45)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: 'white' }}>State of Health (SOH)</h3>
          <span style={{ fontSize: '11px', color: '#38bdf8', letterSpacing: '0.1em', textTransform: 'uppercase', border: '1px solid rgba(56, 189, 248, 0.45)', borderRadius: '9999px', padding: '4px 10px' }}>
            Health
          </span>
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
            <span style={{ color: '#60a5fa' }}>{healthMetrics.tempPenalty.toFixed(1)}%</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', backgroundColor: 'rgba(51, 65, 85, 0.3)', borderRadius: '6px' }}>
            <span>Cell Imbalance Risk</span>
            <span style={{ color: healthMetrics.imbalancePenalty > 5 ? '#f59e0b' : '#10b981' }}>
              {healthMetrics.imbalancePenalty.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
