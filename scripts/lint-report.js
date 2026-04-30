const {execSync} = require('child_process')
const out = execSync('node node_modules/eslint/bin/eslint.js src --format json', {encoding:'utf8'})
const data = JSON.parse(out)
for (const f of data) {
  for (const m of f.messages) {
    if (m.severity === 2) {
      const fn = f.filePath.replace(/^.*[/\\]src[/\\]/, '')
      console.log(fn + ':' + m.line + ' [' + m.ruleId + ']')
    }
  }
}
