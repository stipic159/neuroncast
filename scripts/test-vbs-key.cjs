const cp = require('child_process');
const fs = require('fs');
const path = require('path');

const vbsPath = path.join(__dirname, 'sendkey.vbs');
fs.writeFileSync(vbsPath, `
Set WshShell = CreateObject("WScript.Shell")
WshShell.SendKeys WScript.Arguments(0)
`, 'utf8');

console.time('vbs-sendkeys');
cp.exec(`cscript //Nologo "${vbsPath}" 1`, (err) => {
  console.timeEnd('vbs-sendkeys');
  if (err) console.error(err);
  else console.log('VBS SendKeys 1 success!');
  try { fs.unlinkSync(vbsPath); } catch(_) {}
});
