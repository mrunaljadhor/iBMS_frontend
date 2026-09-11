import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const locations = searchParams.get('locations');

  if (!locations) {
    return NextResponse.json({ error: 'Locations parameter is required' }, { status: 400 });
  }

  try {
    const response = await fetch(`https://api.opentopodata.org/v1/srtm90m?locations=${locations}`, {
      // Use cache: 'no-store' if we want to ensure fresh fetches, but caching topography is actually fine
      next: { revalidate: 3600 } 
    });
    
    if (!response.ok) {
      throw new Error(`OpenTopoData returned status ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("OpenTopoData Proxy Error:", error);
    return NextResponse.json({ error: 'Failed to fetch elevation data' }, { status: 500 });
  }
}
