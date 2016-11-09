'use strict';

var gulp = require('gulp');
var prettify = require('gulp-jsbeautifier');
var diff = require('gulp-diff');
var electron = require('electron-connect').server.create({
  path: './dist'
});

const fs = require('fs');
const path = require('path');
const spawn = require('child_process').spawn;

const distPackageAuthor = 'Mattermost, Inc.';

var sources = ['**/*.js', '**/*.json', '**/*.css', '**/*.html', '!**/node_modules/**', '!dist/**', '!release/**', '!**/test_config.json'];

gulp.task('prettify', ['prettify:sources']);
gulp.task('prettify:verify', ['prettify:sources:verify']);

var prettifyOptions = {
  html: {
    indent_size: 2,
    end_with_newline: true
  },
  css: {
    indent_size: 2,
    end_with_newline: true
  },
  js: {
    indent_size: 2,
    brace_style: 'end-expand',
    end_with_newline: true
  }
};

gulp.task('prettify:sources', ['sync-meta'], () => {
  return gulp.src(sources).
    pipe(prettify(prettifyOptions)).
    pipe(prettify.reporter()).
    pipe(diff()).
    pipe(diff.reporter({
      quiet: true,
      fail: false
    })).
    pipe(gulp.dest('.'));
});

gulp.task('prettify:sources:verify', () => {
  return gulp.src(sources).
    pipe(prettify(prettifyOptions)).
    pipe(prettify.reporter()).
    pipe(diff()).
    pipe(diff.reporter({
      quiet: true,
      fail: true
    }));
});

gulp.task('build', ['sync-meta', 'copy'], (cb) => {
  const appPackageJson = require('./src/package.json');
  const distPackageJson = Object.assign({}, appPackageJson, {
    author: {
      name: distPackageAuthor,
      email: 'noreply'
    }
  });
  fs.writeFile('./dist/package.json', JSON.stringify(distPackageJson, null, '  '), cb);
});

gulp.task('copy', ['copy:assets', 'copy:html/css', 'copy:modules']);

gulp.task('copy:assets', () => {
  return gulp.src('src/assets/**').
    pipe(gulp.dest('dist/assets'));
});

gulp.task('copy:html/css', () => {
  return gulp.src(['src/browser/**/*.html', 'src/browser/**/*.css']).
    pipe(gulp.dest('dist/browser'));
});

gulp.task('copy:modules', () => {
  return gulp.src(['src/node_modules/bootstrap/dist/**']).
    pipe(gulp.dest('dist/browser/modules/bootstrap'));
});

function spawnWebpack(config, cb) {
  const ext = process.platform === 'win32' ? '.cmd' : '';
  spawn(path.resolve(`./node_modules/.bin/webpack${ext}`), ['--config', config], {
    stdio: 'inherit'
  }).on('exit', (code) => {
    cb(code);
  });
}

gulp.task('webpack:main', (cb) => {
  spawnWebpack('webpack.config.main.js', cb);
});

gulp.task('webpack:renderer', (cb) => {
  spawnWebpack('webpack.config.renderer.js', cb);
});

gulp.task('watch', ['build', 'webpack:main', 'webpack:renderer'], () => {
  var options = ['--livereload'];
  electron.start(options);

  gulp.watch(['src/main.js', 'src/main/**/*.js', 'src/common/**/*.js'], ['webpack:main']);
  gulp.watch(['src/browser/**/*.js', 'src/browser/**/*.jsx'], ['webpack:renderer']);
  gulp.watch(['src/browser/**/*.css', 'src/browser/**/*.html', 'src/assets/**/*.png'], ['copy']);

  gulp.watch(['dist/main.js', 'dist/assets/**'], () => {
    electron.restart(options);
  });
  gulp.watch(['dist/browser/*.js'], electron.reload);
});

gulp.task('sync-meta', () => {
  var appPackageJson = require('./src/package.json');
  var packageJson = require('./package.json');
  appPackageJson.name = packageJson.name;
  appPackageJson.productName = packageJson.productName;
  appPackageJson.version = packageJson.version;
  appPackageJson.description = packageJson.description;
  appPackageJson.author = packageJson.author;
  appPackageJson.license = packageJson.license;
  fs.writeFileSync('./src/package.json', JSON.stringify(appPackageJson, null, '  ') + '\n');
});
