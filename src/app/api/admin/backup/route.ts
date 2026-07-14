import { NextRequest, NextResponse } from 'next/server';
import { FileStorageService } from '@/lib/fileStorage';
import { buildTarGz } from '@/lib/tarball';
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.join(process.cwd(), 'data');

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('x-session-token');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const session = await FileStorageService.validateSession(token);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!fs.existsSync(DATA_DIR)) {
      return NextResponse.json({ error: 'No data directory found' }, { status: 404 });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `capsule-backup-${timestamp}.tar.gz`;
    const body = buildTarGz(DATA_DIR);

    return new NextResponse(body as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/gzip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': body.length.toString(),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Backup failed' }, { status: 500 });
  }
}
