/**
 * External destinations referenced across the landing page, defined once so
 * they never drift between sections.
 *
 * Repo, issues, and maintainer URLs are verified against the repository README
 * (github.com/Ch-rter/app and /contract; maintainer @fadesany). DOCS_URL is the
 * documentation site given in the build brief; nothing in the repository
 * confirms it resolves (.gitbook.yaml is empty), so it is called out for
 * confirmation in the PR. CONTRIBUTING_URL points at the README's Contributing
 * section on the default branch, which is guaranteed to resolve, rather than a
 * GitBook deep link whose slug could not be verified.
 */
export const DOCS_URL = 'https://chusdrter.gitbook.io/chusdrter-docs';
export const REPO_APP_URL = 'https://github.com/Ch-rter/app';
export const REPO_CONTRACT_URL = 'https://github.com/Ch-rter/contract';
export const ISSUES_URL = 'https://github.com/Ch-rter/app/issues';
/**
 * Open issues filtered to the `good first issue` label — the exact label the
 * README (Contributing) points first-time contributors at. A label filter URL
 * always resolves on GitHub even when the result set is empty.
 */
export const GOOD_FIRST_ISSUES_URL =
  'https://github.com/Ch-rter/app/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22';
export const CONTRIBUTING_URL = 'https://github.com/Ch-rter/app#contributing';
export const MAINTAINER_URL = 'https://github.com/fadesany';
export const MAINTAINER_HANDLE = 'fadesany';
