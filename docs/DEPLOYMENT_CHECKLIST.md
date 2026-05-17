---
id: focus-feed-deployment-checklist
date: 2026-05-18
tags: [focus-feed, deployment, vercel]
---

# Focus Feed — 배포 전 체크리스트

배포(Vercel 등) 직전에 아래를 순서대로 확인한다. 상세 키 설명은 `.env.example` 과 `README.md` 를 따른다.

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
