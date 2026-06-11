# Focus Feed - Rules

> 이 파일은 Focus Feed에서 AI 에이전트와 VHK가 따르는 작업 헌법이다.
> 제품 우선순위는 `docs/MILESTONES.md`와 `docs/PRD.md`, 실행 절차는 이 파일과 `AGENTS.md`를 따른다.

## 프로젝트 정체성

- 이름: Focus Feed
- 역할: YouTube와 RSS를 통합하고 Gemini AI, Supabase, Stripe, PWA 기능을 제공하는 개인화 피드
- 저장소: `Youtube-Summary`

## 기술 스택

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Supabase
- Stripe
- Gemini
- Playwright
- Vitest

## 디렉터리 구조

- 애플리케이션 라우트와 서버 액션은 `src/app/`에 둔다.
- 재사용 UI 컴포넌트는 `src/components/`에 둔다.
- 공통 서버·클라이언트 유틸리티는 `src/lib/`에 둔다.

## 코딩 규칙

- 기존 파일과 디렉터리의 패턴을 우선한다.
- 서버 시크릿을 클라이언트 코드나 로그에 노출하지 않는다.
- 기능 변경 시 `docs/PRD.md`와 `docs/MILESTONES.md` 갱신 필요성을 확인한다.
- 요청 범위를 벗어난 대규모 리팩터와 의존성 갱신을 함께 수행하지 않는다.
- 사용자가 명시적으로 요청하기 전에는 commit 또는 push하지 않는다.

## 검증 규칙

- VHK 통과만으로 완료를 선언하지 않는다.
- 기본 검증은 `npm run verify:focus-feed`를 사용한다.
- 릴리스 후보는 `npm run verify:release`를 사용한다.
- `vhk verify`가 자동으로 다루지 못하는 lint, smoke, E2E, Supabase 스키마, npm audit 결과를 별도로 확인한다.
- VHK 2.5.1 보안 스캔의 확인된 오탐·미탐이 해결될 때까지 `vhk verify`는 보조 증거로만 사용하고 기본/CI 보안 게이트는 `npm run security:secrets`를 사용한다.
- 실패한 검증을 생략하거나 성공으로 표현하지 않는다.

## VHK 운영 헌법

- 프로젝트 VHK 버전은 `@byh3071/vhk@2.5.1`로 고정한다.
- 직접 `vhk` 또는 `npx vhk`를 실행하지 않고 `npm run vhk -- <command>`를 사용한다.
- VHK 실행 실패는 `scripts/vhk-guard.mjs`가 사건으로 기록한다.
- 작업 종료 전 `npm run vhk:policy`가 통과해야 한다.
- `vhk start`, `vhk init`, `vhk sync`, `vhk save`, `vhk undo`, `vhk deploy`, `vhk publish`, `vhk migrate`, `vhk mcp-init`은 사용자의 명시적 승인 없이 실행하지 않는다.
- 특히 `vhk sync`는 기존 `AGENTS.md`, `CLAUDE.md`, Cursor 규칙을 재생성할 수 있으므로 기본 금지한다. 검토 시에도 먼저 `vhk sync --dry-run`만 실행한다.
- VHK가 생성한 결과는 독립적인 저장소 검증으로 교차 확인한다.

## VHK 이슈 의무 신고

- VHK 자체의 crash, 오탐, 미탐, 잘못된 파일 변경, 문서와 실제 동작의 불일치, 플랫폼 호환성 문제를 재현하면 upstream 이슈 신고가 의무다.
- 프로젝트 코드, 테스트, 환경 변수, 네트워크 또는 외부 서비스 실패는 VHK 이슈가 아니다.
- VHK 결함은 재현 절차와 비밀값을 제거한 증거를 준비해 `https://github.com/byh3071-cpu/vhk/issues`에 등록한다.
- `npm run vhk:incident -- ...`로 결함을 기록하고 `npm run vhk:draft -- <incident-id>`로 비밀값 제거 draft를 만든다.
- 외부 GitHub 게시 전 draft 내용을 사용자에게 보여주고 명시적 승인을 받아야 한다. 승인 후 `npm run vhk:report -- <incident-id> --approved`로 신고한다.
- GitHub 인증이나 네트워크 문제로 신고하지 못하면 작업을 완료로 선언하지 않는다. 생성된 draft 경로와 차단 사유를 사용자에게 보고한다.
- 이미 등록한 동일 이슈가 있다면 `npm run vhk:link -- <incident-id> <issue-url>`로 연결한다.
- 비밀값 없는 신고 상태는 `docs/vhk-issues.json`에 추적하며, pending 항목이 있으면 모든 에이전트와 CI가 `vhk:policy`를 통과하지 못한다.

## 커밋 컨벤션

- `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:` 접두사를 사용한다.
- VHK의 `save` 명령으로 자동 commit 또는 push하지 않는다.

## 기록 규칙

- VHK 도입 범위와 명령은 `docs/VHK_ADOPTION.md`를 따른다.
- VHK 사건 원문은 `.vhk/incidents/`에 로컬로 보관하고 Git에 커밋하지 않는다.
- 공유가 필요한 최소 상태만 `docs/vhk-issues.json`에 기록한다.
- upstream 이슈에는 시크릿, 토큰, 사용자 홈 경로, 전체 환경 파일을 포함하지 않는다.
