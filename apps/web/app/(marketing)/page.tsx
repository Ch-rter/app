/**
 * Public marketing landing page at "/".
 *
 * Composes the landing sections in reading order. Each section is a
 * self-contained component under components/marketing/. The dashboard lives at
 * "/app" (see the (app) route group); this group owns "/" and its own light
 * neo-brutalist theme.
 */
import { Contributors } from '../../components/marketing/contributors';
import { Hero } from '../../components/marketing/hero';
import { HowItWorks } from '../../components/marketing/how-it-works';
import { Problem } from '../../components/marketing/problem';
import { Proof } from '../../components/marketing/proof';
import { SiteFooter } from '../../components/marketing/site-footer';
import { SiteNav } from '../../components/marketing/site-nav';

export default function LandingPage() {
  return (
    <>
      {/*
       * Skip link — the first focusable element, hidden until focused. Lets
       * keyboard users jump past the sticky nav straight to the content. It
       * reveals as a gold pill top-left; z-modal clears the sticky header
       * (z-sticky) since it renders earlier in the DOM.
       */}
      <a
        href="#main-content"
        className="sr-only rounded-card border-2 border-ink bg-ledger-gold px-4 py-2 text-[15px] font-medium text-ink shadow-brutal focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-modal"
      >
        Skip to content
      </a>
      <SiteNav />
      <main id="main-content">
        <Hero />
        <Problem />
        <HowItWorks />
        <Proof />
        <Contributors />
      </main>
      <SiteFooter />
    </>
  );
}
