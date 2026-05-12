module.exports = {
  '*': ['secretlint'],
  '.ai/knowledge-base/nodes/**/*.md': () => ['ai-knowledge-base index rebuild --stage'],
};
