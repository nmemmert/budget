import { NextRequest, NextResponse } from 'next/server';
import { FileStorageService } from '@/lib/fileStorage';

export async function POST(request: NextRequest) {
  const token = request.headers.get('x-session-token');
  if (token) await FileStorageService.deleteSession(token);
  return NextResponse.json({ success: true });
}
