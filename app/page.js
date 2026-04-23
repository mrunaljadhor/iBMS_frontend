'use client'

import { useState, useEffect } from 'react'
import ProfessionalDashboard from './components/ProfessionalDashboard'

export default function Home() {
  const [showIntro, setShowIntro] = useState(true)

  useEffect(() => {
    console.log('iBMS FOR EVs dashboard loaded')

    const introTimer = setTimeout(() => {
      setShowIntro(false)
    }, 7000)

    return () => clearTimeout(introTimer)
  }, [])

  if (showIntro) {
    return (
      <div style={introStyles.container}>
        <div style={introStyles.logoWrap}>
          <div style={introStyles.orbitRing} className="orbit-ring" />
          <div style={introStyles.innerLogo}>
            <div style={introStyles.batteryBody}>
              <div style={introStyles.batteryCap} />
              <div style={introStyles.batteryFill} className="battery-fill" />
              <div style={introStyles.bolt}>
                <span style={introStyles.boltText}>⚡</span>
              </div>
            </div>
          </div>
        </div>

        <h1 style={introStyles.title}>iBMS Dashboard</h1>
        <p style={introStyles.subtitle}>Intelligent EV Battery Analytics</p>

        <div style={introStyles.progressTrack}>
          <div style={introStyles.progressFill} className="progress-fill" />
        </div>

        <p style={introStyles.footnote}>Initializing modules...</p>

        <style jsx>{`
          .orbit-ring {
            animation: spin 2.8s linear infinite;
          }

          .battery-fill {
            animation: charge 1.6s ease-in-out infinite;
          }

          .progress-fill {
            animation: load 7s linear forwards;
          }

          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }

          @keyframes charge {
            0%, 100% { transform: scaleX(0.45); opacity: 0.7; }
            50% { transform: scaleX(1); opacity: 1; }
          }

          @keyframes load {
            from { width: 0%; }
            to { width: 100%; }
          }
        `}</style>
      </div>
    )
  }

  return (
    <div>
      <ProfessionalDashboard />
    </div>
  )
}

const introStyles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'radial-gradient(circle at 20% 20%, #0f172a, #020617 65%)',
    color: '#e2e8f0',
    gap: '10px',
    textAlign: 'center',
    padding: '24px'
  },
  logoWrap: {
    position: 'relative',
    width: '140px',
    height: '140px',
    display: 'grid',
    placeItems: 'center'
  },
  orbitRing: {
    position: 'absolute',
    inset: 0,
    borderRadius: '999px',
    border: '2px dashed rgba(56, 189, 248, 0.6)',
    boxShadow: '0 0 30px rgba(56, 189, 248, 0.3)'
  },
  innerLogo: {
    width: '98px',
    height: '98px',
    borderRadius: '999px',
    background: 'linear-gradient(160deg, #0b1220, #111827)',
    border: '1px solid rgba(148, 163, 184, 0.25)',
    display: 'grid',
    placeItems: 'center',
    boxShadow: '0 12px 35px rgba(2, 132, 199, 0.25)'
  },
  batteryBody: {
    width: '46px',
    height: '62px',
    borderRadius: '10px',
    border: '2px solid #38bdf8',
    position: 'relative',
    overflow: 'hidden',
    display: 'grid',
    placeItems: 'center'
  },
  batteryCap: {
    position: 'absolute',
    top: '-7px',
    width: '16px',
    height: '6px',
    borderRadius: '4px 4px 0 0',
    background: '#38bdf8'
  },
  batteryFill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '80%',
    transformOrigin: 'left center',
    background: 'linear-gradient(90deg, #22d3ee, #3b82f6)'
  },
  bolt: {
    position: 'relative',
    zIndex: 1,
    fontSize: '22px',
    lineHeight: 1
  },
  boltText: {
    filter: 'drop-shadow(0 0 6px rgba(251, 191, 36, 0.8))'
  },
  title: {
    marginTop: '12px',
    marginBottom: '2px',
    fontSize: '34px',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    fontWeight: 800,
    color: '#f8fafc'
  },
  subtitle: {
    margin: 0,
    color: '#94a3b8',
    letterSpacing: '0.04em',
    fontSize: '13px'
  },
  progressTrack: {
    width: '280px',
    maxWidth: '80vw',
    marginTop: '16px',
    height: '7px',
    borderRadius: '999px',
    background: 'rgba(51, 65, 85, 0.65)',
    overflow: 'hidden',
    border: '1px solid rgba(100, 116, 139, 0.35)'
  },
  progressFill: {
    width: '0%',
    height: '100%',
    borderRadius: '999px',
    background: 'linear-gradient(90deg, #22d3ee, #3b82f6)'
  },
  footnote: {
    marginTop: '8px',
    marginBottom: 0,
    fontSize: '12px',
    color: '#64748b'
  }
}
