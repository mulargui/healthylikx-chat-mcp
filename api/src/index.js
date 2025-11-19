// config 
import * as fs from 'fs'; 
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.join(__dirname, 'config.json');
const rawConfig = fs.readFileSync(configPath);
const config = JSON.parse(rawConfig);

const REGION = process.env.AWS_REGION || "us-east-1";

// aws bedrock
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
const bedrockClient = new BedrockRuntimeClient({ region: REGION });

//healthylinkx extension
import MCPClient from './mcpclient.js';
const mcpClient = new MCPClient();
await mcpClient.createInstance();

// system prompt to use healthylinkx extension
const systemPrompt = `You are an AI assistant with extended skills in healthcare.
    When the user asks for a doctor you have access to a tool to search for doctors, but only use it when neccesary. 
    If the tool is not required respond as normal.
    Before calling SearchDoctors, check if the user looks for a specific gender, lastname, speciality or zipcode.
    At a minimum the user should provide the lastname or speciality. 
    Genre and zipcode are optional for a more refined search.
    Before calling a tool, do some analysis within <thinking> </thinking> tags. 
    Go through each of the parameters and determine if the user has directly provided or given enough information to infer a value. 
    If all the parameters are present, close the thinking tag and proceed with the tool call.
    BUT if one of the parameters is missing, DO NOT invoke the function and ask the user to provide the missing parameter.
    When providing the final answer, ALWAYS include the results of the call to the tool.
`.trim();

// helper function to support retries
async function invokeBedrockWithRetry(params, maxRetries = 5) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const command = new ConverseCommand(params);
      return await bedrockClient.send(command);
    } catch (error) {
      if (error.name === 'ThrottlingException' && attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 100; // exponential backoff
        console.log("Invoking Bedrock ThrottlingException, waiting:", delay);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}

//
// Abstraction layer to keep the code independent of the model.
// Tested with Anthropic Claude 3 Haiku and Amazon Titan Text Lite
// For Claude we are adding function call parameters to the body
//
async function prepareModelRequest(modelId, messages, max_tokens, temperature) {
  if (modelId.startsWith('anthropic.claude')) {
    const mcpTools = await mcpClient.GetTools(); //get the list of tools available
    return {
      modelId: modelId,
      messages: messages,
      system: [{ text: systemPrompt}],
      inferenceConfig:{
        maxTokens: max_tokens,
        temperature: temperature
      },
      toolConfig: {
        tools: mcpTools
      }
    };
  } else if (modelId.startsWith('amazon.titan')) {
    // For Titan, we'll use the last message as the input
    //const prompt = messages[messages.length - 1].content;
    // For Titan, we'll include the entire conversation history in the prompt
    const conversationHistory = messages.map(msg => `${msg.role}: ${msg.content}`).join('\n');
    const prompt = `${conversationHistory}\nHuman: ${messages[messages.length - 1].content}\nassistant:`;
    
    return {
      modelId: modelId,
      messages: prompt,
      system: [{ text: systemPrompt}],
      inferenceConfig:{
        maxTokens: max_tokens,
        temperature: temperature,
        topP: 1,
        stopSequences: []
      }
    };
  } else {
    throw new Error(`Unsupported model: ${modelId}`);
  }
}

//
// Handler of the Lambda invokation
//
export const handler = async (event) => {
  console.log("Lambda function invoked with event:", JSON.stringify(event));
  console.log("Parsed config:", JSON.stringify(config));

  try {
    // Extract the message from the event
    const body = JSON.parse(event.body);
    console.log("Raw response body:", JSON.stringify(body));
    const messages = body.messages || [];
    console.log("Raw response messages:", JSON.stringify(messages));
    if (!Array.isArray(messages) || messages.length === 0) {
        throw new Error("Invalid input: Messages should be a non-empty array");
    }

    // parameters
    const max_tokens = body.max_tokens || config.bedrock.maxTokens || 300;
    const temperature = body.temperature || config.bedrock.temperature || 1.0;
    const modelId = config.bedrock.model;
    const debug = config.api.debug || false;

    // with tools we can call the LLM several times
    do{
      // Prepare the request for Bedrock
      const params = await prepareModelRequest(modelId, messages, max_tokens, temperature);
      console.log("Preparing to invoke Bedrock model with params:", JSON.stringify(params));

      // Invoke Bedrock model
      const response = await invokeBedrockWithRetry(params);
      console.log("Received response from Bedrock:", JSON.stringify(response));

      //extract the message
      const responseMessage = response.output.message;
      console.log("response message:", JSON.stringify(responseMessage));

      //we need to call an external tool if toolUse is in the payload
      if (responseMessage.content.some(obj => "toolUse" in obj)) {

        // Add the assistant's response to the conversation history
        messages.push(responseMessage);  

        //tool to use
        const toolUse = responseMessage.content.find(obj => "toolUse" in obj).toolUse;
        console.log("Tool use: ", JSON.stringify(toolUse));

        //call the tool
        const result = await mcpClient.CallTool(toolUse);
        console.log("Tool result: ", JSON.stringify(result));

        //add the result to the conversation history
        messages.push({ 
          role: "user", 
          content: [{
            toolResult : {
              toolUseId: toolUse.toolUseId,
              content: [{
                json: result
              }]
            }
          }],
          status: 'success'
        });
        console.log("Added to conversation history:", JSON.stringify(messages.at(-1)));
      }else{
        // no tool usage
        // we remove the <thinking> </thinking> of the response as this is internal and should
        // not be propagated
        if (!debug){
          const content = responseMessage.content[0].text.replace(/<thinking>(.*?)<\/thinking>/sg, '');
          // sometimes the LLM just replies with thinking and the result is empty
          // in this case we don't filter thinking
          if (content)
            responseMessage.content[0].text = content;
        }
        // Add the assistant's response to the conversation history
        messages.push(responseMessage);   

        return {
          statusCode: 200,
          body: JSON.stringify({ 
            answer: responseMessage.content[0].text,
            conversation: messages  // Return the updated conversation history
          }),
          headers: {
            'Content-Type': 'application/json'
          }
        };
      }
    } while (true);

  } catch (error) {
    console.error("Error occurred:", error);
    console.error("Error stack:", error.stack);
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    
    if (error.$metadata) {
      console.error("Error metadata:", JSON.stringify(error.$metadata));
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'An error occurred processing your request' }),
      headers: {
        'Content-Type': 'application/json'
      }
    };
  }
};
