'use strict';

var gulp = require('gulp');
var prettify = require('gulp-jsbeautifier');
var babel = require('gulp-babel');
var changed = require('gulp-changed');
var esformatter = require('gulp-esformatter');
var del = require('del');
var electron = require('electron-connect').server.create({
  path: './src'
});
var packager = require('electron-packager');

var sources = ['**/*.js', '**/*.css', '**/*.html', '!**/node_modules/**', '!**/build/**', '!release/**'];
var app_root = 'src';

gulp.task('prettify', ['prettify:sources', 'prettify:jsx']);

gulp.task('prettify:sources', ['sync-meta'], function() {
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

gulp.task('prettify:jsx', function() {
  return gulp.src(app_root + '/**/*.jsx')
    .pipe(esformatter({
      indent: {
        value: '  '
      },
      plugins: ['esformatter-jsx']
    }))
    .pipe(gulp.dest(app_root));
});

gulp.task('build', ['build:jsx']);

gulp.task('build:jsx', function() {
  return gulp.src(['src/browser/**/*.jsx', '!src/node_modules/**'])
    .pipe(changed(app_root, {
      extension: '.js'
    }))
    .pipe(babel({
      presets: ['react']
    }))
    .pipe(gulp.dest('src/browser/build'));
});

gulp.task('serve', ['build'], function() {
  var options = ['--livereload'];
  electron.start(options);
  gulp.watch(['src/**', '!src/browser/**', '!src/node_modules/**'], function() {
    electron.restart(options);
  });
  gulp.watch('src/browser/**/*.jsx', ['build:jsx']);
  gulp.watch(['src/browser/**', '!src/browser/**/*.jsx'], electron.reload);
  gulp.watch('gulpfile.js', process.exit);
});

function makePackage(platform, arch, callback) {
  var packageJson = require('./src/package.json');
  packager({
    dir: './' + app_root,
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

gulp.task('package', ['build'], function(cb) {
  makePackage(process.platform, 'all', cb);
});

gulp.task('package:all', ['build'], function(cb) {
  makePackage('all', 'all', cb);
});

gulp.task('package:windows', ['build'], function(cb) {
  makePackage('win32', 'all', cb);
});

gulp.task('package:osx', ['build'], function(cb) {
  makePackage('darwin', 'all', cb);
});

gulp.task('package:linux', ['build'], function(cb) {
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
