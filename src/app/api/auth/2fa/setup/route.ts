import { NextRequest, NextResponse } from 'next/server';
import { FileStorageService } from '@/lib/fileStorage';
import QRCode from 'qrcode';

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('x-session-token');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const session = await FileStorageService.validateSession(token);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { secret, otpAuthUrl } = await FileStorageService.setup2FA(session.userId);
    const qrDataUrl = await QRCode.toDataURL(otpAuthUrl, { width: 200, margin: 2 });

    return NextResponse.json({ secret, qrDataUrl });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Setup failed' }, { status: 400 });
  }
}
