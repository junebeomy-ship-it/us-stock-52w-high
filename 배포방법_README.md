# us-stock-52w-high — 미국·한국·일본 52주 신고가 스크리너

미국(S&P 500), 한국(코스피·코스닥 전 종목), 일본(도쿄증권거래소 프라임/스탠다드/그로스 전 종목) 중
52주 최고가에 근접(97% 이상)했거나 새로 경신한 종목을 보여주는 Next.js 웹앱입니다.
일본·미국 종목은 Yahoo가 주는 영어 이름을, 한국(KRW) 종목은 저장된 한글 이름을 표시합니다.

## 구성
- 데이터: `src/data/`에 종목 목록이 포함되어 있습니다.
  - `sp500.json` (미국, 약 500개)
  - `krx.json` (한국 코스피·코스닥, 약 2,600개)
  - `jpx.json` (일본 TSE, 약 3,500개)
- 시세 조회 로직: `src/lib/screener.ts` (Yahoo Finance 비공식 API)
- 화면: `src/app/page.tsx`, API 라우트: `src/app/api/screener/{us,kr,jp}/route.ts`

## 배포 (GitHub 자동배포)
이 저장소는 이미 Vercel 프로젝트 `us-stock-52w-high`에 연결되어 있습니다.
`main` 브랜치에 커밋하면 Vercel이 자동으로 다시 배포합니다.
새로 연결하려면: Vercel → 프로젝트 → Settings → Git 에서 이 저장소를 Connect 하세요.

## 로컬 실행
```
npm install
npm run dev
```
http://localhost:3000 접속.

## 참고
- 데이터 출처: Yahoo Finance(비공식). 투자 판단 참고용이며 투자 조언이 아닙니다.
