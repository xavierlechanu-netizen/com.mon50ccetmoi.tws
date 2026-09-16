const fs = require('fs');
const files = fs.readdirSync('.').filter(f => f.endsWith('.html'));

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  
  // Replace src="js/ with type="module" src="/js/
  content = content.replace(/<script([^>]*)src="js\//g, (match, p1) => {
    if (p1.includes('type="module"')) {
      return `<script${p1}src="/js/`;
    } else {
      return `<script type="module"${p1}src="/js/`;
    }
  });

  // Replace src="dist/js/ with type="module" src="/dist/js/
  content = content.replace(/<script([^>]*)src="dist\/js\//g, (match, p1) => {
    if (p1.includes('type="module"')) {
      return `<script${p1}src="/dist/js/`;
    } else {
      return `<script type="module"${p1}src="/dist/js/`;
    }
  });

  fs.writeFileSync(file, content);
  console.log(`Updated ${file}`);
}
