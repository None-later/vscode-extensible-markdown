module.exports.getHtmlTemplateSet = function (path, fs, encoding) {
    return {
        html: fs.readFileSync(path.join(__dirname, "/template-html.txt"), encoding),
        style: fs.readFileSync(path.join(__dirname + "/template-style.txt"), encoding),
        embeddedStyle: fs.readFileSync(path.join(__dirname + "/template-embedded-style.txt"), encoding),
        notFoundCss: fs.readFileSync(path.join(__dirname + "/template-not-found-css.txt"), encoding)
    }
}; //getHtmlTemplateSet

module.exports.getSettings = function (vscode, markdownId) { // see package.json, "configuration":
    const thisExtensionSection =
        vscode.workspace.getConfiguration("markdown.extension.convertToHtml");
    const thisMarkdownItOptionSection =
        vscode.workspace.getConfiguration("markdown.extension.convertToHtml.options");
    const sharedSection = vscode.workspace.getConfiguration(markdownId);
    const settings = {
        reportSuccess: thisExtensionSection["reportSuccess"],
        showHtmlInBrowser: thisExtensionSection["showHtmlInBrowser"],
        embedCss: thisExtensionSection["embedCss"],
        titleLocatorRegex: thisExtensionSection["titleLocatorRegex"],
        includeLocatorRegex: thisExtensionSection["includeLocatorRegex"],
        includeLocatorInvalidRegexMessageFormat: thisExtensionSection["includeLocatorInvalidRegexMessageFormat"],
        includeLocatorFileReadFailureMessageFormat: thisExtensionSection["includeLocatorFileReadFailureMessageFormat"],
        outputPath: thisExtensionSection["outputPath"],
        css: sharedSection["styles"],
        // options:
        headingId: thisMarkdownItOptionSection["headingId"],
        allowHTML: thisMarkdownItOptionSection["allowHTML"],
        linkify: thisMarkdownItOptionSection["linkify"],
        br: thisMarkdownItOptionSection["br"],
        typographer: thisMarkdownItOptionSection["typographer"],
        smartQuotes: thisMarkdownItOptionSection["smartQuotes"],
        additionalPlugins: thisMarkdownItOptionSection["additionalPlugins"],
    } //settings
    settings.titleDecorationType =
        vscode.window.createTextEditorDecorationType(
            thisExtensionSection["titleLocatorDecoratorStyle"]);
    if (!settings.additionalPlugins) return settings;
    settings.pluginSyntaxDecorators = [];
    for (let plugin in settings.additionalPlugins.plugins) {
        const pluginInstance = settings.additionalPlugins.plugins[plugin];
        if (!pluginInstance) continue;
        if (!pluginInstance.syntacticDecorators) continue;
        for (let decorator in pluginInstance.syntacticDecorators) {
            const decoratorInstance = pluginInstance.syntacticDecorators[decorator];
            if (!decoratorInstance) continue;
            if (!decoratorInstance.enable) continue;
            if (!decoratorInstance.regexString) continue;
            if (!decoratorInstance.style) continue;
            const decoratorData = {
                regexString: decoratorInstance.regexString,
                tooltipFormat: decoratorInstance.tooltipFormat,
                decorationType: vscode.window.createTextEditorDecorationType(
                    decoratorInstance.style)
            };
            settings.pluginSyntaxDecorators.push(decoratorData);
        } //loop decorators
    } //loop
    return settings;
}; //getSettings

module.exports.titleFinder = function (text, settings) {
    if (!settings.titleLocatorRegex) return null;
    try {
        const regexp = new RegExp(settings.titleLocatorRegex, "m");
        const found = regexp.exec(text);
        if (!found) return null;
        if (found.length < 2) return null; // match itself + group inside
        return { start: found.index, all: found[0], title: found[1] };
    } catch (ex) {
        return null;
    } //exception
}; //titleFinder

module.exports.getVSCodeRange = function (vscode, document, start, match) {
    return new vscode.Range(
        document.positionAt(start),
        document.positionAt(start + match.length));
} //getVSCodeRange

// usage:
// thenableRegex("1(.*?)2)", input, 0).then(function(start, len, groups) {
//     //...
// })
module.exports.thenableRegex = function (regexPattern, input, isMultiline) {
    let options = isMultiline ? "gm" : "g";
    try {
        const regexp = new RegExp(regexPattern, options);
        let match = regexp.exec(input);
        const then = function (callback) {
            while (match != null) {
                let groups = [];
                for (let index = 0; index < match.length; ++index)
                    groups.push(match[index]);
                callback(match.index, match[0].length, groups);
                match = regexp.exec(input);
            } //loop
        } // then
        return { then: then };
    } catch (ex) {
        return { then: function () { } };
    };
}; //thenableRegex

const replaceIncludes = function (context, input, settings) {
    const readFile = function(fileName) {
        try {
            return context.fs.readFileSync(fileName, context.encoding);
        } catch (ex) {
            return context.util.format(settings.formatFailureReadingFile, fileName);
        } //exception
    }; //readFile
    const invalidRegexMessage = context.util.format(settings.formatInvalidIncludeRegex, settings.includeRegexString);
    let result = input;
    const replaceOne = function (regex) {
        const match = regex.exec(result);
        if (!match) { result = invalidRegexMessage; return false; }
        if (match.length != 2) { result = invalidRegexMessage; return false; }
        result = result.replace(match[0], readFile(match[1]));
        return true;
    }; //replaceOne
    try {
        const regex = new RegExp(settings.includeRegexString);
        do { } while (replaceOne(regex));
        return result;
    } catch (ex) {
        return input;
    } //exception
}; //replaceIncludes
