'use strict';

var gulp = require('gulp');
var prettify = require('gulp-jsbeautifier');

var sources = ['**/*.js', '**/*.css', '**/*.html', '!node_modules/**'];

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
