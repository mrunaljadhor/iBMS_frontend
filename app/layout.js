import './globals.css'

export const metadata = {
  title: 'iBMS FOR EVs - Intelligent Battery Management',
  description: 'Local EV battery intelligence dashboard with SOC, SOH, RUL, route feasibility, and predictive analytics',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-gray-100">
        {children}
      </body>
    </html>
  )
}
