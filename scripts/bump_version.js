const fs = require('fs');
const path = require('path');

const walkSync = (dir, filelist = []) => {
  if (!fs.existsSync(dir)) return filelist;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const dirFile = path.join(dir, file);
    if (fs.statSync(dirFile).isDirectory()) {
      if (!['node_modules', 'dist', '.git'].includes(file)) {
        filelist = walkSync(dirFile, filelist);
      }
    } else {
      if (file.endsWith('.js') || file.endsWith('.html') || file.endsWith('.json') || file.endsWith('.md')) {
        filelist.push(dirFile);
      }
    }
  }
  return filelist;
};

const files = walkSync('.');
let updatedFiles = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let newContent = content
    .replace(/109\.00\.00/g, '110.00.00')
    .replace(/"version":\s*"109\.00\.00"/g, '"version": "110.00.00"');

  if (content !== newContent) {
    fs.writeFileSync(file, newContent, 'utf8');
    updatedFiles++;
    console.log('Updated: ' + file);
  }
}
console.log('Total files updated: ' + updatedFiles);
