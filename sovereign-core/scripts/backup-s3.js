/**
 * Envoi et récupération des sauvegardes chiffrées de la base dans l'Object Storage OVHcloud.
 * Utilisé par deploy/backup.sh et deploy/restore.sh, dans le conteneur de l'API
 * (qui a déjà le SDK S3) : aucun outil à installer sur le VPS.
 *
 *   node scripts/backup-s3.js put   <fichier>          → envoie dans postgres/<nom du fichier>
 *   node scripts/backup-s3.js get   <nom> <destination> → télécharge postgres/<nom>
 *   node scripts/backup-s3.js list                     → liste les sauvegardes, la plus récente en premier
 *   node scripts/backup-s3.js prune <jours>            → supprime celles plus vieilles que <jours>
 *
 * Variables : BACKUP_S3_BUCKET, BACKUP_S3_ENDPOINT, BACKUP_S3_REGION,
 *             BACKUP_S3_ACCESS_KEY_ID, BACKUP_S3_SECRET_ACCESS_KEY.
 * Les fichiers sont déjà chiffrés avant l'envoi (deploy/backup.sh) : le stockage ne voit rien en clair.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const PREFIX = "postgres/";
// Seuls des noms produits par backup.sh sont acceptés : pas de « ../ », pas de chemin.
const NAME_RE = /^mon50cc-\d{8}-\d{6}\.dump\.enc$/;

function configFromEnv(env = process.env) {
    const cfg = {
        bucket: env.BACKUP_S3_BUCKET,
        endpoint: env.BACKUP_S3_ENDPOINT || "https://s3.gra.io.cloud.ovh.net",
        region: env.BACKUP_S3_REGION || "gra",
        accessKeyId: env.BACKUP_S3_ACCESS_KEY_ID,
        secretAccessKey: env.BACKUP_S3_SECRET_ACCESS_KEY,
    };
    for (const [k, v] of Object.entries(cfg)) {
        if (!v) throw new Error(`Configuration S3 des sauvegardes incomplète : ${k} manquant.`);
    }
    return cfg;
}

function makeClient(cfg) {
    const { S3Client } = require("@aws-sdk/client-s3");
    return new S3Client({
        endpoint: cfg.endpoint,
        region: cfg.region,
        forcePathStyle: true,
        credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
    });
}

function checkName(name) {
    if (!NAME_RE.test(name)) throw new Error(`Nom de sauvegarde invalide : ${name}`);
    return name;
}

async function put(s3, cfg, file) {
    const { PutObjectCommand } = require("@aws-sdk/client-s3");
    const name = checkName(path.basename(file));
    const body = fs.readFileSync(file);
    await s3.send(new PutObjectCommand({ Bucket: cfg.bucket, Key: PREFIX + name, Body: body }));
    return PREFIX + name;
}

async function list(s3, cfg) {
    const { ListObjectsV2Command } = require("@aws-sdk/client-s3");
    const items = [];
    let token;
    do {
        const out = await s3.send(new ListObjectsV2Command({ Bucket: cfg.bucket, Prefix: PREFIX, ContinuationToken: token }));
        for (const o of out.Contents || []) {
            const name = o.Key.slice(PREFIX.length);
            if (NAME_RE.test(name)) items.push({ name, size: o.Size, lastModified: new Date(o.LastModified) });
        }
        token = out.IsTruncated ? out.NextContinuationToken : undefined;
    } while (token);
    return items.sort((a, b) => b.lastModified - a.lastModified);
}

async function get(s3, cfg, name, dest) {
    const { GetObjectCommand } = require("@aws-sdk/client-s3");
    checkName(name);
    const out = await s3.send(new GetObjectCommand({ Bucket: cfg.bucket, Key: PREFIX + name }));
    const bytes = await out.Body.transformToByteArray();
    fs.writeFileSync(dest, Buffer.from(bytes), { mode: 0o600 });
    return dest;
}

/** Supprime les sauvegardes plus vieilles que `days` jours, en gardant toujours la plus récente. */
async function prune(s3, cfg, days, now = new Date()) {
    const { DeleteObjectCommand } = require("@aws-sdk/client-s3");
    const n = Number(days);
    if (!Number.isInteger(n) || n < 1) throw new Error("Durée de conservation invalide (nombre de jours ≥ 1).");
    const limit = now.getTime() - n * 86400 * 1000;
    const items = await list(s3, cfg);
    const removed = [];
    for (const item of items.slice(1)) {
        if (item.lastModified.getTime() < limit) {
            await s3.send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: PREFIX + item.name }));
            removed.push(item.name);
        }
    }
    return removed;
}

async function main(argv) {
    const [cmd, a, b] = argv;
    const cfg = configFromEnv();
    const s3 = makeClient(cfg);
    if (cmd === "put" && a) {
        console.log(`Envoyée : ${await put(s3, cfg, a)}`);
    } else if (cmd === "get" && a && b) {
        console.log(`Téléchargée : ${await get(s3, cfg, a, b)}`);
    } else if (cmd === "list") {
        for (const i of await list(s3, cfg)) {
            console.log(`${i.name}\t${(i.size / 1048576).toFixed(1)} Mo\t${i.lastModified.toISOString()}`);
        }
    } else if (cmd === "prune" && a) {
        const removed = await prune(s3, cfg, a);
        console.log(`Supprimées : ${removed.length}${removed.length ? " (" + removed.join(", ") + ")" : ""}`);
    } else {
        console.error("Usage : backup-s3.js put <fichier> | get <nom> <destination> | list | prune <jours>");
        process.exitCode = 2;
    }
}

if (require.main === module) {
    main(process.argv.slice(2)).catch((e) => {
        console.error(`Erreur : ${e.message}`);
        process.exitCode = 1;
    });
}

module.exports = { configFromEnv, put, get, list, prune, NAME_RE, PREFIX };
