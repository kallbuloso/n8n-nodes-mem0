const { src, dest, task } = require('gulp');

task('build:icons', function buildIcons() {
	return src('nodes/**/*.svg').pipe(dest('dist/nodes'));
});

task('default', task('build:icons'));
