const { parse, compileTemplate, compileStyle } = require("@vue/compiler-sfc");
const { transpileModule } = require("typescript");
const tsConfig = require("../../../tsconfig.json");
const babelJest = require("babel-jest");
const babelCommonjsPlugin = require("@babel/plugin-transform-modules-commonjs");

const { loadSrc } = require("./utils");

function processTemplate(template, filename, config) {
  if (!template) {
    return;
  }

  // could be <template src="./...."></template>
  if (template && template.src) {
    template.content = loadSrc(template.src, filename);
  }

  if (!template.content) {
    return;
  }

  // console.log('here!', template.content)

  const templateContent = compileTemplate({
    source: template.content,
    preprocessLang: template.lang,
    preprocessOptions: {
      // TODO: This should be a vue-jest option
      basedir: "./",
    },
    filename,
  });

  return transpileModule(templateContent.code, {}).outputText;
}

function processScript(script, filename, config) {
  if (!script) {
    return;
  }

  // could be <script src="./...."></script>
  if (script && script.src) {
    script.content = loadSrc(script.src, filename);
  }

  if (script.lang === "typescript" || script.lang === "ts") {
    return transpileModule(script.content, {}).outputText;
  }

  return script.content;
}

module.exports.process = function (source, filename) {
  const parsed = parse(source);

  const templateResult = processTemplate(parsed.descriptor.template, filename);
  const scriptResult = processScript(parsed.descriptor.script, filename);

  if (scriptResult && scriptResult.includes("render: function ()")) {
    // the user has written a render function
    return {
      filename,
      code: scriptResult + ";exports.default",
    };
  }

  const code =
    scriptResult +
    ";" +
    templateResult +
    ";exports.default = {...exports.default, render};";

  let commonCode = transpileModule(
    code,
    Object.assign(tsConfig, {
      compilerOptions: { module: "commonjs" },
    })
  ).outputText;

  return { code: commonCode, filename };
};
