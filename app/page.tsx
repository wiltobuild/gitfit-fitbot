import Link from "next/link";

const quickStarts = ["Build a better routine", "Find my next workout", "Keep the momentum"];

export default function Home() {
  return (
    <main className="landing-shell">
      <nav className="nav" aria-label="Main navigation">
        <Link className="brand" href="/" aria-label="GitFit home">
          <span className="brand-mark">G</span>
          <span>GitFit</span>
        </Link>
        <Link className="text-link" href="/chat">Open Fitbot <span aria-hidden="true">↗</span></Link>
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow"><span /> Your team is ready</p>
          <h1>Make your next move your strongest one.</h1>
          <p className="hero-description">Fitbot turns &ldquo;I should probably&rdquo; into a real plan. Tell it what you need, and it will help your fitness team get you moving.</p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/chat">Talk to Fitbot <span aria-hidden="true">→</span></Link>
            <a className="button button-quiet" href="#how-it-works">How it works</a>
          </div>
        </div>

        <div className="hero-orbit" aria-label="Fitness planning made simple">
          <div className="orbit-glow" />
          <div className="orbit-core"><span>FIT</span><strong>BOT</strong><i>✦</i></div>
          <div className="orbit-tag tag-top">YOUR GOALS</div>
          <div className="orbit-tag tag-right">YOUR PLAN</div>
          <div className="orbit-tag tag-bottom">YOUR WIN</div>
          <div className="orbit-dot dot-one" />
          <div className="orbit-dot dot-two" />
          <div className="orbit-dot dot-three" />
        </div>
      </section>

      <section className="starter-section" id="how-it-works">
        <div>
          <p className="eyebrow"><span /> Start where you are</p>
          <h2>A good first question is all it takes.</h2>
        </div>
        <div className="starter-list">
          {quickStarts.map((item, index) => <Link href="/chat" className="starter-card" key={item}><span>0{index + 1}</span>{item}<b>→</b></Link>)}
        </div>
      </section>

      <footer>GitFit <span>•</span> Move with purpose.</footer>
    </main>
  );
}
