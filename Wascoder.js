// Importing required modules
import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors'
import dotenv from 'dotenv';



// Create an express application
const app = express();
app.use(express.json());
app.use(cors()); 
// Load environment variables from .env file
dotenv.config();

let accessToken = '';  // Token starts as empty
let tokenExpiration = 0; // Expiration time in milliseconds

// Function to request a new access token
const requestNewToken = async () => {
  try {
    const response = await fetch('https://iam.cloud.ibm.com/identity/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ibm:params:oauth:grant-type:apikey',
        apikey: process.env.IBM_Cloud_Api_key,  // Replace with your actual API key
      }),
    });
    const data = await response.json();
    accessToken = data.access_token;
    tokenExpiration = Date.now() + data.expires_in * 1000;
  } catch (error) {
    console.error('Failed to fetch new token:', error);
  }
};

// Function to get a valid token (refresh if necessary)
const getToken = async () => {
  if (Date.now() >= tokenExpiration) {
    await requestNewToken();
  }
  return accessToken;
};


const formatResponse = (response) => {
  const { results } = response;
  const generatedText = results[0].generated_text;

  // Extract the code from the generated text, regardless of the language
  const codeBlockMatch = generatedText.match(/```([a-zA-Z]*)\n([\s\S]+?)```/);
  
  if (codeBlockMatch) {
    const language = codeBlockMatch[1] || 'Unknown';  // Capture language if specified
    const formattedCode = codeBlockMatch[2].trim();   // Extract and clean up the code block
    
    console.log(`Generated ${language} Code:`);
    console.log(formattedCode);
  } else {
    console.log("No code block found in the response.");
  }
};
// Define the async function to generate text
const generateText = async (prompt) => {
  const url =
    "https://us-south.ml.cloud.ibm.com/ml/v1/text/generation?version=2023-05-29";
    const token = await getToken();
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization:
      `Bearer ${token}`,
  };
  const body = {
    input:
      `System:\nYou are an intelligent AI programming assistant, utilizing a Granite code language model developed by IBM. Your primary function is to assist users in programming tasks, including code generation, code explanation, code fixing, generating unit tests, generating documentation, application modernization, vulnerability detection, function calling, code translation, and all sorts of other software engineering tasks. You should act like the best code genration tool which has the knowledge of almost all the widely used programming languages and frameworks and you are expert in generating software code and solutions for all of the popular and widely used tech stack. You will be requested to generate code for softwares ranging from small functions to simple or complex full stack applications that will be used by the users to solve real world problems and business problems. Your responsibility is to not exaggerate the output and follow the instructions provided by user that are ethical and allowed by the model you are using to generate the code. You will be performing like a human software engineer who can take requirements and provide fully functional software solutions that can be used by the user for further testing and deployment according to his needs. Do not infer any instructions by yourself. I don't want you to generate placeholder logic and incomplete code instead all the required code to run this application must be generated that is also ready to use. Making sure the results are according to the provided user requirements and instructions. The reponse should not be empty or incorrect. You are the best code genration tool with the ability to generate small to medium sized applications. Your output is limited to 8192 tokens.\n\nAnswer:\n. User:\n ${prompt}`,
    parameters: {
      decoding_method: "greedy",
      max_new_tokens: 8192,
      min_new_tokens: 0,
      stop_sequences: [],
      repetition_penalty: 1,
    },
    model_id: "ibm/granite-34b-code-instruct",
    project_id: "dd0976c3-5be8-404f-aa85-70bc4832de1b",
  };

  const response = await fetch(url, {
    headers,
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorDetails = await response.text(); // Capture the error message from the response
    console.error(`Error Response: ${errorDetails}`); // Log the full error message
    throw new Error(`Non-200 response: ${response.status} ${response.statusText}`);
  }

  return await response.json();
};

// Define a route that triggers the text generation
app.post('/generate-text', async (req, res) => {
  const userPrompt = req.body.prompt; // Extract prompt from request body

  if (!userPrompt) {
    return res.status(400).json({ error: 'No prompt provided' });
  }

  try {
    const result = await generateText(userPrompt); // Pass userPrompt to generateText

    // Log the result to the console
    formatResponse(result);
    
    // Send the result as a response
    res.json(result);
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});
// Start the server
const port = 3000;
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
