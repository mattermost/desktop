'use strict';

var gulp = require('gulp');
var prettify = require('gulp-jsbeautifier');
var babel = require('gulp-babel');
var webpack = require('webpack-stream');
var named = require('vinyl-named');
var changed = require('gulp-changed');
var esformatter = require('gulp-esformatter');
var del = require('del');
var electron = require('electron-connect').server.create({
  path: './dist'
});
var packager = require('electron-packager');

var sources = ['**/*.js', '**/*.css', '**/*.html', '!**/node_modules/**', '!dist/**', '!release/**'];

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
  return gulp.src('src/browser/**/*.jsx')
    .pipe(esformatter({
      indent: {
        value: '  '
      },
      plugins: ['esformatter-jsx']
    }))
    .pipe(gulp.dest('src/browser'));
});

gulp.task('build', ['sync-meta', 'webpack', 'copy'], function() {
  return gulp.src('src/package.json')
    .pipe(gulp.dest('dist'));
});

gulp.task('webpack', ['webpack:main', 'webpack:browser', 'webpack:webview']);

gulp.task('webpack:browser', function() {
  return gulp.src('src/browser/**/*.jsx')
    .pipe(named())
    .pipe(webpack({
      module: {
        loaders: [{
          test: /\.json$/,
          loader: 'json'
        }, {
          test: /\.jsx$/,
          loader: 'babel',
          query: {
            presets: ['react']
          }
        }]
      },
      output: {
        filename: '[name].js'
      },
      node: {
        __filename: false,
        __dirname: false
      },
      target: 'electron'
    }))
    .pipe(gulp.dest('dist/browser/'));
});

gulp.task('webpack:main', function() {
  return gulp.src('src/main.js')
    .pipe(webpack({
      module: {
        loaders: [{
          test: /\.json$/,
          loader: 'json'
        }]
      },
      output: {
        filename: '[name].js'
      },
      node: {
        __filename: false,
        __dirname: false
      },
      target: 'electron'
    }))
    .pipe(gulp.dest('dist/'));
});

gulp.task('webpack:webview', function() {
  return gulp.src('src/browser/webview/mattermost.js')
    .pipe(named())
    .pipe(webpack({
      output: {
        filename: '[name].js'
      },
      target: 'electron'
    }))
    .pipe(gulp.dest('dist/browser/webview'))
});

gulp.task('copy', ['copy:resources', 'copy:html/css', 'copy:modules']);

gulp.task('copy:resources', function() {
  return gulp.src('src/resources/**')
    .pipe(gulp.dest('dist/resources'));
});

gulp.task('copy:html/css', function() {
  return gulp.src(['src/browser/**/*.html', 'src/browser/**/*.css'])
    .pipe(gulp.dest('dist/browser'));
});

gulp.task('copy:modules', function() {
  return gulp.src(['src/node_modules/bootstrap/dist/**'])
    .pipe(gulp.dest('dist/browser/modules/bootstrap'))
});

gulp.task('watch', ['build'], function() {
  var options = ['--livereload'];
  electron.start(options);

  gulp.watch(['src/main.js', 'src/main/**/*.js', 'src/common/**/*.js'], ['webpack:main']);
  gulp.watch(['src/browser/**/*.js', 'src/browser/**/*.jsx'], ['webpack:browser', 'webpack:webview']);
  gulp.watch(['src/browser/**/*.css', 'src/browser/**/*.html', 'src/resources/**/*.png'], ['copy']);

  gulp.watch(['dist/main.js', 'dist/resources/**'], function() {
    electron.restart(options);
  });
  gulp.watch(['dist/browser/*.js'], electron.reload);
});

function makePackage(platform, arch, callback) {
  var packageJson = require('./src/package.json');
  packager({
    dir: './dist',
    platform: platform,
    arch: arch,
    version: require('./package.json').devDependencies['electron-prebuilt'],
    out: './release',
    prune: true,
    overwrite: true,
    "app-version": packageJson.version,
    icon: 'resources/electron-mattermost',
    "version-string": {
      CompanyName: packageJson.author,
      LegalCopyright: 'Copyright (c) 2015 ' + packageJson.author,
      FileDescription: packageJson.description,
      OriginalFilename: packageJson.productName + '.exe',
      ProductVersion: packageJson.version,
      ProductName: packageJson.productName,
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
  appPackageJson.productName = packageJson.productName;
  appPackageJson.version = packageJson.version;
  appPackageJson.description = packageJson.description;
  appPackageJson.author = packageJson.author;
  appPackageJson.license = packageJson.license;
  var fs = require('fs');
  fs.writeFileSync('./src/package.json', JSON.stringify(appPackageJson, null, '  ') + '\n');
});
