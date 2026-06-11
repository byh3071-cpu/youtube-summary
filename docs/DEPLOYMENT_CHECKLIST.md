---
id: focus-feed-deployment-checklist
date: 2026-05-18
tags: [focus-feed, deployment, vercel]
---

# Focus Feed — 배포 전 체크리스트

배포(Vercel 등) 직전에 아래를 순서대로 확인한다. 상세 키 설명은 `.env.example` 과 `README.md` 를 따른다.

## 0. Google API 키 발급·갱신 바로가기

키가 만료되면 피드 수집과 AI 기능 전체가 죽는다. "API key expired" 로그가 보이면 아래에서 갱신한다.

| 키 | 발급/갱신 위치 |
|----|----------------|
| `GEMINI_API_KEY` | [Google AI Studio → API Keys](https://aistudio.google.com/apikey) — 새 키 만들기 한 번이면 끝 |
| `YOUTUBE_API_KEY` | [Cloud Console → 사용자 인증 정보](https://console.cloud.google.com/apis/credentials) — 키 편집에서 만료일 제거 또는 새 키 발급 (**Expiration: Never** 권장) |
| YouTube API 활성화 확인 | [YouTube Data API v3 라이브러리](https://console.cloud.google.com/apis/library/youtube.googleapis.com) |
| YouTube 할당량 확인 | [Quotas](https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas) |

갱신 후 반영 위치 **두 곳 모두**:
1. 로컬 `.env.local` → 서버 재시작
2. [Vercel 대시보드](https://vercel.com/dashboard) → 프로젝트 → Settings → Environment Variables → **Redeploy** (env 변경은 재배포해야 반영)

## 1. 필수 환경 변수

| 변수 | 용도 |
|------|------|
| `YOUTUBE_API_KEY` | 피드·라디오 |
| `GEMINI_API_KEY` | AI 요약·인사이트·트렌드·랭킹·피드 Q&A |
| `NEXT_PUBLIC_SUPABASE_URL` | 클라이언트·서버 세션 (브라우저에서 반드시 필요) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 위와 동일 |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 전용 DB·플랜 (API 라우트) |
| `NEXT_PUBLIC_SITE_URL` | 프로덕션 공개 URL (`https://…`, 끝 슬래시 없이). OAuth·Stripe 리다이렉트 |

`SUPABASE_URL` 이 비어 있으면 일부 서버 코드는 `NEXT_PUBLIC_SUPABASE_URL` 로 폴백할 수 있으나, **문서상으로는 둘 다 채우는 것**을 권장한다.

## 2. 기능별 선택 변수

| 변수 | 언제 |
|------|------|
| `STRIPE_*` | `/pricing` 결제 사용 시 |
| `OWNER_EMAIL` | 운영자 무제한 플랜 |
| `REVALIDATE_SECRET` | 외부에서 캐시 재검증 API 호출 시 |
| `BRIEFING_CRON_SECRET` | `/api/briefing` 크론 보호(프로덕션) |
| `OPS_STATUS_SECRET` | 프로덕션 `/api/ops/status` 보호 |

## 3. 보안·운영

- [ ] `.env` / Vercel 대시보드에 **서비스 롤·Stripe 시크릿**이 클라이언트 번들에 노출되지 않았는지 확인 (`NEXT_PUBLIC_` 접두사 없음).
- [ ] 프로덕션에서 **`/api/debug-youtube`** 는 기본 **404**. 필요 시에만 `ENABLE_DEBUG_YOUTUBE=true` 로 잠시 허용.
- [ ] Supabase **Authentication → URL Configuration** 의 Site URL 이 `NEXT_PUBLIC_SITE_URL` 과 일치.
- [ ] `docs/supabase-migrations/002_usage_daily_feed_qa.sql` 적용(피드 Q&A 일일 한도·`usage_daily.feed_qa_count`). 001 미적용 시 002만으로는 부족.
- [ ] `docs/supabase-migrations/005_playlists_owner_required.sql` 적용(플레이리스트 RLS·로그인 전용). 기존 `user_id IS NULL` 행은 자동 삭제하지 말고 운영자 수동 검토 (`docs/DATA_PROTECTION.md` §2).
- [ ] **YouTube 키 교체 후 실동작 확인**: 섹션 0에서 키 갱신 후, 실제 `channels`·`playlistItems` 요청이 200으로 응답하는지 확인 (만료 키는 HTTP 400 `API key expired`). 키 값은 문서·로그에 기록하지 않는다.
- [ ] **Gemini 키 교체 후 실동작 확인**: `generateContent` 최소 요청 1회(예: 피드 요약 1회)가 성공하는지 확인.
- [ ] **Stripe 미사용 환경 구분**: 결제를 의도적으로 끈 환경이라면 `STRIPE_*` 미설정 경고를 "설정 누락"이 아닌 "의도적 비활성"으로 기록해 혼선을 방지.

## 4. 빌드·동작

로컬 또는 CI:

```bash
npm run lint
npm run build
npm run test:unit
npm run test:e2e
npm run test
npm run verify:supabase
```

- [ ] 로그인·피드·요약 1회·라디오 재생 스모크
- [ ] `/api/ops/status`가 `ok: true`인지 확인. 프로덕션에서는 `x-ops-status-secret` 헤더 필요.

## 5. Gemini 레이트 리밋 (선택)

| 변수 | 기본(코드 내) | 의미 |
|------|----------------|------|
| `GEMINI_ACTIONS_PER_MINUTE` | 36 | 로그인 사용자, 액션 종류별(요약/인사이트/브리핑/피드 Q&A) **분당** 상한 |
| `GEMINI_ANON_ACTIONS_PER_MINUTE` | 24 | 비로그인 시 IP 기준 분당 상한 |
| `GEMINI_TREND_PER_HOUR_PER_IP` | 40 | 트렌드 레이더 Gemini, **IP당 시간당** |

인스턴스 메모리 기준이라 서버리스에서는 인스턴스마다 별도 카운터임을 유의한다.
