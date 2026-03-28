// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import express from 'express';

import { analyzeConversation } from './agent';
import type { AnalyzeRequest } from './types';

const app = express();
app.use(express.json());

app.post('/analyze', async (req, res) => {
    const request = req.body as AnalyzeRequest;

    if (!request.conversation || !request.openai_api_key) {
        res.status(400).json({ error: 'missing conversation or openai_api_key' });
        return;
    }

    console.log(
        `[AI Service] Analyzing conversation: ${request.conversation.messages.length} messages, ` +
        `${request.conversation.participants.length} participants, ` +
        `channel_type=${request.conversation.channel_type}`,
    );

    try {
        const result = await analyzeConversation(request);
        console.log(`[AI Service] Done: ${result.actions_taken} actions taken`);
        res.json(result);
    } catch (error) {
        console.error('[AI Service] Error:', error);
        res.status(500).json({ error: 'analysis failed' });
    }
});

app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
    console.log(`[AI Service] Listening on port ${port}`);
});
