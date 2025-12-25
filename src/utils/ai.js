const fs = require("fs");
const pdfParse = require("pdf-parse");
const { ChatOpenAI } = require("@langchain/openai");
const { RunnableSequence } = require("@langchain/core/runnables");
const { PromptTemplate } = require("@langchain/core/prompts");
require("dotenv").config();

const summarizeResumeWithLangChain = async (pdfPath) => {
  const pdfBuffer = fs.readFileSync(pdfPath);
  const pdfData = await pdfParse(pdfBuffer);

  const resumeText = pdfData.text;

  const model = new ChatOpenAI({
    modelName: "gpt-4o",
    temperature: 0.3,
    openAIApiKey: process.env.OPENAI_API_KEY,
  });

  const prompt = PromptTemplate.fromTemplate(`
You are a helpful assistant. Summarize this resume into a 3–5 sentence professional bio for a freelance tech profile.

Resume Text:
{resumeText}
`);

  const chain = RunnableSequence.from([
    prompt,
    model,
  ]);

  const summary = await chain.invoke({ resumeText });

  return summary.content || summary;
};

module.exports = {
  summarizeResumeWithLangChain,
};
