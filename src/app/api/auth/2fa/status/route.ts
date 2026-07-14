import { NextRequest, NextResponse } from 'next/server';
import { FileStorageService } from '@/lib/fileStorage';

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('x-session-token');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const session = await FileStorageService.validateSession(token);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const enabled = await FileStorageService.get2FAStatus(session.userId);
    return NextResponse.json({ enabled });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
