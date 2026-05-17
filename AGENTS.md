---
id: focus-feed-agents-md
date: 2026-05-18
tags: [focus-feed, cursor, agents]
---

# Focus Feed — Cursor Agent 지침

## 리포지토리 요약

- **이름**: Focus Feed (Youtube-Summary 저장소)
- **역할**: YouTube·RSS 통합 피드, 라디오 플레이어, Gemini AI, Supabase 로그인·동기화, Stripe Pro, 팀·북마크·플레이리스트.

## 단일 소스 우선순위

1. `docs/MILESTONES.md` — 우선순위·완료 체크(M1~M6)
2. `docs/PRD.md` — 제품 범위·플랜·기능 개요 (기능 변경 시 함께 수정)
3. `README.md` — 실행 방법·환경 변수 요약·수동 점검 목록
4. `docs/DEPLOYMENT_CHECKLIST.md` — 배포 전 점검
5. `.env.example` — 허용된 환경 변수 키 목록
6. 코드 — 문서와 불일치하면 코드가 진실이면 문서를 고친다.

## 디렉터리 힌트

- `src/app` — 페이지·`route.ts` API·서버 액션
- `src/components/feed` — 피드 UI, 요약·북마크·모달 등
- `src/components/player` — 라디오 푸터·플로팅 플레이어
- `src/components/layout` — 사이드바, 모바일 드로어, 앱 레이아웃
- `src/lib` — 피드 병합, Supabase, 플랜·사용 한도, 쿠키 등
- `public` — 정적 자산, `app.webmanifest`, PWA 관련

## 작업 규칙

- 사용자가 명시적으로 요청하기 전까지 `git commit` / `git push` 하지 않음 (저장소 사용자 규칙).
- 비밀값·`.env.local` 커밋 금지.
- 변경 후 `npm run lint` (가능하면 `npm run build`, `npm run test:unit`)로 회귀 확인.
- 스타일은 같은 파일·디렉터리의 기존 패턴에 맞출 것 (불필요한 대규모 리팩터 지양).

## 한국어·문서

- 사용자 대화는 한국어 선호(프로젝트 설정 기준).
- 새 `.md` 작성 시 저장소 규칙에 따라 YAML 프론트매터(`id`, `date`, `tags`)를 둘 수 있음.

## 오래된 문서

- `CURSOR_HANDOFF.md` — 과거 Supabase 페이즈 안내; 현재 구현과 다를 수 있음. 모순 시 `docs/PRD.md`·`docs/MILESTONES.md`와 코드를 따른다.
