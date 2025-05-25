<script lang="ts">
  import { onMount } from 'svelte';
  import ConversationService, { type Conversation, type ConversationMessage } from '../../services/ai/conversation.service';

  let conversationService = ConversationService.getInstance();
  let conversations: Conversation[] = [];
  let currentConversation: Conversation | null = null;
  let newMessage = '';
  let loading = false;
  let error = '';

  onMount(async () => {
    await loadConversations();
  });

  async function loadConversations() {
    try {
      conversations = await conversationService.getConversations();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load conversations';
    }
  }

  async function createNewConversation() {
    if (!newMessage.trim()) return;

    loading = true;
    error = '';

    try {
      const response = await conversationService.createConversation({
        message: newMessage.trim()
      });

      // Load the full conversation
      currentConversation = await conversationService.getConversation(response.conversation_id);
      
      // Refresh conversations list
      await loadConversations();
      
      newMessage = '';
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to create conversation';
    } finally {
      loading = false;
    }
  }

  async function loadConversation(conversationId: string) {
    try {
      currentConversation = await conversationService.getConversation(conversationId);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load conversation';
    }
  }

  async function addMessage() {
    if (!newMessage.trim() || !currentConversation) return;

    loading = true;
    error = '';

    try {
      // Build message history
      const messageHistory = conversationService.buildMessageHistory(currentConversation.messages);
      messageHistory.push({ role: 'user', content: newMessage.trim() });

      const response = await conversationService.addMessage({
        conversation_id: currentConversation.id,
        messages: messageHistory
      });

      // Reload the conversation to get the updated messages
      currentConversation = await conversationService.getConversation(currentConversation.id);
      
      // Refresh conversations list
      await loadConversations();
      
      newMessage = '';
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to add message';
    } finally {
      loading = false;
    }
  }

  async function editMessage(messageId: string, newContent: string) {
    if (!currentConversation) return;

    loading = true;
    error = '';

    try {
      await conversationService.editMessage({
        conversation_id: currentConversation.id,
        message_id: messageId,
        new_message: newContent
      });

      // Reload the conversation to get the updated messages
      currentConversation = await conversationService.getConversation(currentConversation.id);
      
      // Refresh conversations list
      await loadConversations();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to edit message';
    } finally {
      loading = false;
    }
  }

  function formatCost(cost: number): string {
    return `$${cost.toFixed(6)}`;
  }

  function formatTokens(tokens: number): string {
    return tokens.toLocaleString();
  }
</script>

<div class="conversation-test p-6 max-w-4xl mx-auto">
  <h1 class="text-2xl font-bold mb-6">Conversation System Test</h1>

  {#if error}
    <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
      {error}
    </div>
  {/if}

  <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
    <!-- Conversations List -->
    <div class="md:col-span-1">
      <h2 class="text-lg font-semibold mb-4">Conversations</h2>
      
      <div class="space-y-2 mb-4">
        {#each conversations as conversation}
          <button
            class="w-full text-left p-3 border rounded hover:bg-gray-50 {currentConversation?.id === conversation.id ? 'bg-blue-50 border-blue-300' : 'border-gray-200'}"
            on:click={() => loadConversation(conversation.id)}
          >
            <div class="font-medium truncate">{conversation.title}</div>
            <div class="text-sm text-gray-500">
              {conversation.total_requests} messages • {formatCost(conversation.cost)}
            </div>
          </button>
        {/each}
      </div>

      <!-- New Conversation -->
      <div class="border-t pt-4">
        <h3 class="font-medium mb-2">Start New Conversation</h3>
        <textarea
          bind:value={newMessage}
          placeholder="Type your message..."
          class="w-full p-2 border border-gray-300 rounded resize-none"
          rows="3"
          disabled={loading}
        ></textarea>
        <button
          on:click={createNewConversation}
          disabled={loading || !newMessage.trim()}
          class="mt-2 w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Creating...' : 'Create Conversation'}
        </button>
      </div>
    </div>

    <!-- Current Conversation -->
    <div class="md:col-span-2">
      {#if currentConversation}
        <div class="border rounded-lg">
          <!-- Conversation Header -->
          <div class="border-b p-4 bg-gray-50">
            <h2 class="text-lg font-semibold">{currentConversation.title}</h2>
            <div class="text-sm text-gray-600 mt-1">
              Total: {formatTokens(currentConversation.input_tokens + currentConversation.output_tokens)} tokens • 
              {formatCost(currentConversation.cost)} • 
              {currentConversation.total_requests} requests
            </div>
          </div>

          <!-- Messages -->
          <div class="p-4 space-y-4 max-h-96 overflow-y-auto">
            {#each currentConversation.messages as message}
              {#if message.active}
                <div class="space-y-2">
                  <!-- User Message -->
                  <div class="bg-blue-100 p-3 rounded-lg">
                    <div class="font-medium text-blue-800">You:</div>
                    <div class="whitespace-pre-wrap">{message.user_message}</div>
                    <button
                      class="text-xs text-blue-600 hover:underline mt-1"
                      on:click={() => {
                        const newContent = prompt('Edit message:', message.user_message);
                        if (newContent && newContent !== message.user_message) {
                          editMessage(message.id, newContent);
                        }
                      }}
                    >
                      Edit
                    </button>
                  </div>

                  <!-- Assistant Response -->
                  <div class="bg-gray-100 p-3 rounded-lg">
                    <div class="font-medium text-gray-800">Assistant:</div>
                    <div class="whitespace-pre-wrap">{message.response_message}</div>
                    <div class="text-xs text-gray-500 mt-2">
                      {formatTokens(message.input_tokens)} in • {formatTokens(message.output_tokens)} out • {formatCost(message.cost)}
                    </div>
                  </div>
                </div>
              {/if}
            {/each}
          </div>

          <!-- Add Message -->
          <div class="border-t p-4">
            <textarea
              bind:value={newMessage}
              placeholder="Type your message..."
              class="w-full p-2 border border-gray-300 rounded resize-none"
              rows="3"
              disabled={loading}
            ></textarea>
            <button
              on:click={addMessage}
              disabled={loading || !newMessage.trim()}
              class="mt-2 bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending...' : 'Send Message'}
            </button>
          </div>
        </div>
      {:else}
        <div class="border rounded-lg p-8 text-center text-gray-500">
          Select a conversation or create a new one to get started
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .conversation-test {
    font-family: system-ui, -apple-system, sans-serif;
  }
</style> 