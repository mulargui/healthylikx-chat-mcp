# healthylikx-chat-mcp
Added to HealthyLinkx chat app support to MCP 

This repo is a combination of the [Healthylinkx chat app](https://github.com/mulargui/healthylinkx-chat-app) repo and the [Healthylinkx MCP Server](https://github.com/mulargui/healthylinkx-mcp-server) repo. In the former I built a chat app ala ChatGPT and extended using function tool calls to invoke the healthylinkx catalog. In the later I created a MCP interface to the Healthylinkx API. You can see more details on how they were implemented looking at their respective repos.

In this repo we fundamentally took the Healthylinkx chat app and replaced the usage of function tool calls with calls to MCP. Most of the changes are inside API at /api/src:
- mcpclient.js is an MCP client class that abstracts all the scaffolding to use MCP.
- index.js was rewriten at large to use an MCP client. Due AWS InvokeModelCommand API doesn't support MCP schemas, we migrated to ConverseCommand instead.

Enjoy!
