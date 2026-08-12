import { OrgDirectory } from '@/components/org-directory';

/**
 * Landing page: the organization directory. Charter is org-centric — the first
 * thing you do is pick a treasury to operate on, or create one. The directory
 * client component owns its own loading, empty, and error states.
 */
export default function HomePage() {
  return <OrgDirectory />;
}
