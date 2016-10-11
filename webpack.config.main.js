module.exports = {
  entry: './src/main.js',
  output: {
    filename: './dist/main.js'
  },
  module: {
    loaders: [{
      test: /\.json$/,
      loader: 'json'
    }]
  },
  node: {
    __filename: false,
    __dirname: false
  },
  target: 'electron-main',
  externals: {
    remote: true // for electron-connect
  }
};
