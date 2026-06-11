const { GoogleGenAI } = require("@google/genai");

async function testGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is required.");
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    console.log("Testing model: models/gemini-pro-latest...");
    const response = await ai.models.generateContent({
      model: "models/gemini-pro-latest",
      contents: [{ role: "user", parts: [{ text: "Hello, confirm you are working." }] }],
    });
    console.log("Success!");
    console.log("Text:", response.text);
  } catch (error) {
    console.error("Failed:", error.status || error.code || error.message, error);
    process.exitCode = 1;
  }
}

testGemini();
