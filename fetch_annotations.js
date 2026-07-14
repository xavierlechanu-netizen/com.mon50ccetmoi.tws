const https = require('https');
https.get('https://api.github.com/repos/xavierlechanu-netizen/xavierlechanu-netizen.github.io/actions/runs?status=failure&per_page=1', {
  headers: { 'User-Agent': 'Node.js' }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    const data = JSON.parse(body);
    const runId = data.workflow_runs[0].id;
    https.get(`https://api.github.com/repos/xavierlechanu-netizen/xavierlechanu-netizen.github.io/actions/runs/${runId}/annotations`, {
      headers: { 'User-Agent': 'Node.js' }
    }, (res2) => {
      let body2 = '';
      res2.on('data', chunk => body2 += chunk);
      res2.on('end', () => console.log(body2));
    });
  });
});
