import { NextRequest, NextResponse } from 'next/server';
import { FileStorageService } from '@/lib/fileStorage';

// POST /api/auth/reset-password/request — generate a reset token for an email
// POST /api/auth/reset-password — consume a token and set a new password
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.action === 'request') {
      const { email } = body;
      if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });

      try {
        const token = await FileStorageService.generatePasswordResetToken(email);
        // In production this token would be emailed. For self-hosted use we return it directly.
        return NextResponse.json({ success: true, resetToken: token, message: 'Use the resetToken to set your new password.' });
      } catch {
        // Return success either way to avoid email enumeration
        return NextResponse.json({ success: true, message: 'If that email exists, a reset token has been generated.' });
      }
    }

    // action === 'reset' (default)
    const { token, newPassword } = body;
    if (!token || !newPassword) {
      return NextResponse.json({ error: 'Token and new password are required' }, { status: 400 });
    }

    await FileStorageService.resetPassword(token, newPassword);
    return NextResponse.json({ success: true, message: 'Password reset successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Password reset failed' }, { status: 400 });
  }
}
