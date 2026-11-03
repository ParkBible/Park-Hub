import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { AuthRequiredError, fetchBackupStatuses, type BackupHealth, type BackupStatus } from './drive';
import { formatBytes, formatDateTime, timeAgo } from './format';
import { SERVICES, type ServiceConfig } from './services';
import { login, useSession } from './session';
import styles from './App.module.css';

const HEALTH_LABEL: Record<BackupHealth, string> = {
  fresh: '최신',
  stale: '오래됨',
  missing: '백업 없음',
};

const AUTH_MESSAGE: Record<string, string> = {
  denied: '허용되지 않은 구글 계정이에요.',
  error: '로그인 중 문제가 생겼어요. 다시 시도해 주세요.',
};

function readAuthNotice(): string | null {
  const reason = new URLSearchParams(window.location.search).get('auth');
  if (!reason) return null;
  window.history.replaceState(null, '', window.location.pathname);
  return AUTH_MESSAGE[reason] ?? AUTH_MESSAGE.error;
}

type LoadState =
  | { state: 'idle' }
  | { state: 'loading'; previous: Record<string, BackupStatus> | null }
  | { state: 'loaded'; statuses: Record<string, BackupStatus>; checkedAt: Date }
  | { state: 'error'; message: string };

export function App() {
  const { session, signOut, expire } = useSession();
  const [notice] = useState(readAuthNotice);
  const [load, setLoad] = useState<LoadState>({ state: 'idle' });

  const refresh = useCallback(async () => {
    setLoad((current) => ({ state: 'loading', previous: current.state === 'loaded' ? current.statuses : null }));
    try {
      const statuses = await fetchBackupStatuses(SERVICES);
      setLoad({ state: 'loaded', statuses, checkedAt: new Date() });
    } catch (error) {
      if (error instanceof AuthRequiredError) {
        expire();
        setLoad({ state: 'idle' });
        return;
      }
      setLoad({ state: 'error', message: error instanceof Error ? error.message : '백업 상태를 불러오지 못했어요.' });
    }
  }, [expire]);

  const signedIn = session.state === 'signedIn';
  useEffect(() => {
    if (signedIn) void refresh();
  }, [signedIn, refresh]);

  const statuses = load.state === 'loaded' ? load.statuses : load.state === 'loading' ? load.previous : null;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Park-Hub</h1>
          <p className={styles.subtitle}>
            내 서비스 모음 · 구글 드라이브 백업 상태<span className={styles.cursor} aria-hidden>_</span>
          </p>
        </div>
        <div className={styles.account}>
          {session.state === 'signedIn' && (
            <>
              <span className={styles.email}>{session.email}</span>
              <button className={styles.ghostButton} onClick={() => void signOut()}>
                로그아웃
              </button>
            </>
          )}
          {session.state === 'signedOut' && (
            <button className={styles.primaryButton} onClick={login}>
              구글로 로그인
            </button>
          )}
        </div>
      </header>

      {notice && <p className={styles.alert}>{notice}</p>}

      <main>
        <div className={styles.toolbar}>
          <p className={styles.toolbarText}>
            <span className={styles.prompt} aria-hidden>
              C:\PARK&gt;
            </span>
            {session.state === 'signedIn'
              ? load.state === 'loaded'
                ? `${timeAgo(load.checkedAt)} 확인`
                : load.state === 'error'
                  ? load.message
                  : '확인하는 중…'
              : session.state === 'disabled'
                ? '서버에 로그인 설정이 없어 백업 상태를 볼 수 없어요.'
                : session.state === 'signedOut'
                  ? '로그인하면 각 서비스의 백업 상태가 보여요.'
                  : ''}
          </p>
          {signedIn && (
            <button className={styles.ghostButton} onClick={() => void refresh()} disabled={load.state === 'loading'}>
              새로고침
            </button>
          )}
        </div>

        <ul className={styles.grid}>
          {SERVICES.map((service, index) => (
            <ServiceCard
              key={service.id}
              service={service}
              accent={RETRO_ACCENTS[index % RETRO_ACCENTS.length]}
              status={signedIn ? (statuses?.[service.id] ?? null) : null}
            />
          ))}
        </ul>
      </main>

      <footer className={styles.footer}>
        드라이브에 올라간 시각 기준이에요. 각 기기에서 아직 업로드되지 않은 변경은 여기서 보이지 않아요.
      </footer>
    </div>
  );
}

const RETRO_ACCENTS = ['var(--color-retro-1)', 'var(--color-retro-2)', 'var(--color-retro-3)', 'var(--color-retro-4)'];

function ServiceCard({ service, status, accent }: { service: ServiceConfig; status: BackupStatus | null; accent: string }) {
  return (
    <li className={styles.card} style={{ '--accent': accent } as CSSProperties}>
      <div className={styles.titleBar} aria-hidden>
        <span className={styles.titleBarName}>{service.id}.exe</span>
        <span className={styles.windowButtons}>
          <span />
          <span />
          <span />
        </span>
      </div>
      <div className={styles.cardHead}>
        <span className={styles.emoji} aria-hidden>
          {service.emoji}
        </span>
        <div className={styles.cardTitleBox}>
          <h2 className={styles.cardTitle}>{service.name}</h2>
          <p className={styles.cardDescription}>{service.description}</p>
        </div>
        {status && (
          <span className={`${styles.badge} ${styles[status.health]}`}>
            <span className={styles.led} aria-hidden />
            {HEALTH_LABEL[status.health]}
          </span>
        )}
      </div>

      {status && (
        <dl className={styles.stats}>
          <div>
            <dt>마지막 백업</dt>
            <dd title={status.modifiedAt ? formatDateTime(status.modifiedAt) : undefined}>
              {status.modifiedAt ? timeAgo(status.modifiedAt) : '—'}
            </dd>
          </div>
          <div>
            <dt>크기</dt>
            <dd>{status.sizeBytes !== null ? formatBytes(status.sizeBytes) : '—'}</dd>
          </div>
          {status.snapshotCount !== null && (
            <div>
              <dt>스냅샷</dt>
              <dd title={status.latestSnapshotAt ? `최근 ${formatDateTime(status.latestSnapshotAt)}` : undefined}>
                {status.snapshotCount}개
              </dd>
            </div>
          )}
        </dl>
      )}

      <div className={styles.cardActions}>
        {service.url && (
          <a className={styles.primaryButton} href={service.url} target="_blank" rel="noreferrer">
            열기
          </a>
        )}
        {service.downloadUrl && (
          <a className={styles.primaryButton} href={service.downloadUrl} target="_blank" rel="noreferrer">
            다운로드
          </a>
        )}
        <a className={styles.ghostButton} href={service.repoUrl} target="_blank" rel="noreferrer">
          GitHub
        </a>
      </div>
    </li>
  );
}
