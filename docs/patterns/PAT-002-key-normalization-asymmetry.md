---
id: PAT-002
패턴명: 키 정규화 비대칭 (write-path만 정규화 → lookup miss)
카테고리: state
증상: 저장은 되는데 같은 항목의 조회/필터가 어긋난다. 특정 입력(앞뒤 공백·개행·대소문자 등 "지저분한" 값)에서만 산발적으로 상태가 반영 안 됨. 정상값 다수는 멀쩡해 재현이 어렵다.
원인: 같은 논리적 키를 저장 경로와 조회/필터 경로가 서로 다르게 정규화한다. 흔히 저장 측(서버 액션·DB write)에서만 trim()/lowercase 등 정규화를 하고, 조회·필터는 원본값으로 키를 만든다. 입력이 깨끗하면 정규화 전후가 같아 무증상이지만, 오염 입력 1건에서 저장키≠조회키가 되어 lookup miss.
해결: 정규화를 "키 생성기 함수 한 곳"으로 모은다. 저장·조회·필터가 모두 그 함수를 거치면 어느 경로든 동일 키가 나온다. 저장 측의 별도 정규화(action.trim 등)는 키 생성기가 이미 정규화하므로 no-op이 되어 비대칭이 사라진다. 경계 입력(공백 섞인 값)에 대한 회귀 테스트를 키 생성기에 붙인다.
적용조건: 동일 논리 키가 2개 이상 경로(저장/조회/필터/캐시/dedup)에서 독립적으로 만들어지는 모든 코드. 캐시 키, 멱등 키, dict/map 키, content_id, 외부 식별자 정규화 전반.
출처프로젝트: focus-feed (youtube-summary)
태그: [정규화, 키계약, lookup-miss, trim, single-source-of-truth, RSS]
발견일: 2026-06-24
출처DevLog: 2026-06-24 세션 (PR #15 적대 리뷰 LOW 발견 → fix 7b774e5). docs/HANDOFF_2026-06-24_SESSION.md
---

## 사례 (focus-feed)

RSS 콘텐츠 상태(`content_states`)의 키 `contentIdForItem(item)`:

- **저장**: `setContentStateAction` 이 `contentId.trim()` 후 저장 (정규화함)
- **조회**: `FeedList` 가 `contentStates[contentIdForItem(item)]` (원본, trim 안 함)
- **필터**: `isItemVisibleUnderStateFilter` 도 `contentIdForItem(item)` (원본)

RSS `link` 는 `rss-parser`(xml2js 기본 `trim:false`)가 `<link>\n url \n</link>` 의 공백/개행을 그대로 넘김 → `rss:<오염link>` 저장키는 trim되고 조회/필터키는 안 돼 어긋남. 정상 URL(대다수)은 무증상이라 적대 리뷰 정적 분석에서야 잡힘.

### Before
```ts
export function contentIdForItem(item) {
  if (item.source === "YouTube") return item.id || undefined;
  if (item.source === "RSS") return item.link ? `rss:${item.link}` : undefined; // 원본
}
// 저장 측 별도: setContentStateAction → contentId.trim()  ← 비대칭의 근원
```

### After (정규화 단일 출처)
```ts
export function contentIdForItem(item) {
  if (item.source === "YouTube") return item.id.trim() || undefined;
  if (item.source === "RSS") {
    const link = item.link.trim();          // 키 생성기에서 1회 정규화
    return link ? `rss:${link}` : undefined; // 저장·조회·필터가 동일 키 공유
  }
}
```

## 교훈
"저장은 되는데 조회가 안 된다" = 거의 항상 키 계약 문제. 키를 만드는 코드가 2곳 이상이면 의심하라. 정규화는 키 생성기 한 곳에서, 경계 입력 회귀 테스트 필수.
