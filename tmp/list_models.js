async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is required.");
  }

  const url = new URL("https://generativelanguage.googleapis.com/v1beta/models");
  url.searchParams.set("key", apiKey);

  try {
    const response = await fetch(url);
    const data = await response.json();
    console.log(JSON.stringify(data.models?.map((model) => model.name) ?? []));
  } catch (error) {
    console.error("Error:", error);
    process.exitCode = 1;
  }
}

listModels();
