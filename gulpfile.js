'use strict';

var gulp = require('gulp');
var prettify = require('gulp-jsbeautifier');
var electron = require('electron-connect').server.create({
  path: './src'
});
var packager = require('electron-packager');

var sources = ['**/*.js', '**/*.css', '**/*.html', '!**/node_modules/**', '!release/**'];

gulp.task('prettify', ['sync-meta'], function() {
  return gulp.src(sources)
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

function makePackage(platform, arch, callback) {
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
    icon: 'resources/electron-mattermost',
    "version-string": {
      CompanyName: packageJson.author,
      LegalCopyright: 'Copyright (c) 2015 ' + packageJson.author,
      FileDescription: packageJson.name,
      OriginalFilename: packageJson.name + '.exe',
      ProductVersion: packageJson.version,
      ProductName: packageJson.name,
      InternalName: packageJson.name
    }
  }, function(err, appPath) {
    if (err) {
      callback(err);
    }
    else {
      callback();
    }
  });
};

gulp.task('package', ['sync-meta'], function(cb) {
  makePackage(process.platform, 'all', cb);
});

gulp.task('package:all', ['sync-meta'], function(cb) {
  makePackage('all', 'all', cb);
});

gulp.task('package:windows', ['sync-meta'], function(cb) {
  makePackage('win32', 'all', cb);
});

gulp.task('package:osx', ['sync-meta'], function(cb) {
  makePackage('darwin', 'all', cb);
});

gulp.task('package:linux', ['sync-meta'], function(cb) {
  makePackage('linux', 'all', cb);
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
