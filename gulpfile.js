'use strict';

var gulp = require('gulp');
var prettify = require('gulp-jsbeautifier');
var diff = require('gulp-diff');
var esformatter = require('gulp-esformatter');
var esformatter_origin = require('esformatter');
var through = require('through2');
var electron = require('electron-connect').server.create({
  path: './dist'
});

const fs = require('fs');
const path = require('path');
const spawn = require('child_process').spawn;

const distPackageAuthor = 'Mattermost, Inc.';

var sources = ['**/*.js', '**/*.json', '**/*.css', '**/*.html', '!**/node_modules/**', '!dist/**', '!release/**', '!**/test_config.json'];

gulp.task('prettify', ['prettify:sources', 'prettify:jsx']);
gulp.task('prettify:verify', ['prettify:sources:verify', 'prettify:jsx:verify']);

var prettify_options = {
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
    brace_style: "end-expand",
    end_with_newline: true
  }
};

gulp.task('prettify:sources', ['sync-meta'], function() {
  return gulp.src(sources)
    .pipe(prettify(prettify_options))
    .pipe(prettify.reporter())
    .pipe(diff())
    .pipe(diff.reporter({
      quiet: true,
      fail: false
    }))
    .pipe(gulp.dest('.'));
});

gulp.task('prettify:sources:verify', function() {
  return gulp.src(sources)
    .pipe(prettify(prettify_options))
    .pipe(prettify.reporter())
    .pipe(diff())
    .pipe(diff.reporter({
      quiet: true,
      fail: true
    }));
});


var esformatter_jsx_options = {
  indent: {
    value: '  '
  },
  plugins: ['esformatter-jsx']
};

gulp.task('prettify:jsx', function() {
  return gulp.src('src/browser/**/*.jsx')
    .pipe(esformatter(esformatter_jsx_options))
    .pipe(gulp.dest('src/browser'));
});

gulp.task('prettify:jsx:verify', function() {
  return gulp.src('src/browser/**/*.jsx')
    .pipe(through.obj(function(file, enc, cb) {
      var result = esformatter_origin.diff.unified(file.contents.toString(), esformatter_origin.rc(file.path, esformatter_jsx_options));
      if (result !== "") {
        console.log('Error: ' + file.path + ' must be formatted');
        process.exit(1);
      }
      cb();
    }));
});


gulp.task('build', ['sync-meta', 'copy'], function(cb) {
  const appPackageJson = require('./src/package.json');
  const distPackageJson = Object.assign({}, appPackageJson, {
    author: {
      name: distPackageAuthor,
      email: 'noreply'
    }
  });
  fs.writeFile('./dist/package.json', JSON.stringify(distPackageJson, null, '  '), cb);
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
    .pipe(gulp.dest('dist/browser/modules/bootstrap'));
});

function spawnWebpack(config, cb) {
  const ext = process.platform === 'win32' ? '.cmd' : ''
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

gulp.task('watch', ['build', 'webpack:main', 'webpack:renderer'], function() {
  var options = ['--livereload'];
  electron.start(options);

  gulp.watch(['src/main.js', 'src/main/**/*.js', 'src/common/**/*.js'], ['webpack:main']);
  gulp.watch(['src/browser/**/*.js', 'src/browser/**/*.jsx'], ['webpack:renderer']);
  gulp.watch(['src/browser/**/*.css', 'src/browser/**/*.html', 'src/resources/**/*.png'], ['copy']);

  gulp.watch(['dist/main.js', 'dist/resources/**'], function() {
    electron.restart(options);
  });
  gulp.watch(['dist/browser/*.js'], electron.reload);
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
  fs.writeFileSync('./src/package.json', JSON.stringify(appPackageJson, null, '  ') + '\n');
});
