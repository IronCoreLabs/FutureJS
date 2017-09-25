module.exports = function(config) {
    config.set({
        frameworks: ["jasmine", "karma-typescript", "jasmine-matchers"],
        files: [
            {pattern: "*.ts"}
        ],
        preprocessors: {
            "*.ts": ["karma-typescript"],
        },
        reporters: ["spec", "karma-typescript"],
        specReporter: {
            suppressSkipped: true,
            showSpecTiming: true
        },
        browserNoActivityTimeout: 20000,
        browsers: ["ChromeHeadless"],
        singleRun: true,
        karmaTypescriptConfig: {
            compilerOptions: {
                target: "es6",
            },
        }
    });
};