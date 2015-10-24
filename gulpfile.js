'use strict';

var gulp = require('gulp');
var prettify = require('gulp-jsbeautifier');
var packager = require('electron-packager');
var packageJson = require('./src/package.json');

var sources = ['**/*.js', '**/*.css', '**/*.html', '!node_modules/**', '!release/**'];

gulp.task('prettify', function() {
  gulp.src(sources)
    .pipe(prettify({
      html: {
        indentSize: 2
      },
      css: {
        indentSize: 2
      },
      js: {
        indentSize: 2,
        braceStyle: "end-expand"
      }
    }))
    .pipe(gulp.dest('.'));
});

gulp.task('package', function() {
  packager({
    dir: './src',
    name: packageJson.name,
    platform: ['win32', 'darwin'],
    arch: 'all',
    version: '0.33.6',
    out: './release',
    overwrite: true
  }, function(err, appPath) {
    if (err) {
      console.log(err);
    }
    else {
      console.log('done');
    }
  });
});
