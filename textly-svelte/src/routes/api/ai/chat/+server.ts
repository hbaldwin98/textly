import { OpenAI } from 'openai';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { OPENAI_API_KEY } from '$env/static/private';
import { DEFAULT_MODEL } from '$lib/services/ai/openapi';

const client = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: OPENAI_API_KEY,
});

export const POST: RequestHandler = async ({ request }) => {
    try {
        const { message, conversationHistory } = await request.json();

        // Build conversation context from history
        const messages = [
            {
                role: "system",
                content: `You are a helpful AI assistant integrated into a markdown text editor called Textly. 
                You can help users with writing, editing, research, and general questions. 
                Be concise but helpful, and format your responses in markdown when appropriate.
                If the user asks about text editing or writing, you can provide specific suggestions.`
            }
        ];

        // Add conversation history (excluding the current message which is already in the request)
        if (conversationHistory && conversationHistory.length > 0) {
            // Take the last 10 messages for context, excluding the last one (which is the current message)
            const contextMessages = conversationHistory.slice(-11, -1);
            for (const msg of contextMessages) {
                messages.push({
                    role: msg.role,
                    content: msg.content
                });
            }
        }

        // Add the current user message
        messages.push({
            role: "user",
            content: message
        });

        const completion = await client.chat.completions.create({
            model: DEFAULT_MODEL,
            messages: messages as any,
            temperature: 0.7,
            max_tokens: 1000,
            stream: true,
        });

        // Create a readable stream for the response
        const stream = new ReadableStream({
            async start(controller) {
                let isAborted = false;

                // Listen for client disconnection
                request.signal?.addEventListener('abort', () => {
                    isAborted = true;
                    controller.close();
                });

                try {
                    for await (const chunk of completion) {
                        // Check if the request was aborted
                        if (isAborted) {
                            // Break the stream to stop token generation
                            break;
                        }

                        const content = chunk.choices[0]?.delta?.content;
                        if (content) {
                            // Send each chunk as a JSON object
                            const data = JSON.stringify({ content }) + '\n';
                            controller.enqueue(new TextEncoder().encode(data));
                        }
                    }
                    // Only send end signal if not aborted
                    if (!isAborted) {
                        controller.enqueue(new TextEncoder().encode(JSON.stringify({ done: true }) + '\n'));
                    }
                } catch (error: unknown) {
                    // If the error is from an aborted request, just close the stream
                    if (error instanceof Error && error.name === 'AbortError') {
                        controller.close();
                        return;
                    }
                    controller.error(error);
                } finally {
                    controller.close();
                }
            }
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/plain',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });
    } catch (error) {
        console.error('AI Chat API Error:', error);
        return json(
            { error: error instanceof Error ? error.message : 'An error occurred' },
            { status: 500 }
        );
    }
}; 