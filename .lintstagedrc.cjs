module.exports = {
  '.ai/knowledge-base/nodes/**/*.md': () => ['npx ai-knowledge-base index rebuild --stage'],
};
