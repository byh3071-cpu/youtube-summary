// 공용 Tailwind 클래스 조각. 같은 패턴이 여러 컴포넌트에 흩어지지 않게 한 곳에서 관리한다.

/**
 * 44px 투명 터치 히트영역(시각 크기와 무관). 이미 셸이 있는 버튼에 덧붙여 사용.
 * 시각은 작게(예: 36px) 두고 탭 영역만 WCAG/HIG 44px로 키운다.
 */
export const HIT_AREA_44 =
  "relative before:absolute before:left-1/2 before:top-1/2 before:size-11 before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']";

/**
 * 피드 카드 액션행의 36px 원형 아이콘 버튼 셸(시각 36px + 44px 터치영역).
 * 색(텍스트/활성)은 호출부에서 덧붙인다. 딥다이브·라디오·더보기 등이 공유.
 */
export const ICON_ACTION_BTN =
  `inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors touch-manipulation hover:bg-(--notion-hover) ${HIT_AREA_44}`;
