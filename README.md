# iBMS Frontend - Next.js 14 Dashboard

A modern, interactive battery management system dashboard built with Next.js 14, React, Tailwind CSS, and Google Maps integration.

## Features

- 📊 **Real-time Dashboard** - Live battery metrics and predictions
- 🗺️ **Route Planner** - Google Maps integration for distance and time calculation
- 🔋 **Battery Status** - Detailed SOC, SOH, and health indicators
- 🤖 **AMSA Logic** - Automated Mode Switching Algorithm for drive mode recommendation
- ⚡ **DTE Calculator** - Distance to Empty in ECO and SPORT modes
- 📈 **Charts & Metrics** - Historical data visualization
- 🎨 **Dark Theme UI** - Modern, professional interface
- 📱 **Responsive Design** - Works on desktop and mobile

## Quick Start

### Prerequisites

- Node.js 18+ (or use local installation)
- Google Maps API Key (from Google Cloud Console)
- Backend running on `http://localhost:5001`

### Installation

```bash
cd frontend
npm install
```

### Configuration

**1. Set up environment variables** (`.env.local`):

```env
NEXT_PUBLIC_API_URL=http://localhost:5001
NEXT_PUBLIC_GOOGLE_MAPS_KEY=YOUR_API_KEY_HERE
```

**2. Get Google Maps API Key:**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable these APIs:
   - **Maps JavaScript API**
   - **Directions API**
   - **Distance Matrix API**
4. Create an API key (Unrestricted or add domain restrictions)
5. Add key to `.env.local`

### Running

**Development** (with hot reload):
```bash
npm run dev
# Open http://localhost:3000
```

**Production Build:**
```bash
npm run build
npm start
```

### Deploying to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel
```

Or connect your GitHub repo to Vercel for automatic deployments.

## Project Structure

```
frontend/
├── app/
│   ├── layout.js              # Root layout
│   ├── page.js               # Main dashboard
│   ├── globals.css           # Global styles + Tailwind
│   └── components/
│       ├── Navbar.js         # Navigation bar
│       ├── Dashboard.js      # Main dashboard view
│       ├── BatteryStatus.js  # Battery details
│       ├── MapPlanner.js     # Google Maps integration
│       ├── FeasibilityChecker.js # AMSA decision logic
│       ├── StatCard.js       # Reusable stat card
│       └── ChartComponent.js # Recharts visualization
├── public/                    # Static assets
├── next.config.js            # Next.js configuration
├── tailwind.config.js        # Tailwind CSS config
├── postcss.config.js         # PostCSS config
├── package.json              # Dependencies
├── .env.local               # Environment variables
└── README.md                 # This file
```

## Pages & Components

### Dashboard (`/` - Home)
- System status indicators
- Real-time SOC, voltage, current
- ECO/SPORT mode range estimates
- Historical charts
- Quick action buttons

### Battery Status
- SOC gauge visualization
- Available capacity (Ah, Wh)
- Electrical parameters
- Thermal information
- Battery health status

### Route Planner
- Origin/destination input
- Google Maps route calculation
- Distance and duration
- Embedded route visualization
- Trip history

### Feasibility Checker
- AMSA decision logic
- Route feasibility analysis
- Mode recommendations
- Safety margins
- Test scenarios

## API Integration

### Backend Endpoints Used

```
GET  /health                    Health check
GET  /api/status               System status
POST /api/predict/soc          LSTM SOC prediction
POST /api/predict/dte          Distance to Empty
POST /api/route/distance       Google Maps route distance
POST /api/feasibility          AMSA decision + feasibility
```

### Example API Calls

**Fetch System Status:**
```javascript
const res = await fetch('/api/status')
const data = await res.json()
```

**Calculate DTE:**
```javascript
const res = await fetch('/api/predict/dte', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ current_soc: 75, drive_mode: 'ECO' })
})
const data = await res.json()
// { estimated_range_km: "450.25", ... }
```

**Check Feasibility:**
```javascript
const res = await fetch('/api/feasibility', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    current_soc: 75,
    origin: '28.5355,77.3910',
    destination: '28.7041,77.1025'
  })
})
const data = await res.json()
// { status: 'SAFE', amsa_decision: {...}, ... }
```

## Styling

Uses **Tailwind CSS** for utility-first styling. Custom styles in `app/globals.css`:

- `.card` - Card component
- `.btn` / `.btn-primary` / `.btn-secondary` - Buttons
- `.badge` - Badge components
- `.status-*` - Status colors
- `.grid-auto` - Auto grid layout

## Google Maps Setup Guide

### Step 1: Create Google Cloud Project

1. Go to https://console.cloud.google.com/
2. Click "Select a Project" → "New Project"
3. Enter project name: "Trinity iBMS"
4. Click "Create"

### Step 2: Enable APIs

1. Go to "APIs & Services" → "Library"
2. Search for and enable:
   - **Maps JavaScript API**
   - **Directions API**
   - **Distance Matrix API**
   - **Geocoding API** (optional)

### Step 3: Create API Key

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "API Key"
3. Copy the API key
4. (Optional) Restrict it to:
   - **Application restrictions**: HTTP referrers
   - **API restrictions**: Select enabled APIs

### Step 4: Add to Environment

Add to `.env.local`:
```env
NEXT_PUBLIC_GOOGLE_MAPS_KEY=your_api_key_here
```

### Cost Optimization

- **Set billing alerts** (recommended: $0-$200/month)
- **Restrict API key** to prevent unauthorized use
- **Use Maps Embed API** for simple maps (cheaper)
- **Batch requests** to reduce API calls
- **Cache results** to avoid redundant queries

## Performance Optimization

1. **Code Splitting** - Next.js automatic code splitting
2. **Image Optimization** - Next.js Image component
3. **Font Optimization** - System fonts
4. **API Caching** - Client-side state management
5. **Lazy Loading** - Dynamic imports for heavy components

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | ✅ | - | Backend server URL |
| `NEXT_PUBLIC_GOOGLE_MAPS_KEY` | ✅ | - | Google Maps API key |
| `NEXT_PUBLIC_APP_NAME` | ❌ | Trinity iBMS | App name |
| `NEXT_PUBLIC_DEFAULT_LAT` | ❌ | 28.5355 | Default map latitude |
| `NEXT_PUBLIC_DEFAULT_LNG` | ❌ | 77.3910 | Default map longitude |

## Troubleshooting

### Google Maps Not Loading
- **Problem**: Maps embed shows blank
- **Solution**: Check `NEXT_PUBLIC_GOOGLE_MAPS_KEY` is set and valid

### Backend Connection Failed
- **Problem**: 500 errors from API calls
- **Solution**: Verify backend running on `http://localhost:5001`

### Styling Not Applied
- **Problem**: Tailwind classes not working
- **Solution**: Run `npm run build` and restart dev server

## Testing

Manual testing checklist:

- [ ] Dashboard loads with live data
- [ ] Battery status updates every 5s
- [ ] Route calculations work with different coordinates
- [ ] AMSA logic correctly categorizes routes
- [ ] Google Maps embeds load without errors
- [ ] Responsive design on mobile (375px+)
- [ ] All buttons and forms functional

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile Safari 14+

## Deployment Checklist

- [ ] `.env.local` configured with production values
- [ ] Google Maps API key set with domain restrictions
- [ ] Backend URL updated to production
- [ ] `npm run build` succeeds without errors
- [ ] All pages load without 404s
- [ ] Google Maps loads on production domain

## Next Steps

1. **Integrate Real-Time Data** - Connect to real battery hardware
2. **Add Authentication** - User login/accounts
3. **Historical Data Storage** - Database for trip history
4. **Push Notifications** - Alert user of critical battery events
5. **Mobile App** - React Native version
6. **Dark Mode Toggle** - User preference setting

## Support & Documentation

- [Next.js 14 Docs](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Google Maps API](https://developers.google.com/maps)
- [Recharts](https://recharts.org/api)

## License

MIT License - See LICENSE file for details
