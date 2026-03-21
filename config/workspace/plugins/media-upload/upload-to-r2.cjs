#!/usr/bin/env node
// Sync-compatible R2 upload helper — called via execFileSync
// Usage: node upload-to-r2.js <localPath>
// Prints the public URL to stdout on success, exits 1 on failure

const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const fs = require("fs");
const path = require("path");

const BUCKET = process.env.R2_BUCKET || "precision-media";
const ENDPOINT = process.env.R2_ENDPOINT;
const ACCESS_KEY = process.env.R2_ACCESS_KEY_ID;
const SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY;
const PUBLIC_URL_BASE = process.env.R2_PUBLIC_URL || "";
const ACCOUNT_ID = process.env.PRECISION_ACCOUNT_ID || "default";

const MIME_TYPES = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".webp": "image/webp", ".pdf": "application/pdf",
};

async function main() {
  const localPath = process.argv[2];
  if (!localPath) { process.stderr.write("No path provided\n"); process.exit(1); }
  if (!ENDPOINT || !ACCESS_KEY || !SECRET_KEY) { process.stderr.write("R2 credentials not configured\n"); process.exit(1); }

  const data = fs.readFileSync(localPath);
  const filename = path.basename(localPath);
  const ext = path.extname(localPath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const key = `claudia/${ACCOUNT_ID}/media/${Date.now()}-${filename}`;

  const s3 = new S3Client({
    region: "auto",
    endpoint: ENDPOINT,
    credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
  });

  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: data, ContentType: contentType }));

  const url = PUBLIC_URL_BASE ? `${PUBLIC_URL_BASE}/${key}` : `https://${BUCKET}.${ENDPOINT.replace("https://","").replace("http://","")}/${key}`;
  process.stdout.write(url);
}

main().catch(err => { process.stderr.write(err.message + "\n"); process.exit(1); });
