import { Controller, Get, Header } from '@nestjs/common';
import { AppService } from './app.service';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHealth() {
    return this.appService.getApiStatus();
  }

  /** JSON — use from fetch, curl, or browser (shows raw JSON). */
  @Get('db-health')
  async getDbHealth() {
    const db = await this.appService.getDatabaseStatus();
    return {
      ...this.appService.getApiStatus(),
      db,
    };
  }

  /** HTML — open in the browser for a clear pass/fail view. */
  @Get('db-check')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async getDbCheckPage() {
    const api = this.appService.getApiStatus();
    const db = await this.appService.getDatabaseStatus();
    const ok = db.connected;
    const title = ok ? 'Database connected' : 'Database connection failed';
    const accent = ok ? '#16a34a' : '#dc2626';
    const detailRows: string[] = [];
    if (db.latencyMs != null) {
      detailRows.push(
        `<tr><th>Round-trip</th><td>${escapeHtml(String(db.latencyMs))} ms</td></tr>`,
      );
    }
    if (db.serverTime != null) {
      detailRows.push(
        `<tr><th>SQL Server time</th><td>${escapeHtml(db.serverTime)}</td></tr>`,
      );
    }
    if (db.error) {
      detailRows.push(
        `<tr><th>Error</th><td><pre style="white-space:pre-wrap;margin:0;font-size:12px">${escapeHtml(db.error)}</pre></td></tr>`,
      );
    }
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 42rem; margin: 2rem auto; padding: 0 1rem; color: #111; }
    h1 { font-size: 1.25rem; border-left: 4px solid ${accent}; padding-left: 0.75rem; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; font-size: 0.9rem; }
    th, td { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid #e5e5e5; vertical-align: top; }
    th { width: 10rem; color: #525252; font-weight: 600; }
    code { font-size: 0.85rem; background: #f5f5f5; padding: 0.15rem 0.35rem; border-radius: 4px; }
    a { color: #2563eb; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>Use this page to confirm the Nest app can reach MSSQL / Azure SQL.</p>
  <table>
    <tr><th>Status</th><td><strong style="color:${accent}">${ok ? 'OK' : 'FAILED'}</strong></td></tr>
    <tr><th>API</th><td>${escapeHtml(api.service)}</td></tr>
    <tr><th>Checked at</th><td>${escapeHtml(api.timestamp)}</td></tr>
    ${detailRows.join('\n    ')}
  </table>
  <p style="margin-top:1.5rem;font-size:0.85rem;color:#737373">
    JSON: <a href="./db-health"><code>/api/db-health</code></a>
  </p>
</body>
</html>`;
  }
}
