# us-stock-52w-high — 일본 종목명 영어 수정본

이 폴더는 잃어버린 원본 소스를 Vercel 배포본에서 복구하고, **일본 종목명을 영어로** 표시하도록 고친 전체 프로젝트입니다. (한국은 한글 그대로 유지)

## 무엇이 바뀌었나
- `src/lib/screener.ts` 의 종목명 처리 부분만 수정했습니다.
  일본·미국 종목은 Yahoo가 주는 영어 이름(`longName`)을 쓰고, 한국(KRW) 종목은 저장된 한글 이름을 유지합니다.
- 나머지 코드는 원본과 동일하게 복구했습니다.

## ⚠️ 먼저 할 일: 데이터 파일 3개 넣기
`src/data/` 폴더가 비어 있습니다. 용량이 커서 자동 복구가 안 됐습니다.
`src/data/README_데이터파일_넣기.md` 안내대로 Vercel에서 `jpx.json`, `krx.json`, `sp500.json`을
내려받아 `src/data/` 에 넣어주세요. (3개가 있어야 앱이 빌드됩니다)

## 배포 방법 (GitHub 자동배포)

### 1) GitHub에 새 저장소 만들기
1. https://github.com/new 접속
2. Repository name 입력(예: `us-stock-52w-high`), Public 또는 Private 선택 → **Create repository**

### 2) 이 프로젝트를 저장소에 올리기
새 저장소 화면에서 **uploading an existing file** 링크 클릭 →
이 폴더 안의 **모든 파일·폴더를 통째로 드래그**해서 올린 뒤 **Commit changes** 클릭.
(데이터 파일 3개를 `src/data/`에 넣은 뒤 올려야 합니다)

### 3) Vercel에 연결
- 기존 주소(us-stock-52w-high.vercel.app)를 그대로 쓰려면:
  Vercel → `us-stock-52w-high` 프로젝트 → **Settings → Git** →
  현재 연결된 `DAOLRC`를 **Disconnect** 한 뒤, 방금 만든 새 저장소를 **Connect**.
  그런 다음 **Deployments**에서 **Redeploy** 하거나, 저장소에 커밋하면 자동 배포됩니다.
- 또는 새 주소로 써도 되면: Vercel → **Add New → Project → Import** 로 새 저장소를 가져오면 됩니다.

### 4) 이후 수정
저장소의 파일을 고치고 커밋하면 Vercel이 자동으로 다시 배포합니다.

## 로컬에서 확인하려면 (선택)
```
npm install
npm run dev
```
http://localhost:3000 접속.
