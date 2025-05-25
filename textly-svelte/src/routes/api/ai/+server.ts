import { OpenAI } from 'openai';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { OPENAI_API_KEY } from '$env/static/private';

console.log('API Key available:', !!OPENAI_API_KEY);

const client = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: OPENAI_API_KEY,
});

export const POST: RequestHandler = async ({ request }) => {
    try {
        const { type, text, context, cursorPosition } = await request.json();

        let systemPrompt = '';
        let userPrompt = '';

        switch (type) {
            case 'improvement':
                systemPrompt = `You are a helpful assistant that suggests improvements to text.
                    Be concise and to the point.
                    Do not include any other text other than the improved text.
                    Do not include how you refined the text, just the improved text.
                    Only give one improved text at a time. If it's a paragraph, give the whole paragraph.
                    Do not explain the improvement, just give it.
                    Do not show the before and after of the text, just the improved text.
                    Do not include any other text other than the improved text. That includes quotations, citations, or symbols.
                    Utilize the context if necessary but do not include it in the improved text.`;
                userPrompt = text
                    ? `Selected Text: ${text}\nSurrounding Context: ${context}`
                    : `Text: ${context}\nCursor Position: ${JSON.stringify(cursorPosition)}`;
                break;

            case 'synonyms':
                systemPrompt = `You are a helpful assistant that provides synonyms for words.
                    Provide a list of synonyms for the given word, separated by commas.
                    Be concise and only include relevant synonyms.
                    Do not include any other text or explanations.
                    Do not include any symbols such as quotes, citations, or symbols at the beginning or end of the text.`;
                userPrompt = `Word: ${text}`;
                break;

            case 'description':
                systemPrompt = `You are a helpful assistant that provides descriptions for text.
                    Provide a clear and concise description of the given text.
                    Be informative but brief.
                    Do not include any other text or explanations.
                    Do not include any symbols such as quotes, citations, or symbols at the beginning or end of the text.`;
                userPrompt = `Text: ${text}`;
                break;

            default:
                throw new Error('Invalid query type');
        }

        const completion = await client.chat.completions.create({
            model: "mistralai/devstral-small:free",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
            ],
        });

        if (!completion.choices[0].message.content) {
            throw new Error("Failed to get response");
        }

        const suggestion = completion.choices[0].message.content.replace(/\\n/g, "\n");

        return json({ suggestion });
    } catch (error) {
        console.error('AI API Error:', error);
        return json(
            { error: error instanceof Error ? error.message : 'An error occurred' },
            { status: 500 }
        );
    }
}; 