import { NextRequest, NextResponse } from 'next/server';
import { FileStorageService } from '@/lib/fileStorage';

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('x-session-token');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const session = await FileStorageService.validateSession(token);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const shareId = request.nextUrl.searchParams.get('shareId');
    if (!shareId) return NextResponse.json({ error: 'Missing shareId' }, { status: 400 });

    const data = await FileStorageService.getShareData(shareId, session.email);
    if (!data) return NextResponse.json({ error: 'Share not found or access denied' }, { status: 404 });

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load shared data' }, { status: 500 });
  }
}
