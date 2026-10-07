// Git exports these to hooks, and the pre-commit hook runs the suite. Left in
// place, every `git` call a test makes in its sandbox would act on this
// repository instead, rewriting its config.
for (const name of [
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_INDEX_FILE',
  'GIT_COMMON_DIR',
  'GIT_OBJECT_DIRECTORY',
  'GIT_PREFIX',
]) {
  delete process.env[name];
}
