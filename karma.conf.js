module.exports = function(config) {
    const fileListGlob = "Future.ts";
    //Allow for filtering down files to run to just match the item passed in
    let clientArgs = {};
    if(config.filter){
        clientArgs = {
            args: ['--grep', config.filter]
        };
    }

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
        client: clientArgs,
        browserNoActivityTimeout: 20000,
        browsers: ["ChromeHeadless"],
        singleRun: true,
        karmaTypescriptConfig: {
            compilerOptions: {
                target: "es6",
            }
        }
    });
};