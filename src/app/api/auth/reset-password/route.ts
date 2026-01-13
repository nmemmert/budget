import { NextRequest, NextResponse } from 'next/server';
import { FileStorageService } from '@/lib/fileStorage';

export async function POST(request: NextRequest) {
  try {
    const { email, code, newPassword } = await request.json();

    if (!email || !newPassword) {
      return NextResponse.json(
        { error: 'Email and new password are required' },
        { status: 400 }
      );
    }

    // In production, validate that code matches a sent reset token
    // For now, we accept any code for testing purposes
    if (!code) {
      return NextResponse.json(
        { error: 'Reset code is required' },
        { status: 400 }
      );
    }

    // Reset password for user
    await FileStorageService.resetPassword(email, newPassword);

    return NextResponse.json({ success: true, message: 'Password reset successfully' });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Password reset failed' },
      { status: 500 }
    );
  }
}
