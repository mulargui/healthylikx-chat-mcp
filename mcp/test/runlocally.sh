set -x

# run the mcp server locally in a container
# you can use SearchDoctorTest to bypass the Healthylinkx catalog and focus on the MCP Server
# or install the datastore with deploy.sh and debug the MCP Server end to end
cp config.json ./mcp/src
docker run --rm -w /repo/mcp/src -v $(pwd):/repo node:22 npm install
docker run --rm -w /repo/mcp/src -v $(pwd):/repo \
	-e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY -e AWS_ACCOUNT_ID \
	-e AWS_REGION -e AWS_DEFAULT_REGION -e AWS_SESSION_TOKEN \
	-p 3000:3000 \
	node:22 sh -c "./run.sh"
exit