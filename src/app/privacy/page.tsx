import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "개인정보처리방침 | Focus Feed",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-(--notion-bg) text-(--notion-fg)">
      <article className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-3xl font-bold tracking-tight">
          개인정보처리방침
        </h1>
        <p className="mt-2 text-sm text-(--notion-fg)/60">
          시행일: 2026년 6월 19일
        </p>

        <p className="mt-8 leading-relaxed text-(--notion-fg)/80">
          Focus Feed(이하 &quot;서비스&quot;)는 이용자의 개인정보를 소중히
          여기며, 관련 법령에 따라 아래와 같이 개인정보를 처리합니다.
        </p>

        {/* 수집하는 개인정보 */}
        <section className="mt-10">
          <h2 className="text-xl font-semibold">1. 수집하는 개인정보</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-(--notion-fg)/80">
            <li>이메일 주소 (Google OAuth 로그인 시 제공)</li>
            <li>Google 프로필 정보 (이름, 프로필 이미지)</li>
            <li>서비스 이용 기록 및 접속 로그</li>
            <li>
              이용자가 추가한 YouTube 채널·RSS 소스, 북마크, 플레이리스트
            </li>
            <li>
              이용자가 입력한 관심사·목표, AI 요약·인사이트·Q&amp;A 이력, 영상
              시청 진행 기록 (대부분 이용자 브라우저에 저장)
            </li>
          </ul>
        </section>

        {/* 개인정보 이용 목적 */}
        <section className="mt-10">
          <h2 className="text-xl font-semibold">2. 개인정보 이용 목적</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-(--notion-fg)/80">
            <li>서비스 제공 및 계정 관리</li>
            <li>사용량 추적 및 요금제 관리</li>
            <li>서비스 개선 및 신규 기능 개발</li>
            <li>이용자 문의 대응</li>
          </ul>
        </section>

        {/* 제3자 제공 */}
        <section className="mt-10">
          <h2 className="text-xl font-semibold">3. 제3자 제공</h2>
          <p className="mt-3 leading-relaxed text-(--notion-fg)/80">
            서비스는 다음과 같은 외부 서비스를 이용하며, 이에 따라 개인정보가
            제3자에게 제공될 수 있습니다.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-(--notion-fg)/80">
            <li>
              <strong>Supabase</strong> &mdash; 데이터 저장 및 사용자 인증
            </li>
            <li>
              <strong>Stripe</strong> &mdash; 결제 처리 (유료 플랜 구독 시)
            </li>
            <li>
              <strong>Google / YouTube API</strong> &mdash; YouTube 채널 구독
              정보 연동 및 영상 데이터 조회
            </li>
            <li>
              <strong>Google Gemini API</strong> &mdash; AI 요약·인사이트·트렌드·Q&amp;A
              생성을 위해 영상 자막·제목·설명, 피드 문맥, 이용자가 입력한
              목표·질문이 전송됩니다.
            </li>
            <li>
              <strong>Notion API</strong> &mdash; 이용자가 &quot;노션에 정리&quot;를
              실행할 때 영상 분석 결과와 관련 맥락이 운영자가 지정한 Notion
              데이터베이스로 전송됩니다.
            </li>
          </ul>
        </section>

        {/* 보유 기간 */}
        <section className="mt-10">
          <h2 className="text-xl font-semibold">4. 보유 기간</h2>
          <p className="mt-3 leading-relaxed text-(--notion-fg)/80">
            개인정보는 서비스 이용 기간 동안 보유합니다. 이용자 브라우저에 저장된
            데이터(목표·요약·시청 기록 등)는 이용자가 브라우저 저장소를 비우면
            즉시 삭제됩니다. 서버에 보관된 데이터의 삭제·탈퇴는 현재 문의처를 통해
            요청할 수 있으며, 요청 시 지체 없이 파기합니다. 단, 관련 법령에 따라
            일정 기간 보관이 필요한 경우 해당 기간 동안 보관합니다.
          </p>
        </section>

        {/* 이용자 권리 */}
        <section className="mt-10">
          <h2 className="text-xl font-semibold">5. 이용자의 권리</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-(--notion-fg)/80">
            <li>개인정보 열람·수정·삭제 요청</li>
            <li>개인정보 처리 정지 요청</li>
            <li>데이터 내보내기 (내 계정 페이지에서 직접 가능)</li>
            <li>계정 탈퇴 및 개인정보 삭제 요청</li>
          </ul>
          <p className="mt-3 leading-relaxed text-(--notion-fg)/80">
            데이터 내보내기는 내 계정 페이지에서 직접 할 수 있으며, 삭제·탈퇴·처리
            정지는 아래 문의처를 통해 요청할 수 있습니다.
          </p>
        </section>

        {/* 쿠키 사용 */}
        <section className="mt-10">
          <h2 className="text-xl font-semibold">6. 쿠키 사용</h2>
          <p className="mt-3 leading-relaxed text-(--notion-fg)/80">
            서비스는 로그인 상태 유지 및 사용자 환경 개선을 위해 쿠키를
            사용합니다. 브라우저 설정을 통해 쿠키 저장을 거부할 수 있으나, 이
            경우 일부 기능 이용이 제한될 수 있습니다.
          </p>
        </section>

        {/* 문의처 */}
        <section className="mt-10">
          <h2 className="text-xl font-semibold">7. 문의처</h2>
          <p className="mt-3 leading-relaxed text-(--notion-fg)/80">
            개인정보 관련 문의는 아래 이메일로 연락해 주세요.
          </p>
          <p className="mt-2 font-medium">focusfeed.help@gmail.com</p>
        </section>

        {/* 홈으로 돌아가기 */}
        <div className="mt-16 border-t border-(--notion-border) pt-8">
          <Link
            href="/"
            className="text-sm font-medium text-(--notion-fg)/60 hover:text-(--notion-fg)"
          >
            &larr; 홈으로 돌아가기
          </Link>
        </div>
      </article>
    </main>
  );
}
