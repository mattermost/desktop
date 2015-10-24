'use strict';

var gulp = require('gulp');
var prettify = require('gulp-jsbeautifier');
var electron = require('electron-connect').server.create({
  path: './src'
});
var packager = require('electron-packager');
var packageJson = require('./src/package.json');

var sources = ['**/*.js', '**/*.css', '**/*.html', '!**/node_modules/**', '!release/**'];

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

gulp.task('serve', function() {
  var options = ['--livereload'];
  electron.start(options);
  gulp.watch(sources, function() {
    electron.broadcast('stop');
    electron.restart(options);
  });
});

gulp.task('package', function() {
  packager({
    dir: './src',
    name: packageJson.name,
    platform: ['win32', 'darwin'],
    arch: 'all',
    version: '0.33.6',
    out: './release',
    prune: true,
    overwrite: true,
    "app-version": packageJson.version
  }, function(err, appPath) {
    if (err) {
      console.log(err);
    }
    else {
      console.log('done');
    }
  });
});
