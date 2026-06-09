module.exports = {
  '*.{ts,js,mjs,cjs}': ['eslint --fix', 'prettier --write'],
  '*.{json,md,yml,yaml}': ['prettier --write'],
  '.ai/kenkeep/nodes/**/*.md': () => ['node ./dist/cli.js index rebuild --stage'],
};
