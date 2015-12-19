'use strict';

var gulp = require('gulp');
var prettify = require('gulp-jsbeautifier');
var babel = require('gulp-babel');
var changed = require('gulp-changed');
var del = require('del');
var electron = require('electron-connect').server.create({
  path: './build'
});
var packager = require('electron-packager');

var sources = ['**/*.js', '**/*.css', '**/*.html', '!**/node_modules/**', '!build/**', '!release/**'];
var build_dest = 'build';

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

gulp.task('build', ['build:copy', 'build:jsx']);

gulp.task('build:clean', function() {
  return del(build_dest + '/**/*');
});

gulp.task('build:copy', ['sync-meta'], function() {
  return gulp.src(['src/**', '!**/*.jsx'])
    .pipe(changed(build_dest))
    .pipe(gulp.dest(build_dest));
});

gulp.task('build:jsx', function() {
  return gulp.src(['src/**/*.jsx', '!src/node_modules/**'])
    .pipe(changed(build_dest, {
      extension: '.js'
    }))
    .pipe(babel({
      presets: ['react']
    }))
    .pipe(gulp.dest(build_dest));
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
    dir: './' + build_dest,
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
      console.log(err);
    }
    else {
      console.log('done');
    }
  });
};

gulp.task('package', ['build'], function() {
  makePackage(process.platform, 'all');
});

gulp.task('package:all', ['build'], function() {
  makePackage('all', 'all');
});

gulp.task('package:windows', ['build'], function() {
  makePackage('win32', 'all');
});

gulp.task('package:osx', ['build'], function() {
  makePackage('darwin', 'all');
});

gulp.task('package:linux', ['build'], function() {
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
