'use strict';

const isProduction = process.env.NODE_ENV === 'production';

module.exports = {
  devtool: isProduction ? false : '#inline-source-map',
};
