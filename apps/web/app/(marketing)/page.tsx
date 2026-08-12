/**
 * Public marketing landing page at "/".
 *
 * Composes the landing sections in reading order. Each section is a
 * self-contained component under components/marketing/. The dashboard lives at
 * "/app" (see the (app) route group); this group owns "/" and its own light
 * neo-brutalist theme.
 */
import { Hero } from '../../components/marketing/hero';
import { SiteNav } from '../../components/marketing/site-nav';

export default function LandingPage() {
  return (
    <>
      <SiteNav />
      <main>
        <Hero />
      </main>
    </>
  );
}
