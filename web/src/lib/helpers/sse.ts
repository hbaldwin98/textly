interface SSEOptions {
    method?: 'GET' | 'POST';
    headers?: Record<string, string>;
    body?: any;
    onMessage: (data: string) => void;
    onError?: (error: Error) => void;
    onComplete?: () => void;
}

export async function fetchEventSource(url: string, options: SSEOptions) {
    const {
        method = 'GET',
        headers = {},
        body,
        onMessage,
        onError,
        onComplete
    } = options;

    try {
        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            },
            body: body ? JSON.stringify(body) : undefined
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
            throw new Error('Response body is not readable');
        }

        try {
            let buffer = '';
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;
                
                // Process complete SSE events (separated by \n\n)
                let eventEndIndex;
                while ((eventEndIndex = buffer.indexOf('\n\n')) !== -1) {
                    const eventData = buffer.slice(0, eventEndIndex);
                    buffer = buffer.slice(eventEndIndex + 2);
                    
                    if (eventData.trim()) {
                        processSSEEvent(eventData, onMessage, onComplete);
                    }
                }
            }
            
            // Process any remaining complete event in buffer
            if (buffer.trim()) {
                processSSEEvent(buffer, onMessage, onComplete);
            }
        } finally {
            reader.releaseLock();
        }

        onComplete?.();
    } catch (error) {
        onError?.(error instanceof Error ? error : new Error('Unknown error'));
    }
}

function processSSEEvent(eventData: string, onMessage: (data: string) => void, onComplete?: () => void) {
    const lines = eventData.split('\n');
    let data = '';
    
    for (const line of lines) {
        if (line.startsWith('data: ')) {
            const lineData = line.slice(6);
            
            if (lineData.trim() === '[DONE]') {
                onComplete?.();
                return;
            }
            
            // For SSE, multiple data lines should be concatenated with newlines
            if (data) {
                data += '\n' + lineData;
            } else {
                data = lineData;
            }
        }
    }
    
    if (data !== '') {
        // Unescape newlines that were escaped by the server
        const unescapedData = data.replace(/\\n/g, '\n');
        onMessage(unescapedData);
    }
}
