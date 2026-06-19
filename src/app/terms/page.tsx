import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "이용약관 | Focus Feed",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-(--notion-bg) text-(--notion-fg)">
      <article className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-3xl font-bold tracking-tight">이용약관</h1>
        <p className="mt-2 text-sm text-(--notion-fg)/60">
          시행일: 2026년 6월 19일
        </p>

        <p className="mt-8 leading-relaxed text-(--notion-fg)/80">
          본 약관은 Focus Feed(이하 &quot;서비스&quot;)의 이용 조건을
          규정합니다. 서비스를 이용함으로써 본 약관에 동의하는 것으로 간주됩니다.
        </p>

        {/* 서비스 소개 */}
        <section className="mt-10">
          <h2 className="text-xl font-semibold">1. 서비스 소개</h2>
          <p className="mt-3 leading-relaxed text-(--notion-fg)/80">
            Focus Feed는 YouTube 구독 채널과 RSS 피드를 한 곳에서 모아보고, AI
            기반 요약 기능을 통해 콘텐츠를 효율적으로 소비할 수 있도록 돕는
            서비스입니다.
          </p>
        </section>

        {/* 이용자의 의무 */}
        <section className="mt-10">
          <h2 className="text-xl font-semibold">2. 이용자의 의무</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-(--notion-fg)/80">
            <li>타인의 개인정보를 무단으로 수집하거나 도용하지 않아야 합니다.</li>
            <li>서비스의 정상적인 운영을 방해하는 행위를 하지 않아야 합니다.</li>
            <li>관련 법령 및 본 약관을 준수해야 합니다.</li>
            <li>
              서비스를 이용하여 불법적인 활동을 하거나 공공질서에 반하는 행위를
              하지 않아야 합니다.
            </li>
          </ul>
        </section>

        {/* 서비스 제공 및 변경 */}
        <section className="mt-10">
          <h2 className="text-xl font-semibold">3. 서비스 제공 및 변경</h2>
          <p className="mt-3 leading-relaxed text-(--notion-fg)/80">
            서비스는 연중무휴 제공을 원칙으로 하되, 시스템 점검이나 기술적 사유로
            일시 중단될 수 있습니다. 서비스의 내용이 변경되는 경우 사전에
            공지합니다.
          </p>
        </section>

        {/* 유료 서비스 */}
        <section className="mt-10">
          <h2 className="text-xl font-semibold">4. 유료 서비스</h2>
          <p className="mt-3 leading-relaxed text-(--notion-fg)/80">
            서비스는 무료 플랜과 Pro 플랜을 제공합니다. Pro 플랜은 월간 구독
            방식이며, Stripe를 통해 결제가 처리됩니다.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-(--notion-fg)/80">
            <li>
              구독은 매월 자동 갱신됩니다. 구독 해지·결제 관리는 현재
              문의처(focusfeed.help@gmail.com)를 통해 처리되며, 계정 내 셀프
              해지 기능은 준비 중입니다.
            </li>
            <li>
              결제 취소 시 해당 결제 주기 종료일까지 Pro 기능을 이용할 수
              있습니다.
            </li>
            <li>환불은 관련 법령에 따라 처리됩니다.</li>
          </ul>
        </section>

        {/* 지적재산권 */}
        <section className="mt-10">
          <h2 className="text-xl font-semibold">5. 지적재산권</h2>
          <p className="mt-3 leading-relaxed text-(--notion-fg)/80">
            서비스의 디자인, 코드, 로고 등 모든 콘텐츠에 대한 지적재산권은
            서비스 운영자에게 있습니다. 이용자가 서비스에 게시한 콘텐츠의
            저작권은 해당 이용자에게 귀속됩니다.
          </p>
        </section>

        {/* 면책조항 */}
        <section className="mt-10">
          <h2 className="text-xl font-semibold">6. 면책조항</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-(--notion-fg)/80">
            <li>
              AI 요약은 참고용이며, 원본 콘텐츠와 차이가 있을 수 있습니다.
              요약의 정확성을 보장하지 않습니다.
            </li>
            <li>
              서비스는 YouTube 및 외부 RSS 피드의 콘텐츠에 대해 책임을 지지
              않습니다.
            </li>
            <li>
              천재지변, 시스템 장애 등 불가항력에 의한 서비스 중단에 대해
              책임을 지지 않습니다.
            </li>
          </ul>
        </section>

        {/* 약관 변경 */}
        <section className="mt-10">
          <h2 className="text-xl font-semibold">7. 약관 변경</h2>
          <p className="mt-3 leading-relaxed text-(--notion-fg)/80">
            본 약관은 서비스 운영 상 필요한 경우 변경될 수 있으며, 변경 시 서비스
            내 공지를 통해 안내합니다. 변경된 약관에 동의하지 않는 경우 서비스
            이용을 중단할 수 있으며, 계정 탈퇴는 문의처를 통해 요청할 수 있습니다.
          </p>
        </section>

        {/* 문의처 */}
        <section className="mt-10">
          <h2 className="text-xl font-semibold">8. 문의처</h2>
          <p className="mt-3 leading-relaxed text-(--notion-fg)/80">
            서비스 이용 관련 문의는 아래 이메일로 연락해 주세요.
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
