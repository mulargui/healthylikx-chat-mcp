set -x

#build and deploy the datastore in AWS
docker run --rm -w /repo/datastore/infra -v $(pwd):/repo node:22 npm install
docker run --rm -w /repo/datastore/infra -v $(pwd):/repo \
	-e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY -e AWS_ACCOUNT_ID \
	-e AWS_REGION -e AWS_DEFAULT_REGION -e AWS_SESSION_TOKEN \
    node:22 node DSCreate.js

#build and deploy the mcp server (Lambda) in AWS
cp config.json ./mcp/src
docker run --rm -w /repo/mcp/src -v $(pwd):/repo node:22 npm install

docker run --rm -w /repo/mcp/infra -v $(pwd):/repo node:22 npm install
docker run --rm -w /repo/mcp/infra -v $(pwd):/repo \
	-e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY -e AWS_ACCOUNT_ID \
	-e AWS_REGION -e AWS_DEFAULT_REGION -e AWS_SESSION_TOKEN \
    node:22 node deploy-mcp-lambda.js

#build and deploy the api (lambda) in AWS
cp config.json ./api/src
docker run --rm -w /repo/api/src -v $(pwd):/repo node:22 npm install

docker run --rm -w /repo/api/infra -v $(pwd):/repo node:22 npm install
docker run --rm -w /repo/api/infra -v $(pwd):/repo \
	-e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY -e AWS_ACCOUNT_ID \
	-e AWS_REGION -e AWS_DEFAULT_REGION -e AWS_SESSION_TOKEN \
    node:22 node deploy-api-lambda.js

#unit test the API (lambda)
docker run --rm -w /repo/api/test -v $(pwd):/repo node:22 npm install
docker run --rm -w /repo/api/test -v $(pwd):/repo \
	-e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY -e AWS_ACCOUNT_ID \
	-e AWS_REGION -e AWS_DEFAULT_REGION -e AWS_SESSION_TOKEN \
    node:22 npm test

#build the front end app
cp $(pwd)/api/infra/lambdaurl.json $(pwd)/ux/webapp/public #copy lambda's url file
docker run --rm -w /repo/ux/webapp -v $(pwd):/repo node:22 npm install
docker run --rm -w /repo/ux/webapp -v $(pwd):/repo \
	-e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY -e AWS_ACCOUNT_ID \
	-e AWS_REGION -e AWS_DEFAULT_REGION -e AWS_SESSION_TOKEN \
    node:22 npm run build

#deploy the front end app in S3 AWS
docker run --rm -w /repo/ux/infra -v $(pwd):/repo node:22 npm install
docker run --rm -w /repo/ux/infra -v $(pwd):/repo \
	-e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY -e AWS_ACCOUNT_ID \
	-e AWS_REGION -e AWS_DEFAULT_REGION -e AWS_SESSION_TOKEN \
    node:22 node deploy-s3.js

#unit test the front end app
docker run --rm -w /repo/ux/webapp -v $(pwd):/repo node:22 npm install
docker run --rm -w /repo/ux/webapp -v $(pwd):/repo node:22 npm test

#build documentation (partial)
docker run --rm -w /repo/jsdocs -v $(pwd):/repo node:22 npm install
docker run --rm -w /repo/jsdocs -v $(pwd):/repo node:22 npm run jsdoc
