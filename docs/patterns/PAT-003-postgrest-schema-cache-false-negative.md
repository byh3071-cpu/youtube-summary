---
id: PAT-003
패턴명: PostgREST 스키마캐시 staleness = 마이그레이션 직후 false negative
카테고리: env
증상: 방금 적용한 테이블/컬럼을 코드·검증 스크립트가 "Could not find the table 'public.X' in the schema cache" 로 실패. DB에는 분명히 존재하는데 Supabase REST(PostgREST) 가 못 찾는다. 잠시 후/재조회하면 정상. "마이그레이션 안 됨" 으로 오판하기 쉽다.
원인: Supabase 의 REST 계층 PostgREST 는 스키마를 메모리에 캐시한다. 마이그레이션으로 테이블을 만들어도 PostgREST 캐시가 갱신(reload)되기 전엔 그 테이블을 모른다. service_role 키여도 마찬가지(RLS 우회와 무관, 캐시 문제). 갱신은 NOTIFY pgrst 또는 일정 시간 후 자동.
해결: ①"schema cache" 문구가 보이면 테이블 부재로 단정 말고 재조회/잠시 후 재시도. ②확정하려면 Supabase 대시보드 "Reload schema" 또는 `NOTIFY pgrst, 'reload schema';` 실행. ③검증 스크립트는 일시 캐시 실패와 진짜 부재를 구분(재시도 1회)하도록 작성. ④마이그레이션 적용 여부의 진짜 근거는 마이그레이션 파일/이력이지 1회성 REST 조회가 아님.
적용조건: Supabase(PostgREST) 사용 프로젝트에서 마이그레이션 직후 스키마 검증·앱 첫 호출. 셀프호스팅 PostgREST 동일.
출처프로젝트: focus-feed (youtube-summary)
태그: [supabase, postgrest, schema-cache, migration, false-negative, 검증]
발견일: 2026-06-24
출처DevLog: 2026-06-24 세션 (운영자 P0 검증 중 verify:supabase teams FAIL → 재조회 OK). docs/HANDOFF_2026-06-24_SESSION.md
---

## 사례 (focus-feed)

운영자 P0 검증 중 `npm run verify:supabase`:
```
FAIL teams: Could not find the table 'public.teams' in the schema cache
FAIL team_members: ...
FAIL team_invites: ...
```
→ "009 마이그레이션 미적용" 으로 보고. 그러나 같은 service_role 키로 **직후 재조회**:
```
OK   teams (rows=null)
OK   team_members (rows=null)
OK   team_invites (rows=null)
OK   content_states (rows=null)
```
테이블은 전부 존재했다. 첫 실패 = PostgREST 스키마캐시 staleness 였음.

## 교훈
- "table not found in schema cache" ≠ "table 없음". 캐시 문구를 부재로 직역하지 말 것.
- 인프라/마이그레이션 상태를 1회 REST 조회로 단정하면 false negative 로 사람에게 잘못된 "P0 미완료" 를 보고하게 된다. 재조회로 교차검증.
- 검증 스크립트 `verify-supabase-schema.mjs` 는 `requiredTables` 하드코딩 목록이라 신규 테이블(content_states 등) 미점검 → 목록 동기화도 별도 과제.
