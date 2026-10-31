import Link from "next/link";
import AccountControl from "@/components/account-control";

export default function LandingPage() {
    return (
        <main className="landing-page">
            <header className="topbar landing-topbar">
                <Link className="brand" href="/">
                    <span className="brand-mark" aria-hidden="true">字</span>
                    <span>TrueKana</span>
                </Link>
                <div className="topbar-actions">
                    <AccountControl />
                </div>
            </header>
            <section className="landing-hero">
                <div className="landing-copy">
                    <p className="eyebrow">Japanese reading practice</p>
                    <h1>Build a better<br /><em>kanji habit.</em></h1>
                    <p className="landing-lede">
                        Study Japanese your way with focused decks, thoughtful
                        review scheduling, and progress that stays with you.
                    </p>
                    <div className="landing-actions">
                        <Link className="primary-button landing-primary" href="/dashboard">
                            Start studying <span>→</span>
                        </Link>
                        <Link className="landing-guest-link" href="/guest">
                            Try a guest drill <span>↗</span>
                        </Link>
                    </div>
                </div>
                <div className="landing-art" aria-hidden="true">
                    <div className="hero-orbit orbit-one" />
                    <div className="hero-orbit orbit-two" />
                    <div className="hero-card hero-card-back">読</div>
                    <div className="hero-card hero-card-main">
                        <span className="hero-card-label">Today&apos;s focus</span>
                        <strong>学</strong>
                        <span className="hero-card-reading">まなぶ · learn</span>
                    </div>
                    <span className="hero-star star-one">✦</span>
                    <span className="hero-star star-two">✧</span>
                </div>
            </section>
            <section className="landing-features">
                <article><span>01</span><h2>Choose your path</h2><p>Combine the decks that match your goals, from JLPT to future specialty collections.</p></article>
                <article><span>02</span><h2>Practice with rhythm</h2><p>Short queues and smart review timing keep each session focused and manageable.</p></article>
                <article><span>03</span><h2>Keep your progress</h2><p>Sign in to save your study sets, settings, accuracy, and long-term progress.</p></article>
            </section>
            <footer className="landing-footer">
                <span>TrueKana</span>
                <Link href="/guest">Guest mode</Link>
                <Link href="/login">Sign in</Link>
                <Link href="/privacy">Privacy</Link>
                <Link href="/terms">Terms</Link>
            </footer>
        </main>
    );
}
