import { 
    S3Client, 
    DeleteObjectsCommand,
    DeleteBucketPolicyCommand,
    DeleteBucketWebsiteCommand,
    DeleteBucketCommand,
    ListObjectsV2Command,
    PutPublicAccessBlockCommand
  } from "@aws-sdk/client-s3";
  import * as fs from 'fs'; 
  import * as path from 'path';
  import { fileURLToPath } from 'url';
  
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
  
  async function deleteAllObjects() {
    let continuationToken = null;
    do {
      const listCommand = new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        ContinuationToken: continuationToken
      });
  
      const listedObjects = await s3Client.send(listCommand);
  
      if (listedObjects.Contents && listedObjects.Contents.length > 0) {
        const deleteParams = {
          Bucket: BUCKET_NAME,
          Delete: { Objects: [] }
        };
  
        listedObjects.Contents.forEach(({ Key }) => {
          deleteParams.Delete.Objects.push({ Key });
        });
  
        const deleteCommand = new DeleteObjectsCommand(deleteParams);
        await s3Client.send(deleteCommand);
  
        console.log(`Deleted ${deleteParams.Delete.Objects.length} objects`);
      }
  
      continuationToken = listedObjects.NextContinuationToken;
    } while (continuationToken);
  
    console.log("All objects deleted from the bucket");
  }
  
  async function deleteBucketPolicy() {
    try {
      const command = new DeleteBucketPolicyCommand({ Bucket: BUCKET_NAME });
      await s3Client.send(command);
      console.log("Bucket policy deleted");
    } catch (err) {
      console.error("Error deleting bucket policy:", err);
    }
  }
  
  async function disableStaticWebsiteHosting() {
    try {
      const command = new DeleteBucketWebsiteCommand({ Bucket: BUCKET_NAME });
      await s3Client.send(command);
      console.log("Static website hosting disabled");
    } catch (err) {
      console.error("Error disabling static website hosting:", err);
    }
  }
  
  async function resetPublicAccessBlock() {
    try {
      const command = new PutPublicAccessBlockCommand({
        Bucket: BUCKET_NAME,
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          IgnorePublicAcls: true,
          BlockPublicPolicy: true,
          RestrictPublicBuckets: true
        }
      });
      await s3Client.send(command);
      console.log("Public access block reset to default (all blocked)");
    } catch (err) {
      console.error("Error resetting public access block:", err);
    }
  }
  
  async function deleteBucket() {
    try {
      const command = new DeleteBucketCommand({ Bucket: BUCKET_NAME });
      await s3Client.send(command);
      console.log(`Bucket ${BUCKET_NAME} deleted`);
    } catch (err) {
      console.error("Error deleting bucket:", err);
    }
  }
  
  async function cleanup() {
    try {
      await deleteAllObjects();
      await deleteBucketPolicy();
      await disableStaticWebsiteHosting();
      await resetPublicAccessBlock();
      await deleteBucket();
      console.log("Cleanup completed successfully");
    } catch (err) {
      console.error("An error occurred during cleanup:", err);
    }
  }
  
  await cleanup();
  