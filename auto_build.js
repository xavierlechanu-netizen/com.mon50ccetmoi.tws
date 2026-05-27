const { spawn } = require('child_process');

const env = Object.assign({}, process.env, {
  JAVA_HOME: 'C:\\Program Files\\Android\\Android Studio\\jbr',
  ANDROID_HOME: 'C:\\Users\\xavie\\AppData\\Local\\Android\\Sdk'
});

const bw = spawn('npx.cmd', ['bubblewrap', 'build'], { env: env, shell: true });

bw.stdout.on('data', (data) => {
  const str = data.toString();
  console.log(str);
  if (str.includes('Password for the Key Store')) {
    bw.stdin.write('!Mon50cc!\n');
  }
  if (str.includes('Password for the Key:')) {
    bw.stdin.write('!Mon50cc!\n');
  }
});

bw.stderr.on('data', (data) => {
  console.error(data.toString());
});

bw.on('close', (code) => {
  console.log(`Process exited with code ${code}`);
  process.exit(code);
});
