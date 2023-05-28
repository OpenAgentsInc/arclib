module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    '@babel/preset-typescript', 
  ],
  plugins: [
      '@babel/plugin-proposal-class-static-block',
      [ '@babel/plugin-proposal-decorators', {legacy: true}],
      [ '@babel/plugin-proposal-class-properties', {loose: true}],
    ]
};
