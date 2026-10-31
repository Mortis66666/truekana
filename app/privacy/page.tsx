import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | TrueKana",
  description: "How TrueKana handles your information.",
};

export default function PrivacyPage() {
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
        <p className="eyebrow">Privacy</p>
        <h1>Privacy policy</h1>
        <p className="legal-lede">
          TrueKana is built to help you practice Japanese reading. We do not
          sell, rent, or use your personal information for advertising or any
          purpose unrelated to providing and improving the service.
        </p>
        <section>
          <h2>Information we store</h2>
          <p>
            If you create an account, we store the account information needed
            to authenticate you. For signed-in study sets, we store your set
            names, selected decks, settings, and review progress so your
            practice can continue across visits and devices.
          </p>
        </section>
        <section>
          <h2>How we use it</h2>
          <p>
            We use this information only to operate TrueKana, authenticate
            your account, save your study progress, provide support, and
            improve the reliability and functionality of the service. We do
            not use it for unrelated purposes.
          </p>
        </section>
        <section>
          <h2>Sharing</h2>
          <p>
            We do not sell or share your information with third parties for
            their own marketing or unrelated purposes. Service providers that
            help us host, authenticate, or operate TrueKana may process
            information only as needed to provide those services.
          </p>
        </section>
        <section>
          <h2>Your choices</h2>
          <p>
            You can delete study-set progress or delete a study set from its
            settings page. To request account-related assistance or ask a
            privacy question, please contact the TrueKana project maintainer.
          </p>
        </section>
        <p className="legal-updated">Last updated: October 31, 2026</p>
      </article>
    </main>
  );
}
