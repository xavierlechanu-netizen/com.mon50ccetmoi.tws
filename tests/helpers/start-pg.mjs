// Démarre un PostgreSQL portable pour les tests, affiche « READY <port> », puis s'arrête
// proprement quand le processus parent ferme l'entrée standard (ou envoie « stop »).
import EmbeddedPostgres from "embedded-postgres";
import fs from "fs";
import os from "os";
import path from "path";

const port = Number(process.argv[2]) || 54330;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mon50cc-pgtest-"));
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  user: "postgres",
  password: "test",
  port,
  persistent: false,
  onLog: () => {},
  onError: () => {},
});

let stopping = false;
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  await pg.stop().catch(() => {});
  fs.rmSync(dir, { recursive: true, force: true });
  process.exit(code);
}

try {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("mon50cc_test");
  process.stdout.write(`READY ${port}\n`);
} catch (e) {
  process.stdout.write(`FAILED ${e.message}\n`);
  await stop(1);
}

process.stdin.on("data", (d) => { if (String(d).includes("stop")) stop(0); });
process.stdin.on("end", () => stop(0));
process.on("SIGTERM", () => stop(0));
