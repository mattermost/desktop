'use strict';

var gulp = require('gulp');
var prettify = require('gulp-jsbeautifier');
var electron = require('electron-connect').server.create({
  path: './src'
});
var packager = require('electron-packager');

var sources = ['**/*.js', '**/*.css', '**/*.html', '!**/node_modules/**', '!release/**'];

gulp.task('prettify', ['sync-meta'], function() {
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

function makePackage(platform, arch) {
  var packageJson = require('./src/package.json');
  packager({
    dir: './src',
    name: packageJson.name,
    platform: platform,
    arch: arch,
    version: '0.35.1',
    out: './release',
    prune: true,
    overwrite: true,
    "app-version": packageJson.version,
    icon: 'resources/electron-mattermost'
  }, function(err, appPath) {
    if (err) {
      console.log(err);
    }
    else {
      console.log('done');
    }
  });
};

gulp.task('package', ['sync-meta'], function() {
  makePackage('all', 'all');
});

gulp.task('package:windows', ['sync-meta'], function() {
  makePackage('win32', 'all');
});

gulp.task('package:osx', ['sync-meta'], function() {
  makePackage('darwin', 'all');
});

gulp.task('package:linux', ['sync-meta'], function() {
  makePackage('linux', 'all');
});

gulp.task('sync-meta', function() {
  var appPackageJson = require('./src/package.json');
  var packageJson = require('./package.json');
  appPackageJson.name = packageJson.name;
  appPackageJson.version = packageJson.version;
  appPackageJson.description = packageJson.description;
  appPackageJson.author = packageJson.author;
  appPackageJson.license = packageJson.license;
  var fs = require('fs');
  fs.writeFileSync('./src/package.json', JSON.stringify(appPackageJson, null, '  ') + '\n');
});
