module.exports = {
  extends: ['@commitlint/config-conventional'],
  plugins: [
    {
      rules: {
        'no-ai-generated': parsed => {
          const message = parsed.raw;

          const forbiddenStrings = [
            '🤖 Generated with [Claude Code](https://claude.ai/code)',
            'Co-Authored-By: Claude <noreply@anthropic.com>',
          ];

          for (const forbiddenString of forbiddenStrings) {
            if (message.includes(forbiddenString)) {
              return [
                false,
                `Commit message contains forbidden AI-generated content: "${forbiddenString}"`,
              ];
            }
          }

          return [true, ''];
        },
      },
    },
  ],
  rules: {
    'type-case': [2, 'always', 'lower-case'],
    'type-empty': [2, 'never'],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'subject-max-length': [2, 'always', 72],
    'body-max-line-length': [2, 'always', 100],
    'footer-max-line-length': [2, 'always', 100],
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'build',
        'ci',
        'chore',
        'revert',
      ],
    ],
    'no-ai-generated': [2, 'always'],
  },
  helpUrl: 'https://github.com/conventional-changelog/commitlint/#what-is-commitlint',
};
