import Link from "next/link";

export const metadata = {
  title: "Terms of Service | TrueKana",
  description: "The terms that apply when you use TrueKana.",
};

export default function TermsPage() {
  return (
    <main className="account-page legal-page">
      <header className="topbar">
        <Link className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">字</span>
          <span>TrueKana</span>
        </Link>
        <Link className="text-button header-link back-link" href="/">
          <span aria-hidden="true">←</span> Home
        </Link>
      </header>
      <article className="legal-content">
        <p className="eyebrow">Terms</p>
        <h1>Terms of service</h1>
        <p className="legal-lede">
          By using TrueKana, you agree to use the service responsibly and to
          these terms. If you do not agree, please do not use TrueKana.
        </p>
        <section>
          <h2>Using TrueKana</h2>
          <p>
            TrueKana provides Japanese reading practice, including guest
            drills and account-based study sets. You are responsible for
            providing accurate account information and for keeping your
            account credentials secure.
          </p>
        </section>
        <section>
          <h2>Acceptable use</h2>
          <p>
            Do not misuse, disrupt, or attempt to gain unauthorized access to
            TrueKana or its accounts, data, systems, or services. Do not use
            TrueKana in a way that violates applicable law or infringes the
            rights of others.
          </p>
        </section>
        <section>
          <h2>Your content and data</h2>
          <p>
            You retain responsibility for information you submit, including
            study-set names and settings. We use account and study data to
            provide TrueKana as described in our{" "}
            <Link href="/privacy">Privacy Policy</Link>.
          </p>
        </section>
        <section>
          <h2>Service availability</h2>
          <p>
            TrueKana is provided on an ongoing basis, but availability,
            features, and content may change. We may suspend or discontinue
            parts of the service when reasonably necessary for maintenance,
            security, or product changes.
          </p>
        </section>
        <section>
          <h2>Educational service</h2>
          <p>
            TrueKana is a study aid and does not guarantee a particular
            learning result, examination score, or level of fluency. You
            should independently verify information when accuracy is
            important.
          </p>
        </section>
        <section>
          <h2>Disclaimer and limitation</h2>
          <p>
            To the extent permitted by law, TrueKana is provided without
            warranties, and we are not liable for indirect, incidental, or
            consequential loss arising from your use of the service. Nothing
            in these terms limits rights that cannot legally be limited.
          </p>
        </section>
        <section>
          <h2>Changes and termination</h2>
          <p>
            We may update these terms as TrueKana evolves. Continued use after
            an update means you accept the revised terms. You may stop using
            TrueKana at any time, and we may suspend access for violations of
            these terms or to protect the service and its users.
          </p>
        </section>
        <p className="legal-updated">Last updated: October 31, 2026</p>
      </article>
    </main>
  );
}
