# Drupal retrieval evaluation corpus

This is a frozen 26-node subset of the
[`e0ipso/kenkeep-pack-drupal`](https://github.com/e0ipso/kenkeep-pack-drupal)
knowledge pack at commit `9da328b488577b0679d79721f4f4c68045ee2cd3`.
The adjacent `LICENSE` is copied from that revision.

## Selection

The corpus contains every markdown leaf in the upstream `knowledge/apis/`
and `knowledge/security/` branches, plus
`knowledge/quality/practice-test-jsonrpc-through-handler-and-http.md`.
Generated `index.md` files are excluded. This selection supplies realistic
API, access-control, validation, file-security, XSS, SQL-injection, and test
vocabulary while retaining the explicit JSON-RPC and security graph edges
used by retrieval goldens. Golden graph-boost cases must only use edges whose
two `kk_id` endpoints are present in this fixture.

## Refresh procedure

Refresh deliberately; never use `pack import` and never fetch at test time.

1. Clone `https://github.com/e0ipso/kenkeep-pack-drupal.git` into a temporary
   directory and check out the desired immutable commit.
2. Replace the fixture with verbatim markdown leaves from `knowledge/apis/`
   and `knowledge/security/`, excluding every `index.md`, then copy
   `knowledge/quality/practice-test-jsonrpc-through-handler-and-http.md`.
   Preserve the upstream topical paths, filenames, and OKF-v3 frontmatter.
3. Copy the upstream `LICENSE` beside this README and update the commit SHA in
   this document.
4. Re-run the fixture count, OKF-v3 loader/schema, filename/`kk_id`, and graph
   endpoint checks. Review the diff to ensure no generated indexes were added.
5. Re-author and revalidate every affected golden query and expected ranking;
   a corpus refresh must not carry old goldens forward without review.

The checked-in fixture is self-contained and is the only corpus used during
tests.
