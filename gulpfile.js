"use strict";

var gulp       = require("gulp");
var uglify     = require("gulp-uglify");
var concat     = require("gulp-concat");
var del        = require("del");
var size       = require("gulp-filesize");
var sass       = require("gulp-sass");
var sourcemaps = require("gulp-sourcemaps");
var jshint     = require("gulp-jshint");
var jscs       = require("gulp-jscs");
var autopre    = require("gulp-autoprefixer");
var autopoly   = require("gulp-autopolyfiller");
var merge      = require("event-stream").merge;
var order      = require("gulp-order");
var nodemon    = require("gulp-nodemon");
var mocha      = require("gulp-mocha");
var complexity = require("gulp-complexity");
var todo       = require("gulp-todo");
var responsive = require("gulp-responsive");

var paths = {
   scripts   : "resources/scripts/",
   sass      : "resources/sass/",
   styles    : "resources/styles/",
   scriptdist: "resources/scripts-dist/",
   libs      : "libs/",
   handlers  : "pages/handlers/",
   tests     : "test/",
   images    : "resources/images/",
   respImages: "resources/images-resp/"
};

var src = [
   "*.js",
   paths.tests    + "*.js",
   paths.libs     + "*.js",
   paths.handlers + "**/*.js"
];

var browsers = ["last 2 versions", "ie 8", "ie 9"];

var autoPreSettings = {
   browsers: browsers
};

var autoPolySettings = {
   browsers: browsers
};

var sassSettings = {
   outputStyle: "compressed"
};

var noDemonSettings = {
   script: "main.js",
   watch : [
      "libs",
      "tests",
      "pages",
      "resources/scripts",
      "resources/sass"
   ],
   ext   : "js json",
   tasks : ["lint", "scripts", "sass"]
};

var responsiveSettings = {
   "*": [
      {
         width : 300,
         rename: { suffix: "-SMALL" }
      },
      {
         width : 300,
         rename: {
            suffix : "-SMALL",
            extname: ".webp"
         },
         format: "webp"
      },
      {
         width : 500,
         rename: { suffix: "-MEDIUM" }
      },
      {
         width : 500,
         rename: {
            suffix : "-MEDIUM",
            extname: ".webp"
         },
         format: "webp"
      },
      {

         width : 1000,
         rename: { suffix: "-BIG" }
      },
      {
         width :1000,
         rename: {
            suffix: "-BIG",
            extname: ".webp"
         },
         format: "webp"
      },

   ]
};

gulp.task("images", function() {
   gulp.src(paths.images + "*.{jpg,png}")
      .pipe(responsive(responsiveSettings))
      .pipe(gulp.dest(paths.respImages));
});

gulp.task("clean", function() {
   return del([
      paths.scripts  + "*.js~",
      paths.sass     + "**/*.js~",
      paths.libs     + "*.js~",
      paths.handlers + "**/*.js~",
      paths.tests    + "*.js~",
      paths.respImages + "*.{png,jpg,jpeg,webp}",
      paths.scriptsdist + "*.js",
      paths.styles + "*.css"
   ]);
});

gulp.task("build", ["clean", "sass", "scripts", "images"]);

gulp.task("complexity", function() {
   return gulp.src(src)
      .pipe(complexity());
});

gulp.task("todo", function() {
   return gulp.src(src)
      .pipe(todo())
      .pipe(gulp.dest("./"));
});

gulp.task("dev", function() {
   nodemon(noDemonSettings);
});

gulp.task("lint", function() {
   var tests = paths.tests + "*.js";
   var srcWithoutTests = src.slice(0);
   srcWithoutTests.push("!" + tests);
   gulp.src(srcWithoutTests)
      .pipe(jshint(".jshintrc"))
      .pipe(jshint.reporter())
      .pipe(jscs())
      .pipe(jscs.reporter("console"));

   gulp.src(tests)
      .pipe(jshint("test/.jshintrc"))
      .pipe(jshint.reporter())
      .pipe(jscs({configPath: "test/.jscsrc" }))
      .pipe(jscs.reporter("console"));
});

gulp.task("test", function() {
   return gulp.src(paths.tests + "*.js")
      .pipe(mocha());
});
gulp.task("scripts", function() {
   var allScripts = gulp.src(paths.scripts + "*.js")
          .pipe(jshint(paths.scripts + ".jshintrc"))
          .pipe(jscs({configpath: paths.scripts + ".jscsrc"}))
          .pipe(jscs.reporter("inline"))
          .pipe(size())
          .pipe(concat("scripts.js"));

   /* Add polyfills where necessary */
   var polys = allScripts.pipe(autopoly("polyfills.js"),
                               autoPolySettings)
          .pipe(size());

   /* Merge, map and uglify */
   return merge(polys, allScripts)
      .pipe(order(["polyfills.js", "scripts.js"]))
      .pipe(sourcemaps.init())
      .pipe(concat("scripts.min.js"))
      .pipe(uglify())
      .pipe(size())
      .pipe(sourcemaps.write("../scripts-maps"))
      .pipe(gulp.dest(paths.scriptdist));
});

gulp.task("sass", function() {
   return gulp.src(paths.sass + "/*.scss")
      .pipe(sass(sassSettings)
      .on("error", sass.logError))
      .pipe(autopre(autoPreSettings))
      .pipe(gulp.dest(paths.styles));
});

gulp.task("watch", function() {
   gulp.watch(paths.scripts + "*.js", ["scripts"]);
   gulp.watch(paths.sass + "**/*.scss", ["sass"]);
   gulp.watch(src, ["lint", "test"]);
   gulp.watch(src, ["todo"]);
});

gulp.task("default", function() {
});
