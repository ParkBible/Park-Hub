export interface ServiceConfig {
  id: string;
  name: string;
  description: string;
  emoji: string;
  url: string;
  repoUrl: string;
  mainFile: string;
  snapshotPrefix?: string;
  staleAfterHours: number;
}

export const SERVICES: ServiceConfig[] = [
  {
    id: 'novel-bunker',
    name: '노벨벙커',
    description: 'LLM 소설 작문 에디터',
    emoji: '📖',
    url: 'https://novel-bunker.vercel.app',
    repoUrl: 'https://github.com/ParkBible/Novel-Bunker',
    mainFile: 'novelbunker-data.json',
    snapshotPrefix: 'novelbunker-snapshot-',
    staleAfterHours: 72,
  },
  {
    id: 'recipe-note',
    name: '레시피노트',
    description: '레시피 저장·추천',
    emoji: '🍳',
    url: 'https://recipe-note-phi.vercel.app',
    repoUrl: 'https://github.com/ParkBible/Recipe-Note',
    mainFile: 'recipe-note-data.json',
    // 변경이 있을 때만 업로드하므로 한동안 안 쓰면 시각이 멈춘다
    staleAfterHours: 24 * 14,
  },
];
