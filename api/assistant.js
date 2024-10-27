const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const ASSISTANT_ID = process.env.ASSISTANT_ID;

app.use(cors());
app.use(express.json());

app.post('/api/new-thread', async (req, res) => {
    try {
        const thread = await openai.beta.threads.create();
        return res.json({ threadId: thread.id });
    } catch (error) {
        console.error('Error creating thread:', error);
        return res.status(500).json({ error: 'Failed to create thread' });
    }
});

app.post('/api/openai', async (req, res) => {
    const { message, threadId } = req.body;

    if (!message || !threadId) {
        return res.status(400).json({ error: 'Message and threadId are required' });
    }

    try {
        await openai.beta.threads.messages.create(threadId, {
            role: "user",
            content: message
        });

        const run = await openai.beta.threads.runs.create(threadId, {
            assistant_id: ASSISTANT_ID
        });

        let runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
        
        while (runStatus.status !== 'completed') {
            if (runStatus.status === 'failed') {
                throw new Error('Assistant run failed');
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
            runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
        }

        const messages = await openai.beta.threads.messages.list(threadId);
        const lastMessage = messages.data
            .filter(msg => msg.role === 'assistant')
            .shift();

        if (!lastMessage) {
            throw new Error('No response from assistant');
        }

        return res.json({
            message: lastMessage.content[0].text.value
        });

    } catch (error) {
        console.error('Error processing message:', error);
        return res.status(500).json({ error: 'Failed to process message' });
    }
});

if (require.main === module) {
    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
}

module.exports = app;
