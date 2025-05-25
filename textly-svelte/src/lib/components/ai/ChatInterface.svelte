<script lang="ts">
  import {
    aiService,
    aiStore,
    type ChatMessage,
    type ChatConversation,
  } from "$lib/services/ai";

  // State
  let messageInput = "";
  let chatContainer: HTMLElement;

  // Use Svelte's reactive store syntax for better reactivity
  $: aiState = $aiStore;

  // Handle side effects reactively
  $: if (aiState.chatError) {
    setTimeout(() => {
      aiService.clearChatError();
    }, 5000);
  }

    // Auto-scroll for new messages and streaming content
  let previousMessageCount = 0;
  let previousContentLength = 0;
  let isUserNearBottom = true;
  
  // Track if user is near bottom when they scroll manually
  function handleScroll() {
    if (!chatContainer) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainer;
    isUserNearBottom = scrollTop + clientHeight >= scrollHeight - 100;
  }
  
  $: if (chatContainer && aiState.currentConversation?.messages) {
    const currentMessageCount = aiState.currentConversation.messages.length;
    const currentContentLength = aiState.currentConversation.messages
      .map(m => m.content.length)
      .reduce((a, b) => a + b, 0);
    
    // Auto-scroll if:
    // 1. New message added, OR
    // 2. Content length increased (streaming), AND
    // 3. User is near bottom
    if ((currentMessageCount > previousMessageCount || currentContentLength > previousContentLength) && isUserNearBottom) {
      setTimeout(() => {
        if (chatContainer && isUserNearBottom) {
          chatContainer.scrollTop = chatContainer.scrollHeight;
        }
      }, 10);
    }
    
    previousMessageCount = currentMessageCount;
    previousContentLength = currentContentLength;
  }

  async function sendMessage() {
    if (!messageInput.trim() || aiState.isChatLoading) return;

    const message = messageInput.trim();
    messageInput = "";

    try {
      await aiService.sendChatMessage(message);
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  function formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - timestamp;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  function formatMessageTime(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function createNewConversation() {
    aiService.createNewConversation();
  }

  function loadConversation(conversationId: string) {
    aiService.loadConversation(conversationId);
  }

  function deleteConversation(conversationId: string) {
    aiService.deleteConversation(conversationId);
  }

      
</script>

<div class="flex flex-col h-full">
  <!-- Conversation List -->
  <div class="border-b border-gray-200 dark:border-zinc-700 p-3">
    <div class="flex items-center justify-between mb-3">
      <h4
        class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide"
      >
        Conversations
      </h4>
      <button
        class="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        on:click={createNewConversation}
      >
        New Chat
      </button>
    </div>

    <div class="space-y-1 max-h-32 overflow-y-auto">
      {#each aiState.conversations as conversation}
        <div class="flex items-center gap-2">
          <button
            class="flex-1 text-left text-xs p-2 rounded hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors truncate"
            class:bg-blue-50={aiState.currentConversation?.id ===
              conversation.id}
            class:text-blue-600={aiState.currentConversation?.id ===
              conversation.id}
            class:dark:text-blue-400={aiState.currentConversation?.id ===
              conversation.id}
            on:click={() => loadConversation(conversation.id)}
            title={conversation.title}
          >
            <div class="font-medium truncate">{conversation.title}</div>
            <div class="text-gray-500 dark:text-gray-400">
              {formatTimestamp(conversation.updatedAt)}
            </div>
          </button>
          <button
            class="p-1 text-gray-400 hover:text-red-500 transition-colors"
            on:click={() => deleteConversation(conversation.id)}
            title="Delete conversation"
            aria-label="Delete conversation"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-3 w-3"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clip-rule="evenodd"
              />
            </svg>
          </button>
        </div>
      {/each}

      {#if aiState.conversations.length === 0}
        <div class="text-xs text-gray-500 dark:text-gray-400 text-center py-2">
          No conversations yet
        </div>
      {/if}
    </div>
  </div>

  <!-- Chat Messages -->
  <div class="flex-1 overflow-y-auto p-3 space-y-3" bind:this={chatContainer} on:scroll={handleScroll}>
    {#if aiState.currentConversation?.messages.length === 0 || !aiState.currentConversation}
      <div class="text-center text-gray-500 dark:text-gray-400 py-8">
        <div class="text-2xl mb-2">💬</div>
        <div class="text-sm">Start a conversation with the AI assistant</div>
        <div class="text-xs mt-1">
          Ask questions, get writing help, or discuss ideas
        </div>
      </div>
    {:else}
      {#each aiState.currentConversation.messages as message}
        <div
          class="flex {message.role === 'user'
            ? 'justify-end'
            : 'justify-start'}"
        >
          <div
            class="max-w-[80%] {message.role === 'user'
              ? 'order-2'
              : 'order-1'}"
          >
            <div
              class="px-3 py-2 rounded-lg text-sm {message.role === 'user'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-gray-100'}"
            >
              <div class="whitespace-pre-wrap break-words overflow-hidden">
                {message.content}
              </div>
            </div>
            <div
              class="text-xs text-gray-500 dark:text-gray-400 mt-1 {message.role ===
              'user'
                ? 'text-right'
                : 'text-left'}"
            >
              {formatMessageTime(message.timestamp)}
            </div>
          </div>
        </div>
      {/each}
    {/if}

    {#if aiState.isChatLoading}
      <div class="flex justify-start">
        <div class="max-w-[80%]">
          <div class="px-3 py-2 rounded-lg bg-gray-100 dark:bg-zinc-800">
            <div class="flex items-center space-x-1">
              <div
                class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
              ></div>
              <div
                class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                style="animation-delay: 0.1s"
              ></div>
              <div
                class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                style="animation-delay: 0.2s"
              ></div>
            </div>
          </div>
        </div>
      </div>
    {/if}

    {#if aiState.chatError}
      <div
        class="text-sm text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded"
      >
        {aiState.chatError}
      </div>
    {/if}
  </div>

  <!-- Message Input -->
  <div class="border-t border-gray-200 dark:border-zinc-700 p-3">
    <div class="flex gap-2">
      <textarea
        bind:value={messageInput}
        on:keydown={handleKeydown}
        placeholder="Ask the AI assistant anything..."
        class="flex-1 resize-none rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        rows="2"
        disabled={aiState.isChatLoading}
      ></textarea>
      <button
        on:click={sendMessage}
        disabled={!messageInput.trim() || aiState.isChatLoading}
        class="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        title="Send message (Enter)"
      >
        {#if aiState.isChatLoading}
          <div
            class="animate-spin rounded-full h-3 w-3 border-b-2 border-white"
          ></div>
        {:else}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"
            />
          </svg>
        {/if}
      </button>
    </div>
    <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
      Press Enter to send, Shift+Enter for new line
    </div>
  </div>
</div>
