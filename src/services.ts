export interface BackupConfig {
  mainFile: string;
  snapshotPrefix?: string;
  staleAfterHours: number;
}

export interface ServiceConfig {
  id: string;
  name: string;
  description: string;
  emoji: string;
  /** 웹 서비스 주소. 데스크톱 앱은 없다 */
  url?: string;
  /** 설치 파일 받는 곳 */
  downloadUrl?: string;
  repoUrl: string;
  /** appDataFolder 에 백업하는 서비스만 */
  backup?: BackupConfig;
}

export const SERVICES: ServiceConfig[] = [
  {
    id: 'novel-bunker',
    name: '노벨벙커',
    description: '소설 작문 에디터',
    emoji: '📖',
    url: 'https://novel.park-bible.com',
    repoUrl: 'https://github.com/ParkBible/Novel-Bunker',
    backup: {
      mainFile: 'novelbunker-data.json',
      snapshotPrefix: 'novelbunker-snapshot-',
      staleAfterHours: 72,
    },
  },
  {
    id: 'recipe-note',
    name: '레시피노트',
    description: '레시피 저장·추천',
    emoji: '🍳',
    url: 'https://recipe.park-bible.com',
    repoUrl: 'https://github.com/ParkBible/Recipe-Note',
    backup: {
      mainFile: 'recipe-note-data.json',
      // 변경이 있을 때만 업로드하므로 한동안 안 쓰면 시각이 멈춘다
      staleAfterHours: 24 * 14,
    },
  },
  {
    id: 'memo-note',
    name: '메모장',
    description: '마크다운 서식 메모',
    emoji: '📝',
    url: 'https://memo.park-bible.com',
    repoUrl: 'https://github.com/ParkBible/Memo-Note',
    backup: {
      mainFile: 'memo-note-data.json',
      // 변경이 있을 때만 업로드하므로 한동안 안 쓰면 시각이 멈춘다
      staleAfterHours: 24 * 14,
    },
  },
  {
    id: 'pie-planner',
    name: '생활계획표',
    description: '24시간 파이형 생활계획표 (Windows 앱)',
    emoji: '🕒',
    downloadUrl: 'https://github.com/ParkBible/Pie-Planner/releases/latest',
    repoUrl: 'https://github.com/ParkBible/Pie-Planner',
  },
];
