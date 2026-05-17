---
id: focus-feed-readme
date: 2026-05-18
tags: [focus-feed, readme]
---

# Focus Feed

`Focus Feed`는 유튜브 채널과 RSS 소스를 하나의 피드로 합쳐 보여주는 `Next.js` 기반 개인 큐레이션 앱입니다. 서버에서 데이터를 수집하고, 클라이언트에서 관심 키워드 필터를 적용해 텍스트 중심으로 빠르게 훑어볼 수 있게 구성되어 있습니다.

## 제품·에이전트 문서 (최신 유지)

| 문서 | 용도 |
|------|------|
| [docs/MILESTONES.md](docs/MILESTONES.md) | 우선순위 마일스톤(M1~M6) |
| [docs/MOBILE_QA_CHECKLIST.md](docs/MOBILE_QA_CHECKLIST.md) | 모바일·PWA 수동 QA 체크리스트 |
| [docs/PRD.md](docs/PRD.md) | 제품 요구사항·플랜·기능 범위 (기능 변경 시 함께 갱신) |
| [AGENTS.md](AGENTS.md) | Cursor Agent 공통 지침 |
| [CLAUDE.md](CLAUDE.md) | Claude Code·외부 Claude용 짧은 컨텍스트 |
| [docs/DEPLOYMENT_CHECKLIST.md](docs/DEPLOYMENT_CHECKLIST.md) | 배포 전 환경 변수·보안·스모크 점검 |
| 단위·E2E 테스트 | `npm run test:unit` · `npm run test:e2e` (Playwright, 빌드 후 CI에서 실행) |

## 주요 기능

- 유튜브 업로드 목록과 RSS 피드를 하나의 리스트로 병합
- **소식통 레이아웃**: 유튜브 최신 / RSS·뉴스 최신을 블록별로 분리해 표시
- **카테고리 필터**: AI·자기계발·개발·뉴스 등으로 분류해 보기 (URL `?category=AI` 지원)
- **백그라운드 라디오**: 유튜브 항목을 큐에 넣고 하단 플로팅 플레이어로 오디오만 재생
- **AI 3줄 요약**: 자막 또는 제목·설명으로 Gemini 요약 (선택)
- **트렌드**: 상단 칩 + `/trends` 워드클라우드·상세
- **피드 Q&A**: Gemini·멀티턴(로컬 저장)·마크다운 복사·Todoist 빠른 추가
- 최신순 정렬과 중복 제거
- 키워드 기반 개인 필터 저장(브라우저 `localStorage`만, URL·다른 기기와 동기화 없음)
- 수동 새로고침과 서버 캐시 재검증
- 텍스트 중심의 간결한 피드 UI

## 기술 스택

- `Next.js 16`
- `React 19`
- `TypeScript`
- `rss-parser`
- `Tailwind CSS 4`

## 시작 방법

1. 의존성을 설치합니다.

```bash
npm install
```

1. 환경 변수를 설정합니다.

```bash
copy .env.example .env.local
```

1. `.env.local`에 필요한 값을 채웁니다. (`.env.example` 참고)

```env
YOUTUBE_API_KEY=your_youtube_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
REVALIDATE_SECRET=replace_with_a_long_random_secret
```

1. 개발 서버를 실행합니다.

```bash
npm run dev
```

1. 브라우저에서 `http://localhost:3000`을 엽니다.

## 환경 변수

- `YOUTUBE_API_KEY`: 유튜브 피드·라디오·요약 폴백용 YouTube Data API v3 키 (필수)
- `GEMINI_API_KEY`: AI 3줄 요약용 Gemini API 키 (요약 사용 시 필수)
- `REVALIDATE_SECRET`: 선택. 서버 간 수동 재검증 호출 시 사용

브라우저에서 누르는 기본 새로고침 버튼은 same-origin 요청만 허용하도록 보호되어 있습니다. 외부 자동화나 웹훅에서 재검증을 호출하려면 `x-revalidate-secret` 헤더에 `REVALIDATE_SECRET` 값을 넣어 호출하면 됩니다.

## 프로젝트 구조

- `src/app`: 앱 라우터, API 라우트, 서버 액션(요약)
- `src/components`: 레이아웃, 피드, 플로팅 라디오 플레이어, UI
- `src/contexts`: 라디오 큐 전역 상태 (RadioQueueProvider)
- `src/lib`: YouTube, RSS, 병합/필터링 로직
- `src/types`: 공통 타입 정의

## 점검 및 검증

로컬에서 아래 명령으로 기본 검증을 실행할 수 있습니다.

```bash
npm run lint
npm run test:unit
npm run build
npm test
npm run verify:supabase
```

브라우저에서 함께 확인하면 좋은 항목:

- 피드 목록이 정상적으로 렌더링되는지
- **소식통**: 유튜브 블록 / RSS·뉴스 블록이 각각 최신순으로 표시되는지
- **카테고리 필터**: 전체·AI·자기계발·개발·뉴스 전환 시 필터가 맞는지, 사이드바 카테고리 링크가 동작하는지
- **라디오**: "라디오에 추가" → 하단 플레이어 재생/일시정지/다음/이전/닫기, 탭 전환 후에도 오디오 유지
- 필터 추가/삭제가 기대대로 동작하는지
- 새로고침 버튼 클릭 후 목록이 다시 로드되는지
- 빈 상태 메시지가 자연스러운지
- 외부 링크가 새 탭에서 열리는지

## AI 협업 방식

AI 협업 역할 분담과 handoff 포맷은 `AI_COLLABORATION.md`에 정리되어 있습니다.

- `Antigravity`: 우선순위, 완료 기준, 브라우저 QA 주도
- `Cursor`: 코드 수정, 기술 검토, 검증 수행

## 배포 전 체크

- `.env.example`에 실제 비밀값을 넣지 않았는지 확인
- `YOUTUBE_API_KEY`가 서버 환경에만 설정되어 있는지 확인
- 재검증 API를 외부 자동화에 연결했다면 `REVALIDATE_SECRET`을 함께 설정했는지 확인
