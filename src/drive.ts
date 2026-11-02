import type { ServiceConfig } from './services';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';

export class AuthRequiredError extends Error {}

interface DriveFile {
  name: string;
  modifiedTime: string;
  size?: string;
}

export type BackupHealth = 'fresh' | 'stale' | 'missing';

export interface BackupStatus {
  health: BackupHealth;
  modifiedAt: Date | null;
  sizeBytes: number | null;
  snapshotCount: number | null;
  latestSnapshotAt: Date | null;
}

let cachedToken: { token: string; expiresAt: number } | undefined;

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt - 60_000 > Date.now()) return cachedToken.token;
  const res = await fetch('/api/auth/token', { method: 'POST' });
  if (res.status === 401) throw new AuthRequiredError('다시 로그인해 주세요.');
  if (!res.ok) throw new Error('드라이브 인증에 실패했어요.');
  const { accessToken: token, expiresIn } = (await res.json()) as { accessToken: string; expiresIn: number };
  cachedToken = { token, expiresAt: Date.now() + expiresIn * 1000 };
  return token;
}

export const forgetAccessToken = () => {
  cachedToken = undefined;
};

async function listAppDataFiles(): Promise<DriveFile[]> {
  const files: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      spaces: 'appDataFolder',
      fields: 'nextPageToken,files(name,modifiedTime,size)',
      pageSize: '1000',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const res = await fetch(`${DRIVE_API}/files?${params}`, {
      headers: { Authorization: `Bearer ${await accessToken()}` },
    });
    if (res.status === 401) {
      forgetAccessToken();
      throw new AuthRequiredError('드라이브 인증이 만료됐어요. 다시 로그인해 주세요.');
    }
    if (!res.ok) throw new Error(`드라이브 요청에 실패했어요. (${res.status})`);
    const page = (await res.json()) as { files?: DriveFile[]; nextPageToken?: string };
    files.push(...(page.files ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken);
  return files;
}

const latest = (files: DriveFile[]) =>
  files.reduce<DriveFile | null>((acc, file) => (!acc || file.modifiedTime > acc.modifiedTime ? file : acc), null);

export function summarize(service: ServiceConfig, files: DriveFile[], now = Date.now()): BackupStatus {
  const main = latest(files.filter((file) => file.name === service.mainFile));
  const snapshots = service.snapshotPrefix ? files.filter((file) => file.name.startsWith(service.snapshotPrefix!)) : null;
  const latestSnapshot = snapshots ? latest(snapshots) : null;

  const modifiedAt = main ? new Date(main.modifiedTime) : null;
  const health: BackupHealth = !modifiedAt
    ? 'missing'
    : now - modifiedAt.getTime() > service.staleAfterHours * 3_600_000
      ? 'stale'
      : 'fresh';

  return {
    health,
    modifiedAt,
    sizeBytes: main?.size ? Number(main.size) : null,
    snapshotCount: snapshots ? snapshots.length : null,
    latestSnapshotAt: latestSnapshot ? new Date(latestSnapshot.modifiedTime) : null,
  };
}

export async function fetchBackupStatuses(services: ServiceConfig[]): Promise<Record<string, BackupStatus>> {
  const files = await listAppDataFiles();
  return Object.fromEntries(services.map((service) => [service.id, summarize(service, files)]));
}
