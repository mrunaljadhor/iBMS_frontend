'use client'

import Link from 'next/link'

export default function Navbar() {
  return (
    <nav className="bg-gray-900 border-b border-gray-800 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">⚡</span>
          <Link href="/" className="text-xl font-bold text-blue-400 hover:text-blue-300">
            Trinity iBMS
          </Link>
        </div>
        
        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-gray-400 hover:text-white transition">Features</a>
          <a href="#docs" className="text-gray-400 hover:text-white transition">Docs</a>
          <a href="#api" className="text-gray-400 hover:text-white transition">API</a>
        </div>

        <div className="flex items-center gap-4">
          <a href="https://github.com" className="text-gray-400 hover:text-white">
            GitHub
          </a>
          <a href="https://vercel.com" className="text-gray-400 hover:text-white">
            Vercel
          </a>
        </div>
      </div>
    </nav>
  )
}
