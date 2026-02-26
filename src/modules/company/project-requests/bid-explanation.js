// src/modules/company/project-requests/bid-explanation.js
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";

const MAX_DESCRIPTION_LENGTH = 400;
const explanationCache = new Map();

// Limits for one-time generation at proposal creation (balance context vs tokens)
const MAX_PROJECT_DESC = 600;
const MAX_REQUIREMENTS = 400;
const MAX_DELIVERABLES = 400;
const MAX_COVER_LETTER = 500;
const MAX_PROVIDER_BIO = 300;
const MAX_SKILLS_LIST = 30;

/**
 * Generate a short AI explanation for why this bid is a good fit (for hover tooltip).
 * Cached by proposal id.
 */
export async function generateBidExplanation(proposal) {
  const proposalId = proposal.id;
  if (explanationCache.has(proposalId)) {
    return explanationCache.get(proposalId);
  }

  try {
    const provider = proposal.provider || {};
    const profile = provider.providerProfile || {};
    const serviceRequest = proposal.serviceRequest || {};
    const desc = (serviceRequest.description || "").slice(0, MAX_DESCRIPTION_LENGTH);
    const reqDesc = desc.length >= MAX_DESCRIPTION_LENGTH ? desc + "..." : desc;

    const model = new ChatOpenAI({
      modelName: "gpt-4o",
      temperature: 0.5,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = PromptTemplate.fromTemplate(`You are helping a company understand why a specific bid is a good fit for their project.

Project: {requestTitle}
Project description (summary): {requestDescription}
Project budget range: RM {budgetMin} - RM {budgetMax}
Project timeline: {timeline}
Required skills: {requestSkills}

Bid:
- Provider: {providerName}
- Bid amount: RM {bidAmount}
- Proposed timeline: {proposedTimeline}
- Provider rating: {rating}/5, experience: {yearsExperience} years, completed projects: {totalProjects}
- Provider skills: {providerSkills}
- Cover letter (excerpt): {coverLetterExcerpt}
- Proposed milestones (read these to assess the bid):
{milestonesText}

Match score for this bid: {matchScore}/100

Write 2–3 short sentences explaining why this bid is a good fit. Consider: budget fit, skills match, experience, timeline, and how the proposed milestones support delivery. Be concise and direct. No bullet points, no headers. Output only the paragraph.`);

    const coverExcerpt = (proposal.coverLetter || "").slice(0, 200);
    const milestones = proposal.milestones || [];
    const milestonesText =
      milestones.length > 0
        ? milestones
            .map((m, i) => {
              const due = m.dueDate ? new Date(m.dueDate).toISOString().slice(0, 10) : "";
              const desc = (m.description || "").slice(0, 80);
              return `${i + 1}. ${m.title}: RM ${m.amount}${due ? ` by ${due}` : ""}${desc ? ` — ${desc}` : ""}`;
            })
            .join("\n")
        : "None specified";

    const chain = RunnableSequence.from([prompt, model]);

    const result = await chain.invoke({
      requestTitle: serviceRequest.title || "Project",
      requestDescription: reqDesc || "No description",
      budgetMin: (serviceRequest.budgetMin ?? 0).toString(),
      budgetMax: (serviceRequest.budgetMax ?? 0).toString(),
      timeline: serviceRequest.timeline || "Not specified",
      requestSkills: Array.isArray(serviceRequest.skills) ? serviceRequest.skills.join(", ") : "Not specified",
      providerName: provider.name || "Provider",
      bidAmount: (proposal.bidAmount ?? 0).toLocaleString(),
      proposedTimeline: proposal.deliveryTime || proposal.timeline || "Not specified",
      rating: (profile.rating ?? 0).toString(),
      yearsExperience: (profile.yearsExperience ?? 0).toString(),
      totalProjects: (profile.totalProjects ?? 0).toString(),
      providerSkills: Array.isArray(profile.skills) ? profile.skills.slice(0, 8).join(", ") : "Not specified",
      coverLetterExcerpt: coverExcerpt || "No cover letter",
      milestonesText,
      matchScore: (proposal.matchScore ?? 0).toString(),
    });

    let text = (result.content || "").trim();
    if (text.startsWith('"') && text.endsWith('"')) {
      text = text.slice(1, -1);
    }
    explanationCache.set(proposalId, text);
    return text;
  } catch (err) {
    console.error("Error generating bid explanation:", err);
    return "This bid aligns well with your budget, timeline, and requirements.";
  }
}

/**
 * Generate AI explanation once at proposal creation. Reads full project, proposal, and provider
 * (with length caps to save tokens). Returns one paragraph: why it fits + drawbacks.
 * Store result in Proposal.aiFitExplanation and reuse everywhere.
 */
export async function generateBidExplanationForStorage(proposal) {
  try {
    const provider = proposal.provider || {};
    const profile = provider.providerProfile || {};
    const serviceRequest = proposal.serviceRequest || {};
    const milestones = proposal.milestones || [];

    const projectDesc = (serviceRequest.description || "").slice(0, MAX_PROJECT_DESC);
    const requirements = (serviceRequest.requirements || "").slice(0, MAX_REQUIREMENTS);
    const deliverables = (serviceRequest.deliverables || "").slice(0, MAX_DELIVERABLES);
    const coverLetter = (proposal.coverLetter || "").slice(0, MAX_COVER_LETTER);
    const providerBio = (profile.bio || "").slice(0, MAX_PROVIDER_BIO);
    const requestSkills = Array.isArray(serviceRequest.skills) ? serviceRequest.skills : [];
    const providerSkills = Array.isArray(profile.skills) ? profile.skills.slice(0, MAX_SKILLS_LIST) : [];
    const milestonesText =
      milestones.length > 0
        ? milestones
            .map((m, i) => {
              const due = m.dueDate ? new Date(m.dueDate).toISOString().slice(0, 10) : "";
              const desc = (m.description || "").slice(0, 100);
              return `${i + 1}. ${m.title}: RM ${m.amount}${due ? ` by ${due}` : ""}${desc ? ` — ${desc}` : ""}`;
            })
            .join("\n")
        : "None specified";

    const model = new ChatOpenAI({
      modelName: "gpt-4o",
      temperature: 0.5,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = PromptTemplate.fromTemplate(`You are an expert evaluator. Based on the full project, the full proposal, and the full provider profile, write a short summary for the company (customer) that will be stored and shown every time they view this bid.

PROJECT (Service Request):
- Title: {requestTitle}
- Description: {projectDesc}
- Budget: RM {budgetMin} - RM {budgetMax}
- Timeline: {timeline}
- Required skills: {requestSkills}
- Requirements: {requirements}
- Deliverables: {deliverables}

PROPOSAL (Bid):
- Bid amount: RM {bidAmount}
- Delivery time: {deliveryTime} days
- Cover letter: {coverLetter}
- Proposed milestones (read these to assess delivery plan and fit):
{milestonesText}

PROVIDER:
- Name: {providerName}
- Bio: {providerBio}
- Rating: {rating}/5, Years experience: {yearsExperience}, Completed projects: {totalProjects}
- Skills: {providerSkills}
- Location: {location}

Write a single paragraph (3–5 sentences) that:
1) Explains why this bid is a good fit (budget, timeline, skills, experience, and how the proposed milestones support delivery).
2) Mentions 1–2 potential drawbacks or concerns (e.g. skill gaps, timeline risk, experience level, or milestone clarity).

Be concise and neutral. No bullet points, no headers. Output only the paragraph.`);

    const chain = RunnableSequence.from([prompt, model]);
    const result = await chain.invoke({
      requestTitle: serviceRequest.title || "Project",
      projectDesc: projectDesc || "No description",
      budgetMin: (serviceRequest.budgetMin ?? 0).toString(),
      budgetMax: (serviceRequest.budgetMax ?? 0).toString(),
      timeline: serviceRequest.timeline || "Not specified",
      requestSkills: requestSkills.join(", ") || "Not specified",
      requirements: requirements || "None",
      deliverables: deliverables || "None",
      bidAmount: (proposal.bidAmount ?? 0).toLocaleString(),
      deliveryTime: String(proposal.deliveryTime ?? 0),
      coverLetter: coverLetter || "No cover letter",
      milestonesText: milestonesText || "None",
      providerName: provider.name || "Provider",
      providerBio: providerBio || "Not provided",
      rating: (profile.rating ?? 0).toString(),
      yearsExperience: (profile.yearsExperience ?? 0).toString(),
      totalProjects: (profile.totalProjects ?? 0).toString(),
      providerSkills: providerSkills.join(", ") || "Not specified",
      location: profile.location || "Not specified",
    });

    let text = (result.content || "").trim();
    if (text.startsWith('"') && text.endsWith('"')) {
      text = text.slice(1, -1);
    }
    return text;
  } catch (err) {
    console.error("Error generating bid explanation for storage:", err);
    return null;
  }
}
