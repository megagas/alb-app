'use client'

import { useState, useEffect } from 'react'

function TrustText() {
  const phrases = [
    "Don't trust us. Trust the code.",
    "The app may change. The contract never will.",
    "No middlemen. No trust required. Just Cardano.",
  ]
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIndex((i) => (i + 1) % phrases.length)
        setVisible(true)
      }, 800)
    }, 3500)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="h-16 flex items-center justify-center">
      <p
        className="text-2xl md:text-3xl font-semibold text-white/60 transition-opacity duration-700"
        style={{ opacity: visible ? 1 : 0 }}
      >
        {phrases[index]}
      </p>
    </div>
  )
}

export default function Home() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <main className="min-h-screen bg-[#0a0f1e] text-white font-sans">
      {/* Navbar */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? 'bg-[#0a0f1e]/90 backdrop-blur border-b border-white/10' : ''}`}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <span className="text-xl font-bold tracking-tight text-white">ADA LastBlock</span>
          <a href="/login" className="bg-blue-500 hover:bg-blue-400 text-white px-5 py-2 rounded-full text-sm font-medium transition">
            Get Started
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="min-h-screen flex flex-col items-center justify-center text-center px-6 pt-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-900/20 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-3xl">
          <div className="inline-block bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs px-4 py-1.5 rounded-full mb-8 tracking-widest uppercase">
            Powered by Cardano
          </div>
          <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-6 bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
            ADA LastBlock
          </h1>
          <p className="text-xl md:text-2xl text-blue-200/80 mb-4 leading-relaxed">
            When you're gone,<br />your ADA knows where to go.
          </p>
          <p className="text-white/40 text-sm mb-10">
            No lawyers. No middlemen. Just the blockchain.
          </p>
          <a href="/login" className="inline-block bg-blue-500 hover:bg-blue-400 text-white px-8 py-4 rounded-full text-lg font-semibold transition-all hover:scale-105 hover:shadow-lg hover:shadow-blue-500/25">
            Get Started — It's Free
          </a>
        </div>
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/30 text-xs animate-bounce">
          <span>scroll</span>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </section>

      {/* Section 1 — คืออะไร */}
      <section className="py-32 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">What is ADA LastBlock?</h2>
          <p className="text-white/60 text-lg leading-relaxed max-w-2xl mx-auto">
            A Dead Man's Switch for your ADA. If you don't check in within your chosen timeframe,
            your ADA automatically transfers to whoever you choose — no third party needed.
          </p>
          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: '🔒', title: 'On-chain', desc: 'Smart contract on Cardano. No server can stop it.' },
              { icon: '⚡', title: 'Automatic', desc: 'Triggers automatically. No one needs to do anything.' },
              { icon: '🧡', title: 'For your people', desc: 'Your family gets what you intended. Always.' },
            ].map((item) => (
              <div key={item.title} className="bg-white/5 border border-white/10 rounded-2xl p-8 hover:bg-white/8 transition">
                <div className="text-4xl mb-4">{item.icon}</div>
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 2 — How it works */}
      <section className="py-32 px-6 bg-white/[0.02]">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-bold text-center mb-16">How it works</h2>
          <div className="space-y-8">
            {[
              { step: '01', title: 'Set up your contract', desc: 'Choose your recipients, amounts, and check-in interval. Deploy to Cardano in minutes.' },
              { step: '02', title: 'Check in regularly', desc: 'Just tap check-in every month, 3 months, or however long you choose. Takes 10 seconds.' },
              { step: '03', title: "If you don't check in...", desc: 'Your ADA automatically transfers to your chosen recipients. No lawyers. No delays.' },
            ].map((item) => (
              <div key={item.step} className="flex gap-8 items-start">
                <div className="text-5xl font-bold text-blue-500/30 shrink-0 w-16">{item.step}</div>
                <div className="pt-2">
                  <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                  <p className="text-white/50 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section — Alert System */}
      <section className="py-32 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">We remind you before it's too late.</h2>
          <p className="text-white/60 text-lg mb-16">
            Get email alerts before your deadline. You'll always know when it's time to check in.
          </p>
          <div className="flex flex-col md:flex-row justify-center items-center gap-4">
            {[
              { days: '30 days', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
              { days: '15 days', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
              { days: '7 days', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
              { days: '3 days', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
              { days: '1 day', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
            ].map((item) => (
              <div key={item.days} className={`${item.bg} border rounded-2xl px-6 py-4 text-center min-w-[100px]`}>
                <div className={`${item.color} font-bold text-lg`}>{item.days}</div>
                <div className="text-white/40 text-xs mt-1">before</div>
              </div>
            ))}
          </div>
          <p className="text-white/30 text-sm mt-10">
            Alerts sent to both you and your recipients. No surprises.
          </p>
        </div>
      </section>

      {/* Section — Skip the lawyer */}
      <section className="py-32 px-6 bg-white/[0.02]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">Skip the lawyer</h2>
          <p className="text-white/60 text-lg mb-16">The math is simple.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-10">
              <div className="text-red-400 text-sm uppercase tracking-widest mb-4">Traditional Will</div>
              <div className="text-5xl font-bold text-red-400 mb-2">$300+</div>
              <div className="text-white/40 text-sm">Lawyer fees to set up</div>
              <div className="mt-6 text-white/30 text-sm space-y-2">
                <div>+ Months of waiting</div>
                <div>+ Court probate process</div>
                <div>+ No guarantee of execution</div>
              </div>
            </div>
            <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-10">
              <div className="text-blue-400 text-sm uppercase tracking-widest mb-4">ADA LastBlock</div>
              <div className="text-5xl font-bold text-blue-400 mb-2">0.05–0.5%</div>
              <div className="text-white/40 text-sm">One-time fee on payout</div>
              <div className="mt-6 text-white/30 text-sm space-y-2">
                <div>+ Instant execution</div>
                <div>+ No middleman</div>
                <div>+ Guaranteed by code</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section — Pricing */}
<section className="py-32 px-6">
  <div className="max-w-4xl mx-auto text-center">
    <h2 className="text-3xl md:text-5xl font-bold mb-6">Pricing</h2>
    <p className="text-white/60 text-lg mb-16">Simple and transparent.</p>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
      {/* Free */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-10 text-left">
        <div className="text-white/60 text-sm uppercase tracking-widest mb-4">Free</div>
        <div className="text-5xl font-bold mb-2">$0</div>
        <div className="text-white/40 text-sm mb-8">forever</div>
        <div className="space-y-3">
          {[
            { text: 'Deploy 1 contract', ok: true },
            { text: 'Cancel anytime', ok: true },
            { text: 'Automatic payout', ok: true },
            { text: 'Check-in to extend', ok: false },
            { text: 'Multiple contracts', ok: false },
          ].map((item) => (
            <div key={item.text} className="flex items-center gap-3 text-sm">
              <span className={item.ok ? 'text-green-400' : 'text-white/20'}>
                {item.ok ? '✓' : '✗'}
              </span>
              <span className={item.ok ? 'text-white/70' : 'text-white/20'}>{item.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Pro */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-10 text-left relative">
        <div className="absolute top-4 right-4 bg-blue-500 text-white text-xs px-3 py-1 rounded-full">Recommended</div>
        <div className="text-blue-400 text-sm uppercase tracking-widest mb-4">Pro</div>
        <div className="text-5xl font-bold mb-2">$10</div>
        <div className="text-white/40 text-sm mb-8">per year</div>
        <div className="space-y-3">
          {[
            { text: 'Unlimited contracts', ok: true },
            { text: 'Cancel anytime', ok: true },
            { text: 'Automatic payout', ok: true },
            { text: 'Check-in to extend', ok: true },
            { text: 'Priority support', ok: true },
          ].map((item) => (
            <div key={item.text} className="flex items-center gap-3 text-sm">
              <span className="text-green-400">✓</span>
              <span className="text-white/70">{item.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* Payout Fee */}
    <div className="bg-white/5 border border-white/10 rounded-2xl p-10 text-left">
      <div className="text-white/60 text-sm uppercase tracking-widest mb-6">Payout Fee (both plans)</div>
      <div className="space-y-3">
        {[
          { range: '$0 – $10,000', fee: '0.5%', example: 'e.g. $10,000 → pay $50' },
          { range: '$10,001 – $50,000', fee: '0.25%', example: 'e.g. $30,000 → pay $75' },
          { range: '$50,001 – $100,000', fee: '0.1%', example: 'e.g. $75,000 → pay $75' },
          { range: '$100,001+', fee: '0.05%', example: 'e.g. $200,000 → pay $100' },
        ].map((item) => (
          <div key={item.range} className="flex flex-col gap-1 text-sm border-b border-white/5 pb-3 last:border-0 last:pb-0">
            <div className="flex justify-between">
              <span className="text-white/40">{item.range}</span>
              <span className="text-blue-400 font-semibold">{item.fee}</span>
            </div>
            <div className="text-white/20 text-xs">{item.example}</div>
          </div>
        ))}
      </div>
    </div>
  </div>
</section>

      {/* CTA */}
      <section className="py-32 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">Your ADA deserves a plan.</h2>
          <p className="text-white/50 text-lg mb-10">Set it up in minutes. Sleep better tonight.</p>
          <a href="/login" className="inline-block bg-blue-500 hover:bg-blue-400 text-white px-10 py-5 rounded-full text-xl font-semibold transition-all hover:scale-105 hover:shadow-xl hover:shadow-blue-500/25">
            Get Started — It's Free
          </a>
        </div>
      </section>


      {/* Trust Section */}
      <section className="py-32 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <TrustText />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 px-6 text-center text-white/30 text-sm">
        <p>© 2026 ADA LastBlock. Built on Cardano.</p>
        <p className="mt-2 flex items-center justify-center gap-4">
          <a href="mailto:lastblock.app@gmail.com" className="hover:text-white transition">
            lastblock.app@gmail.com
          </a>
          <span>·</span>
          <a href="https://github.com/megagas/alb-app" target="_blank" className="hover:text-white transition">
            GitHub
          </a>
        </p>
      </footer>
    </main>
  )
}