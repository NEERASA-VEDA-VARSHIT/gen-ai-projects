import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get('name');
  if (!name) {
    return new NextResponse('Missing name parameter', { status: 400 });
  }

  const safeName = path.basename(name).replace(/[^a-zA-Z0-9_-]/g, '');
  const filePath = path.resolve(process.cwd(), 'screenshots', `${safeName}.png`);

  if (!fs.existsSync(filePath)) {
    return new NextResponse('Screenshot not found', { status: 404 });
  }

  const imageBuffer = fs.readFileSync(filePath);
  return new NextResponse(imageBuffer, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
