import { 
    S3Client, 
    CreateBucketCommand, 
    PutBucketWebsiteCommand, 
    PutBucketPolicyCommand,
    PutObjectCommand,
    HeadBucketCommand,
    PutPublicAccessBlockCommand
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import * as fs from 'fs'; 
import * as path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'node:child_process';

import util from 'util';
const execPromise = util.promisify(exec);

// Read the config file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.join(__dirname, '../..', 'config.json')
const rawConfig = fs.readFileSync(configPath);
const config = JSON.parse(rawConfig);

// Extract S3 configurations
const BUCKET_NAME = config.s3.bucketName;
const REGION = process.env.AWS_REGION || "us-east-1"; 

const s3Client = new S3Client({ region: REGION });

async function buildReactApp() {
  try {
    console.log('Building React app...');
    const { stdout, stderr } = await execPromise('npm run build');
    console.log('Build output:', stdout);
    if (stderr) console.error('Build errors:', stderr);
    console.log('React app built successfully');
  } catch (error) {
    console.error('Error building React app:', error);
    throw error;
  }
}

async function createBucket() {
  try {
    const command = new CreateBucketCommand({ Bucket: BUCKET_NAME });
    await s3Client.send(command);
    console.log(`Bucket ${BUCKET_NAME} created successfully`);
  } catch (err) {
    console.error("Error creating bucket:", err);
  }
}

async function enableStaticWebsiteHosting() {
  try {
    const command = new PutBucketWebsiteCommand({
      Bucket: BUCKET_NAME,
      WebsiteConfiguration: {
        IndexDocument: { Suffix: "index.html" },
        ErrorDocument: { Key: "error.html" }
      }
    });
    await s3Client.send(command);
    console.log("Static website hosting enabled");
  } catch (err) {
    console.error("Error enabling static website hosting:", err);
  }
}

async function updatePublicAccessBlock() {
  try {
    const command = new PutPublicAccessBlockCommand({
      Bucket: BUCKET_NAME,
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: false,
        IgnorePublicAcls: false,
        BlockPublicPolicy: false,
        RestrictPublicBuckets: false
      }
    });

    await s3Client.send(command);
    console.log(`Public access block settings updated for bucket ${BUCKET_NAME}`);
  } catch (err) {
    console.error("Error updating public access block settings:", err);
    throw err;
  }
}

async function setBucketPolicy() {
  const policy = {
    Version: "2012-10-17",
    Statement: [
      {
        Sid: "PublicReadGetObject",
        Effect: "Allow",
        Principal: "*",
        Action: "s3:GetObject",
        Resource: `arn:aws:s3:::${BUCKET_NAME}/*`
      }
    ]
  };

  try {
    const command = new PutBucketPolicyCommand({
      Bucket: BUCKET_NAME,
      Policy: JSON.stringify(policy)
    });
    await s3Client.send(command);
    console.log("Bucket policy set successfully");
  } catch (err) {
    console.error("Error setting bucket policy:", err);
  }
}

async function uploadFile(filePath, key) {
  try {
    const fileStream = fs.createReadStream(filePath);
    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: BUCKET_NAME,
        Key: key,
        Body: fileStream,
        ContentType: getContentType(filePath)
      }
    });

    await upload.done();
    console.log(`File uploaded successfully: ${key}`);
  } catch (err) {
    console.error(`Error uploading file ${key}:`, err);
  }
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html': return 'text/html';
    case '.css': return 'text/css';
    case '.js': return 'application/javascript';
    case '.json': return 'application/json';
    case '.png': return 'image/png';
    case '.jpg': case '.jpeg': return 'image/jpeg';
    default: return 'application/octet-stream';
  }
}

async function uploadDirectory(directoryPath, prefix = '') {
  const files = fs.readdirSync(directoryPath);

  for (const file of files) {
    const filePath = path.join(directoryPath, file);
    const key = path.join(prefix, file).replace(/\\/g, '/');

    if (fs.statSync(filePath).isDirectory()) {
      await uploadDirectory(filePath, key);
    } else {
      await uploadFile(filePath, key);
    }
  }
}

async function main() {
  //await buildReactApp(); done in deploy.sh
  await createBucket();
  await updatePublicAccessBlock(); 
  await enableStaticWebsiteHosting();
  await setBucketPolicy();
  await uploadDirectory("../webapp/build");

  console.log(`Website URL: http://${BUCKET_NAME}.s3-website-${REGION}.amazonaws.com`);
}

await main();
