const fs = require('fs');

let h = fs.readFileSync('index.html', 'utf8');
h = h.replace(/\?v=60000/g, '?v=60015');
h = h.replace(/v50\.1\.9-GOLD-ULTIMATE/g, 'v60.0.15-GOLD');
h = h.replace(/v60\.0\.14-GOLD/g, 'v60.0.15-GOLD');
fs.writeFileSync('index.html', h);

let s = fs.readFileSync('sw.js', 'utf8');
s = s.replace(/v50109-GOLD/g, 'v60015-GOLD');
fs.writeFileSync('sw.js', s);

console.log('Version bumped to 60.0.15 in index.html and sw.js');
