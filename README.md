# Park-Hub

내 서비스(노벨벙커·레시피노트 등)로 가는 링크와, 각 서비스의 구글 드라이브 백업이 최신인지 보여주는 한 장짜리 대시보드.

## 동작
- 구글 로그인(`drive.appdata` 스코프) 후 `appDataFolder` 파일 목록을 한 번 읽어 서비스별 마지막 백업 시각·크기·스냅샷 수를 보여준다. 읽기 전용.
- **노벨벙커·레시피노트와 같은 OAuth 클라이언트**를 써야 두 앱의 백업 파일이 보인다.
- 드라이브에 올라간 시각 기준이라, 각 기기에서 아직 업로드되지 않은 변경은 알 수 없다.

## 서비스 추가
`src/services.ts` 의 `SERVICES` 에 항목 하나를 추가한다. 새 서비스도 같은 OAuth 클라이언트로 `appDataFolder` 에 백업해야 상태가 잡힌다.

## 실행
```bash
cp .env.example .env   # 값 채우기
npm install
npm run dev            # http://localhost:5180
```

구글 클라우드 콘솔에서 해당 OAuth 클라이언트에 리디렉션 URI 추가:
- `http://localhost:5180/api/auth/callback`
- `https://<배포 도메인>/api/auth/callback`

## 배포 (Vercel)
레포 연결 후 환경변수 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ALLOWED_EMAILS`, `SESSION_SECRET`, `APP_ORIGIN` 설정.
