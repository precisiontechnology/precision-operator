import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { readFile } from "fs/promises";
import { basename, extname } from "path";

const BUCKET = process.env.R2_BUCKET || "precision-media";
const ENDPOINT = process.env.R2_ENDPOINT;
const ACCESS_KEY = process.env.R2_ACCESS_KEY_ID;
const SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY;
const PUBLIC_URL_BASE = process.env.R2_PUBLIC_URL || "";
const ACCOUNT_ID = process.env.PRECISION_ACCOUNT_ID || "default";

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".csv": "text/csv",
  ".md": "text/markdown",
  ".json": "application/json",
  ".txt": "text/plain",
};

let s3: S3Client | null = null;

function getClient(): S3Client | null {
  if (s3) return s3;
  if (!ENDPOINT || !ACCESS_KEY || !SECRET_KEY) {
    console.warn("[media-upload] R2 credentials not configured, skipping uploads");
    return null;
  }
  s3 = new S3Client({
    region: "auto",
    endpoint: ENDPOINT,
    credentials: {
      accessKeyId: ACCESS_KEY,
      secretAccessKey: SECRET_KEY,
    },
  });
  return s3;
}

export async function uploadToR2(localPath: string): Promise<string | null> {
  const client = getClient();
  if (!client) return null;

  try {
    const data = await readFile(localPath);
    const filename = basename(localPath);
    const ext = extname(localPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    const timestamp = Date.now();
    const key = `claudia/${ACCOUNT_ID}/media/${timestamp}-${filename}`;

    await client.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: data,
      ContentType: contentType,
    }));

    // Return public URL
    if (PUBLIC_URL_BASE) {
      return `${PUBLIC_URL_BASE}/${key}`;
    }
    // Fallback: construct from endpoint
    const host = ENDPOINT!.replace("https://", "").replace("http://", "");
    return `https://${BUCKET}.${host}/${key}`;
  } catch (err) {
    console.error(`[media-upload] Failed to upload ${localPath}:`, err);
    return null;
  }
}
