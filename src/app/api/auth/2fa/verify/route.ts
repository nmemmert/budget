import { NextRequest, NextResponse } from 'next/server';
import { FileStorageService } from '@/lib/fileStorage';

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('x-session-token');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const session = await FileStorageService.validateSession(token);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { code } = await request.json();
    if (!code) return NextResponse.json({ error: 'Code required' }, { status: 400 });

    await FileStorageService.enable2FA(session.userId, code);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Verification failed' }, { status: 400 });
  }
}
