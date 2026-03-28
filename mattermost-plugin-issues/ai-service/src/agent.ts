// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

import { createTools } from './tools';
import { PluginClient } from './plugin-client';
import type { AnalyzeRequest, AnalyzeResponse } from './types';

const SYSTEM_PROMPT = `You are an AI assistant that analyzes team conversations to keep the issue tracker up-to-date.

When a conversation ends, you review the transcript and determine if any actionable information was discussed — features, bugs, requirements, specifications, action items, decisions, or tasks.

Your workflow:
1. Read the conversation carefully.
2. If the conversation references earlier context you don't have (e.g. "like we said", "continuing from before", pronouns without antecedents, or the topic is unclear), use get_channel_history to fetch prior messages from the same channel. Pass the earliest message timestamp as the "before" parameter to get messages that preceded this conversation.
3. If there's nothing actionable (casual chat, greetings, etc.), respond with a brief note and take no action.
4. Review the EXISTING ISSUES provided below the transcript. This is the complete list of all issues across all projects. You MUST check this list carefully before creating anything.
5. If an existing issue covers the same TOPIC, AREA, or FEATURE — even if the exact wording differs — update it with update_issue. When updating descriptions, preserve existing content and append the new information under a "---" separator with a date.
6. Only create a new issue with create_issue if you are CERTAIN that no existing issue is related. Think broadly: "file extension whitelist" is related to "file upload validation"; "token expiry handling" is related to "token lifecycle". When in doubt, update the existing issue rather than creating a duplicate.
7. If the conversation explicitly states that a feature or task is no longer needed, was a mistake, or has been abandoned, use delete_issue to remove it. Only delete when participants clearly agree it should not exist — if they merely deprioritize it, use update_issue to set status to "cancelled" instead.

CRITICAL RULE — NO DUPLICATES:
- Two issues about the same feature, component, or area are duplicates even if they describe different aspects.
- Before creating, ask yourself: "Is there ANY existing issue that a human would consider related?" If yes, update it instead.
- A new issue should only be created for a genuinely NEW topic not covered by any existing issue.

Guidelines:
- Be judicious. Only create/update issues for genuinely actionable information.
- Set priority based on urgency signals in the conversation (e.g., "critical", "ASAP", "blocking" → high/urgent).
- Include conversation context in issue descriptions: who discussed it, key points, and any decisions made.
- Use concise, clear issue titles.
- If no projects exist, report that you cannot create issues and suggest creating a project first.`;

export async function analyzeConversation(request: AnalyzeRequest): Promise<AnalyzeResponse> {
    const { conversation, callback_url, internal_secret, openai_api_key } = request;

    const client = new PluginClient(callback_url, internal_secret);
    const tools = createTools(client);

    const openai = createOpenAI({ apiKey: openai_api_key });

    const channelTypeLabel =
        conversation.channel_type === 'D' ? 'Direct Message' :
            conversation.channel_type === 'G' ? 'Group Message' :
                conversation.channel_type === 'P' ? 'Private Channel' : 'Channel';

    const participantList = conversation.participants
        .map((p) => `@${p.username}`)
        .join(', ');

    const transcript = conversation.messages
        .map((m) => {
            const ts = new Date(m.timestamp).toLocaleTimeString('en-US', { hour12: false });
            return `[${ts}] @${m.username}: ${m.message}`;
        })
        .join('\n');

    // Pre-fetch all existing issues so the model can see them before deciding.
    let existingIssuesSection = '';
    try {
        const projects = await client.listProjects();
        const issueLines: string[] = [];
        for (const project of projects) {
            const result = await client.listIssues(project.id);
            for (const issue of result.issues) {
                const desc = issue.description.length > 150
                    ? issue.description.substring(0, 150) + '...'
                    : issue.description;
                issueLines.push(`- **${issue.identifier}** (id: ${issue.id}, project: ${project.name}): ${issue.title} [${issue.status}] [${issue.priority}]\n  ${desc}`);
            }
        }
        if (issueLines.length > 0) {
            existingIssuesSection = `\n\n---\n**EXISTING ISSUES (${issueLines.length} total — check these BEFORE creating anything):**\n${issueLines.join('\n')}`;
        } else {
            existingIssuesSection = '\n\n---\n**EXISTING ISSUES:** None yet.';
        }
    } catch (err) {
        console.error('[AI Agent] Failed to pre-fetch issues:', err);
        existingIssuesSection = '\n\n---\n**EXISTING ISSUES:** Could not fetch — use list_projects and search_all_issues to check manually.';
    }

    const prompt = `A ${channelTypeLabel} conversation just ended.

**Channel ID:** ${conversation.channel_id}
**Participants:** ${participantList}
**Duration:** ${Math.round(conversation.duration_seconds / 60)} minutes
**Messages:** ${conversation.messages.length}

**Transcript:**
${transcript}
${existingIssuesSection}

Analyze this conversation and take appropriate action. If the conversation seems to reference earlier context or is unclear without prior messages, use get_channel_history with the channel ID above.`;

    const result = await generateText({
        model: openai('gpt-4o-mini'),
        tools,
        maxSteps: 10,
        system: SYSTEM_PROMPT,
        prompt,
        toolChoice: 'auto',
        onStepFinish: (step) => {
            if (step.toolCalls?.length) {
                for (const tc of step.toolCalls) {
                    console.log(`[AI Agent] Tool call: ${tc.toolName}(${JSON.stringify(tc.args).substring(0, 200)})`);
                }
            }
        },
    });

    const actionsTaken = result.steps
        .flatMap((s) => s.toolCalls || [])
        .filter((tc) => tc.toolName === 'create_issue' || tc.toolName === 'update_issue')
        .length;

    return {
        summary: result.text,
        actions_taken: actionsTaken,
    };
}
