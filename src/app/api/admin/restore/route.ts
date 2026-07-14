import { NextRequest, NextResponse } from 'next/server';
import { FileStorageService } from '@/lib/fileStorage';
import { extractTarGz } from '@/lib/tarball';
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.join(process.cwd(), 'data');

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('x-session-token');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const session = await FileStorageService.validateSession(token);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get('backup') as File | null;
    if (!file) return NextResponse.json({ error: 'No backup file provided' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());

    // Backup current data before overwriting
    const backupPath = DATA_DIR + '.bak';
    if (fs.existsSync(DATA_DIR)) {
      if (fs.existsSync(backupPath)) fs.rmSync(backupPath, { recursive: true });
      fs.cpSync(DATA_DIR, backupPath, { recursive: true });
    }

    fs.mkdirSync(DATA_DIR, { recursive: true });
    await extractTarGz(buffer, DATA_DIR);

    return NextResponse.json({ success: true, message: 'Restore complete. Please sign in again.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Restore failed' }, { status: 500 });
  }
}
