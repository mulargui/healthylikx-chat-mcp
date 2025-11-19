import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import { z } from 'zod/v3';

//healthylinkx extension
import { SearchDoctors, SearchDoctorsTest } from './healthylinkx.js';

// Create an MCP server
const server = new McpServer({
    name: 'Healthylinkx MCP Server',
    version: '1.0.0'
});

// Add the Healthylinkx API as a tool
server.registerTool(
    'SearchDoctors',
    {
        title: 'SearchDoctors',
        description: 'Search for doctors in the HealthyLinkx directory',
        inputSchema: {
            zipcode: z.number().int().gte(10000).lte(99999).describe("Zipcode of the address of the doctor"),
            lastname: z.string().describe("Lastname of the doctor"),
            specialty: z.string().describe("Specialty of the doctor").optional(),
            gender: z.enum(["male", "female"]).describe("Gender of the doctor. Select an option").optional()
        },
        outputSchema: {
            SearchResults: z.array(z.object({
                Name: z.string().describe("Full name of the doctor"),
                Address: z.string().describe("Street address of the doctor's office"),
                City: z.string().describe("City where the doctor's office is located"),
                Classification: z.string().describe("Standard classification of the doctor speciality")
            }))
        }
    },
    async ({ zipcode, lastname, specialty, gender}) => {

        // call the healthylinkx API
        const search = await SearchDoctors(gender, lastname, specialty, zipcode);

        //API error
        if (search.statusCode != 200)
            return {
                isError: true,
                content: [{ type: "text", text: `Error: ${search.result}` }],
            };
        
        //convert results to MCP format
        const result = [];
        for (const row of search.result) {
            result.push({
                Name: row.Provider_Full_Name,
                Address: row.Provider_Full_Street,
                City: row.Provider_Full_City,
                Classification: row.Classification 
            });
        }
        //return the result of the search
        const output =  {};
        output.SearchResults = result;

        return {
            content: [{ type: 'text', text: JSON.stringify(output) }],
            structuredContent: output
        };
    }
);

// Set up Express and HTTP transport
const app = express();
app.use(express.json());

app.post('/mcp', async (req, res) => {
    // In stateless mode, create a new transport for each request to prevent
    // request ID collisions. Different clients may use the same JSON-RPC request IDs,
    // which would cause responses to be routed to the wrong HTTP connections if
    // the transport state is shared.

    try {
        console.log(`POST request received`);
        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
            enableJsonResponse: true
        });

        res.on('close', () => {
            transport.close();
        });

        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
    } catch (error) {
        console.error('Error handling Healthylinkx MCP request:', error);
        if (!res.headersSent) {
            res.status(500).json({
                jsonrpc: '2.0',
                error: {
                    code: -32603,
                    message: 'Internal  Healthylinkx MCP server error'
                },
                id: null
            });
        }
    }
});

/*
if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
  // Running in Lambda - export the app for Lambda Web Adapter
  module.exports = app;
  exports.handler = app;
}*/

let port = parseInt(process.env.PORT || '3000');
//Lambda web adapter uses 8080 by default
if (process.env.AWS_LAMBDA_FUNCTION_NAME) port = 8080;

app.listen(port, () => {
    console.log(`Healthylinkx MCP Server running on port ${port}`);
}).on('error', error => {
    console.error('Healthylinkx MCP Server error:', error);
    process.exit(1);
});

