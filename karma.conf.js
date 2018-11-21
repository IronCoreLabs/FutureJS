module.exports = function(config) {
    config.set({
        frameworks: ["jasmine", "karma-typescript", "jasmine-matchers"],
        files: [{pattern: "*.ts"}],
        preprocessors: {
            "*.ts": ["karma-typescript"],
        },
        reporters: ["spec", "karma-typescript"],
        specReporter: {
            suppressSkipped: true,
            showSpecTiming: true,
        },
        browserNoActivityTimeout: 20000,
        browsers: ["ChromeHeadlessNoSandbox"],
        //https://docs.travis-ci.com/user/chrome#Sandboxing
        customLaunchers: {
            ChromeHeadlessNoSandbox: {
                base: "ChromeHeadless",
                flags: ["--no-sandbox"],
            },
        },
        singleRun: true,
        karmaTypescriptConfig: {
            compilerOptions: {
                target: "es6",
                types: ["jasmine", "jasmine-expect"],
            },
        },
    });
};
