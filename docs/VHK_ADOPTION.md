---
id: focus-feed-vhk-adoption
date: 2026-06-12
tags: [focus-feed, vhk, agents, security, verification]
---

# Focus Feed VHK 도입 정책

## 결론

VHK는 Focus Feed의 유일한 품질 판정기가 아니라 에이전트 규칙, 실행 증거, 보안 스캔과 인수인계를 보조하는 계층으로 사용한다.

프로젝트의 목표 버전은 `@byh3071/vhk@2.6.0`이다. 전역 설치 여부와 관계없이 모든 에이전트와 CI가 같은 버전을 사용해야 한다.

> ⚠️ **임시 상태 (2026-06-12):** 현재 의존성은 npm 버전이 아니라 로컬 경로(`file:../Yohan-System-Project/vhk`)다. 사유와 복구 절차는 아래 [2026-06-12 — v2.6.0 로컬 연결 전환] 섹션 참고.

## 도입 범위

| 기능 | 상태 | 사용 원칙 |
| --- | --- | --- |
| `check` | 사용 | `RULES.md` 구조와 검사 가능한 규칙 확인 |
| `secure scan` | 보조 | 확인된 오탐·미탐 재현 및 upstream 수정 확인 |
| `verify` | 보조 | 시크릿 스캔 결함 해결 전에는 완료 게이트로 사용하지 않음 |
| `mission` | 선택 | 범위가 명확한 독립 작업에서만 사용 |
| `context`, `brief` | 선택 | 에이전트 핸드오프가 필요할 때 사용 |
| `review`, `preflight`, `testmap` | 선택 | 릴리스 또는 위험 변경에서 보조 신호로 사용 |
| `goal init` | 보류 | 기존 `docs/MILESTONES.md`와 중복될 수 있음 |
| `mcp-init` | 보류 | 기존 에이전트 설정 검토 전 자동 생성 금지 |
| `sync` | 기본 금지 | 기존 `AGENTS.md`, `CLAUDE.md`, Cursor 규칙 재생성 위험 |
| `start`, `init` | 금지 | 이미 운영 중인 기존 저장소 |
| `save`, `undo` | 금지 | 사용자 승인 없는 Git 변경 및 push 방지 |
| `deploy`, `publish`, `migrate` | 금지 | 별도 승인과 릴리스 절차 필요 |

## 표준 명령

```powershell
npm run vhk -- doctor --audit
npm run vhk -- status
npm run vhk -- check
npm run security:secrets
npm run vhk:evidence
npm run verify:focus-feed
npm run verify:release
npm run vhk:policy
```

직접 `vhk`, `vhk.cmd`, `npx vhk`를 실행하지 않는다. 실행 결과와 실패 사건을 남기기 위해 반드시 npm 래퍼를 통과한다.

## 검증 커버리지

`vhk verify`는 다음만 자동 실행한다.

- TypeScript `tsc --noEmit`
- `test:run` 스크립트
- `build` 스크립트
- VHK 시크릿 스캔

Focus Feed에서 별도로 필요한 검증:

- ESLint
- `scripts/smoke-test.mjs`
- Playwright E2E와 모바일/PWA 시나리오
- Supabase 실제 스키마 검증
- npm 취약점 감사

따라서 VHK PASS만으로 릴리스 가능하다고 판단하지 않는다.

VHK 2.5.1의 시크릿 스캔 오탐·미탐은 **v2.6.0에서 해결됐다(2026-06-12 검증, 아래 한계 섹션 참고).** 그래도 CI와 기본 완료 게이트는 1차 도구인 `npm run security:secrets`를 유지하고, `npm run vhk:evidence`는 보조 신호로 함께 본다. 릴리스 게이트는 `npm run security:history`로 Git 기록도 확인한다.

## VHK 결함 신고 프로토콜

신고 대상:

- VHK 프로세스 crash 또는 내부 stack trace
- 동일 입력에서 재현되는 오탐 또는 미탐
- 문서와 실제 CLI 동작 불일치
- 예고하지 않은 파일 손상 또는 덮어쓰기
- Windows, macOS, Linux별 호환성 결함
- 보안상 위험한 출력 또는 시크릿 노출

신고 제외:

- Focus Feed의 lint, test, build 실패
- 누락된 앱 환경 변수
- Supabase, Gemini, YouTube, Stripe 장애
- 일반적인 네트워크 또는 GitHub 인증 실패

절차:

```powershell
# VHK 결함을 수동 기록
npm run vhk:incident -- --title "짧은 제목" --command "verify" `
  --expected "기대 동작" --actual "실제 동작" --repro "재현 단계"

# GitHub 이슈 자동 등록
npm run vhk:draft -- <incident-id>

# draft를 사용자에게 보여주고 외부 공개를 명시 승인받은 뒤 등록
npm run vhk:report -- <incident-id> --approved

# 이미 등록된 이슈 연결
npm run vhk:link -- <incident-id> https://github.com/byh3071-cpu/vhk/issues/123

# 미분류 또는 미신고 사건 차단 확인
npm run vhk:policy
```

외부 GitHub 게시에는 저장소·환경 정보 공개 위험이 있으므로 자동 무승인 게시를 허용하지 않는다. `vhk:draft`로 만든 비밀값 제거 Markdown을 사용자가 검토하고 명시 승인해야 하며, 그 후에도 `gh auth login`이 완료되어 있어야 한다. 게시와 이슈 URL 연결이 끝나기 전에는 작업 완료 조건을 충족하지 않는다.

## 현재 확인된 한계와 차단 항목

2026-06-11 기준:

- VHK `sync`는 기존 `AGENTS.md`를 병합하지 않고 생성본으로 교체할 수 있어 사용하지 않는다.
- VHK `verify`는 `test:run`이 없으면 기존 `test`를 선택하므로, 프로젝트에 `test:run=vitest run`을 명시한다.
- ~~VHK 보안 스캔은 `.env.example`의 예시 값과 `missing_api_key` 상태 문자열을 HIGH로 오탐했다.~~
  **✅ v2.6.0에서 해결 (2026-06-12 검증).** 프로젝트 `.env.example`(플레이스홀더 3개)·`missing_api_key`(4곳)를
  보유한 채로 `npm run vhk:evidence` secure scan이 PASS. 격리 픽스처 재현 시에도 플레이스홀더 미탐지.
- ~~VHK 보안 스캔은 Python의 `api_key = "<실제 키>"` 패턴을 미탐했다.~~
  **✅ v2.6.0에서 해결 (2026-06-12 검증).** 격리 픽스처(`api_key = "AIza…"`)에서 secure scan이 HIGH 2건
  (Google API Key + Generic API Key)으로 정확히 탐지. upstream 신고 불필요.
- Git 기록의 `b5b01c1` 커밋에 Gemini 키가 포함됐을 가능성이 확인됐다. 현재 파일에서는 제거했지만 해당 키는 즉시 폐기·재발급하고 별도 승인 후 Git 기록 정리를 수행해야 한다.
- npm audit 결과는 전체 9건, 프로덕션 의존성 6건이다.
- 주요 프로덕션 차단 항목은 Next.js `16.1.6`, `@google/genai` 경유 `protobufjs@7.5.4`, `ws@8.19.0`이다.
- 개발 차단 항목에는 Vitest `3.2.4`가 포함된다.

이 취약점은 VHK 자체 결함이 아니므로 VHK upstream에 신고하지 않는다. 앱 의존성 갱신 작업으로 별도 처리한다.

## 2026-06-12 — v2.6.0 로컬 연결 전환

### 무슨 일이 있었나

- vhk v2.6.0이 발행된 줄 알았으나 실제로는 **npm에 발행된 적이 없었다.** vhk 레포의 PR #268은 "발행 전 백필(준비)"일 뿐, 버전 범프·태그·`npm publish` 단계가 빠져 있었다.
- 2026-06-12에 릴리즈를 완성했다: vhk 레포 PR #270(버전 범프 + CHANGELOG 승격, CI 4환경 전체 테스트 통과) 머지 + `v2.6.0` git 태그 푸시.
- 그러나 **npm publish는 미완**이다. 이 노트북에는 npm 로그인 인증 수단(passkey, Windows Hello)이 없어 발행이 불가능하다.

### 현재 의존성 상태 (임시)

- `devDependencies["@byh3071/vhk"]` = `file:../Yohan-System-Project/vhk` — 로컬 vhk 레포의 빌드 산출물(dist, v2.6.0)을 심볼릭 링크로 직접 사용.
- 검증 완료: `require('@byh3071/vhk/package.json').version` = 2.6.0, `vhk --version` = 2.6.0 정상 실행.
- 제약: **이 노트북에서만 동작**한다. 다른 기기에서 `npm install` 하면 해당 경로가 없어 실패한다. CI에서도 동일하게 실패하므로, 이 상태로 CI에 의존성 설치가 걸리는 변경을 푸시하지 않는다.
- 부수 효과: vhk 레포에서 코드를 수정하고 다시 빌드하면 이 프로젝트에 즉시 반영된다 (재설치 불필요).

### 정상화 절차 (npm publish 후)

1. passkey 인증이 가능한 기기에서 vhk 레포 `git pull` → `npm publish` (npm 레지스트리에 2.6.0 등록).
2. 이 프로젝트에서 한 줄 실행: `npm install --save-dev @byh3071/vhk@2.6.0`
3. package.json의 의존성이 `file:` 경로에서 `2.6.0` 으로 돌아오면 정상화 완료. 이 섹션의 임시 상태 경고를 제거한다.

### 참고 — 이 PC 환경 제약 (vhk 레포 작업 시)

- 레포가 OneDrive 폴더 안이라 `pnpm install` 기본(isolated) 링커가 Node 크래시(0xC0000409)로 실패한다 → `pnpm install --config.node-linker=hoisted` 사용.
- 한글 사용자 폴더 경로 탓에 vitest worker fork가 크래시해 로컬 풀 테스트가 불완전하다 → 테스트 게이트는 vhk 레포의 PR CI(ubuntu·windows × node 22·24)로 대체한다.

## 에이전트별 적용

- Codex: `AGENTS.md`와 `RULES.md`
- Claude Code: `CLAUDE.md`, `AGENTS.md`, `RULES.md`
- Cursor: `.cursor/rules/focus-feed-core.mdc`, `AGENTS.md`, `RULES.md`

세 에이전트 모두 동일한 신고 프로토콜과 완료 차단 조건을 따른다.

## 공유 상태

- 사건 원문과 명령 출력: `.vhk/incidents/` 로컬 전용
- 비밀값 없는 pending/reported 상태: `docs/vhk-issues.json` Git 추적
- `docs/vhk-issues.json`에 pending 항목이 하나라도 있으면 로컬과 CI의 `npm run vhk:policy`가 실패한다.
