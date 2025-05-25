import { fetchEventSource } from '$lib/helpers/sse';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
    try {
        const { message, conversationHistory } = await request.json();

        // Build messages
        const messages = [
            ...conversationHistory?.slice(-11, -1) || [],
            { role: "user", content: message }
        ];

        const stream = new ReadableStream({
            start(controller) {
                fetchEventSource('http://localhost:8080/ai/chat', {
                    method: 'POST',
                    body: { messages: messages },
                    onMessage: (data) => {
                        if (data === '[DONE]') {
                            const chunk = JSON.stringify({ done: true }) + '\n';
                            controller.enqueue(new TextEncoder().encode(chunk));
                        } else {
                            const chunk = JSON.stringify({ content: data }) + '\n';
                            controller.enqueue(new TextEncoder().encode(chunk));
                        }
                    },
                    onComplete: () => {
                        controller.close();
                    },
                    onError: (error) => {
                        controller.error(error);
                    }
                });
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
        return new Response(JSON.stringify({ error: 'An error occurred' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}; 