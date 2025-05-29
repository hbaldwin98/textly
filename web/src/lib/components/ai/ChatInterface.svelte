<script lang="ts">
  import { aiService, aiStore, type ChatMessage } from "$lib/services/ai";
  import { onMount, onDestroy } from "svelte";
  import { marked } from "marked";
  import ModelSelector from "./ModelSelector.svelte";
  import ConversationService from "$lib/services/ai/conversation.service";
  import { layoutStore } from "$lib/services/layout/layout.service";

  // State
  let messageInput = $state("");
  let chatContainer: HTMLElement;
  let editingMessageId = $state<string | null>(null);
  let editingContent = $state("");
  let editingElement: HTMLElement | null = $state(null);
  let activeMenuMessageId = $state<string | null>(null);
  let renderedContents = new Map<string, string>();
  let isConversationPanelVisible = $state(false);
  let unsubscribe: (() => void) | null = null;

  // Subscribe to the store using runes
  let aiState = $derived($aiStore);
  let layoutState = $derived($layoutStore);

  // Load conversations on mount
  onMount(async () => {
    await aiService.loadConversationsFromBackend();
    
    // Subscribe to conversation changes
    unsubscribe = ConversationService.getInstance().subscribeToConversations((updatedConversation) => {
      // Only update if it's not the current conversation
      if (updatedConversation.id !== aiState.currentConversation?.id) {
        aiService.updateConversationInList(updatedConversation);
      }
    });
  });

  onDestroy(() => {
    if (unsubscribe) {
      unsubscribe();
    }
  });

  marked.setOptions({
    breaks: true,
    gfm: true,
    async: true,
  });

  function renderMarkdown(
    node: HTMLElement,
    content: string,
    messageId: string
  ) {
    // Check if we already have a rendered version
    if (renderedContents.has(messageId)) {
      node.innerHTML = renderedContents.get(messageId) || "";
      return;
    }

    // During streaming, show raw text with line breaks
    const currentConversation = aiState.currentConversation;
    const messages = currentConversation?.messages;
    const hasMessages = messages && messages.length > 0;
    const lastMessage = hasMessages ? messages[messages.length - 1] : null;

    const isStreaming =
      aiState.isChatLoading &&
      hasMessages &&
      lastMessage?.role === "assistant" &&
      lastMessage.id === messageId;

    if (isStreaming) {
      node.innerHTML = content.replace(/\n/g, "<br>");
      return;
    }

    // Render markdown asynchronously
    const parseResult = marked.parse(content);
    if (parseResult instanceof Promise) {
      parseResult
        .then((rendered: string) => {
          renderedContents.set(messageId, rendered);
          node.innerHTML = rendered;
        })
        .catch((error: Error) => {
          console.error("Error rendering markdown:", error);
          node.innerHTML = content.replace(/\n/g, "<br>");
        });
    } else {
      // If marked returns a string directly (synchronous mode)
      renderedContents.set(messageId, parseResult);
      node.innerHTML = parseResult;
    }
  }

  // Function to convert thinking content newlines to HTML breaks
  function formatThinkingContent(content: string): string {
    if (!content?.trim()?.length) return content;

    try {
      // Use JSON.parse to handle all escape sequences at once
      const unescaped = JSON.parse(`"${content.replace(/^"|"$/g, "")}"`).trim();
      // Then convert newlines to HTML breaks
      return unescaped.replace(/\n/g, "<br>");
    } catch (e) {
      // If JSON.parse fails, fall back to basic unescaping
      console.warn("Failed to parse thinking content:", e);
      return content
        .replace(/\\n/g, "\n")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\")
        .trim()
        .replace(/\n/g, "<br>");
    }
  }

  // Create a Svelte action for markdown rendering
  function markdownAction(node: HTMLElement, params: [string, string]) {
    const [content, messageId] = params;
    renderMarkdown(node, content, messageId);

    return {
      update(params: [string, string]) {
        const [content, messageId] = params;
        renderMarkdown(node, content, messageId);
      },
    };
  }

  // Handle side effects reactively
  $effect(() => {
    if (aiState.chatError) {
      setTimeout(() => {
        aiService.clearChatError();
      }, 5000);
    }
  });

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

  $effect(() => {
    if (chatContainer && aiState.currentConversation?.messages) {
      const currentMessageCount = aiState.currentConversation.messages.length;
      const currentContentLength = aiState.currentConversation.messages
        .map((m) => m.content.length)
        .reduce((a, b) => a + b, 0);

      if (
        (currentMessageCount > previousMessageCount ||
          currentContentLength > previousContentLength) &&
        isUserNearBottom
      ) {
        setTimeout(() => {
          if (chatContainer && isUserNearBottom) {
            chatContainer.scrollTop = chatContainer.scrollHeight;
          }
        }, 10);
      }

      previousMessageCount = currentMessageCount;
      previousContentLength = currentContentLength;
    }
  });

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    } else if (event.key === "Escape" && editingMessageId) {
      event.preventDefault();
      cancelEditing();
    }
  }

  function handleInput(event: Event) {
    const target = event.target as HTMLElement;
    messageInput = target.innerText;
  }

  function startEditing(message: ChatMessage) {
    editingMessageId = message.id;
    editingContent = message.content;
    messageInput = message.content;
    // Focus the contenteditable div after a short delay to ensure it's mounted
    setTimeout(() => {
      if (editingElement) {
        editingElement.focus();
      }
    }, 0);
  }

  function cancelEditing() {
    editingMessageId = null;
    editingContent = "";
    messageInput = "";
    editingElement = null;
  }

  async function sendMessage() {
    if (!messageInput.trim() || aiState.isChatLoading) return;

    const message = messageInput.trim();
    messageInput = "";

    try {
      if (editingMessageId && aiState.currentConversation) {
        // Store IDs before clearing state
        const conversationId = aiState.currentConversation.id;
        const messageId = editingMessageId;

        // Clear editing state immediately
        editingMessageId = null;
        editingContent = "";
        editingElement = null;

        // Use the service to handle editing and sending
        await aiService.editChatMessage(conversationId, messageId, message);
      } else {
        // Send new message
        await aiService.sendChatMessage(message);
      }
    } catch (err) {
      console.error("Failed to send message:", err);
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
    if (diffHours < 48) return "1 day ago";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  }

  function formatMessageTime(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function createNewConversation() {
    aiService.createNewConversation();
  }

  async function loadConversation(conversationId: string) {
    await aiService.loadConversation(conversationId);
  }

  async function deleteConversation(conversationId: string) {
    try {
      await aiService.deleteConversation(conversationId);
    } catch (err) {
      console.error("Failed to delete conversation:", err);
      // Error is already handled in the service and shown in the UI
    }
  }

  function toggleMessageMenu(messageId: string) {
    activeMenuMessageId = activeMenuMessageId === messageId ? null : messageId;
  }

  // Close menu when clicking outside
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest(".message-menu") && !target.closest(".menu-button")) {
      activeMenuMessageId = null;
    }
  }
</script>

<svelte:window onclick={handleClickOutside} />

<div class="flex flex-col h-full">
  <!-- Main Content Area -->
  <div class="flex flex-1 min-h-0">
    <!-- Conversation List -->
    <div
      class="w-64 border-r border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 transition-all duration-300 fixed top-0 bottom-0 left-0 z-50 shadow-xl"
      class:translate-x-0={isConversationPanelVisible}
      class:-translate-x-full={!isConversationPanelVisible}
    >
      <!-- Panel Tab -->
      <div class="absolute -right-6 top-1/2 -translate-y-1/2">
        <button
          class="w-6 h-12 bg-white dark:bg-zinc-900 border border-l-0 border-gray-200 dark:border-zinc-800 rounded-r-md shadow-sm hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center"
          onclick={() =>
            (isConversationPanelVisible = !isConversationPanelVisible)}
          title={isConversationPanelVisible
            ? "Hide Previous Conversations"
            : "Show Previous Conversations"}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-3 w-3 text-gray-600 dark:text-zinc-400"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            {#if isConversationPanelVisible}
              <path
                fill-rule="evenodd"
                d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                clip-rule="evenodd"
              />
            {:else}
              <path
                fill-rule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clip-rule="evenodd"
              />
            {/if}
          </svg>
        </button>
      </div>

      <div class="p-3 h-full flex flex-col">
        <div class="flex items-center justify-between mb-3">
          <h4
            class="text-xs font-medium text-gray-600 dark:text-zinc-400 uppercase tracking-wide"
          >
            Conversations
          </h4>
          <div class="flex items-center gap-2">
            <button
              class="px-2 py-1 text-xs text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 transition-colors flex items-center gap-1"
              onclick={createNewConversation}
              title="New Chat"
              aria-label="Start New Chat"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-3 w-3"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fill-rule="evenodd"
                  d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                  clip-rule="evenodd"
                />
              </svg>
              New
            </button>
            {#if layoutState.isFullscreen}
              <button
                class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 transition-colors"
                onclick={() => (isConversationPanelVisible = false)}
                title="Close Panel"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-4 w-4"
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
            {/if}
          </div>
        </div>

        <div class="flex-1 overflow-y-auto space-y-1">
          {#each aiState.conversations as conversation}
            <div class="flex items-center gap-2 pr-2">
              <button
                class="flex-1 text-left text-xs p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors truncate min-w-0"
                class:bg-blue-50={aiState.currentConversation?.id ===
                  conversation.id}
                class:dark:bg-blue-950={aiState.currentConversation?.id ===
                  conversation.id}
                class:text-blue-600={aiState.currentConversation?.id ===
                  conversation.id}
                class:dark:text-blue-400={aiState.currentConversation?.id ===
                  conversation.id}
                onclick={() => loadConversation(conversation.id)}
                title={conversation.title}
              >
                <div class="flex items-center justify-between gap-2 min-w-0">
                  <div class="font-medium truncate flex-1">
                    {conversation.title}
                  </div>
                  <div
                    class="text-gray-500 dark:text-zinc-400 flex-shrink-0 text-right"
                  >
                    {formatTimestamp(conversation.updatedAt)}
                  </div>
                </div>
              </button>
              <button
                class="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors flex-shrink-0"
                onclick={() => {
                  if (
                    confirm(
                      "Are you sure you want to delete this conversation? This action cannot be undone."
                    )
                  ) {
                    deleteConversation(conversation.id);
                  }
                }}
                title="Delete Chat"
                aria-label="Delete Current Chat"
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
            <div class="text-xs text-gray-500 dark:text-zinc-400 text-center py-2">
              No conversations yet
            </div>
          {/if}
        </div>
      </div>
    </div>

    <!-- Chat Messages -->
    <div
      class="flex-1 overflow-y-auto p-3 space-y-4 relative"
      bind:this={chatContainer}
      onscroll={handleScroll}
    >
      {#if aiState.currentConversation?.messages.length === 0 || !aiState.currentConversation}
        <div class="text-center text-gray-500 dark:text-zinc-400 py-8">
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
              class="w-[80%] {message.role === 'user' ? 'order-2' : 'order-1'}"
            >
              <div class="relative">
                <div
                  class="px-3 py-2 rounded-lg text-sm {message.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100'}"
                >
                  {#if message.role === "user" && editingMessageId === message.id}
                    <div class="flex flex-col">
                      <div
                        contenteditable="true"
                        bind:this={editingElement}
                        bind:innerHTML={editingContent}
                        oninput={handleInput}
                        onkeydown={handleKeydown}
                        class="w-full bg-transparent outline-none whitespace-pre-wrap break-words min-h-[1.5em]"
                        role="textbox"
                        aria-multiline="true"
                        tabindex="0"
                      ></div>
                      <div class="flex justify-end gap-2 mt-2">
                        <button
                          class="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded transition-colors"
                          onclick={cancelEditing}
                          title="Cancel editing"
                          disabled={aiState.isChatLoading}
                        >
                          Cancel
                        </button>
                        <button
                          class="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                          onclick={sendMessage}
                          disabled={!messageInput.trim() || aiState.isChatLoading}
                          title="Apply changes and resubmit"
                        >
                          Apply
                        </button>
                      </div>
                      {#if aiState.isChatLoading}
                        <div class="flex items-center space-x-1 mt-2">
                          <div
                            class="w-1.5 h-1.5 bg-gray-400 dark:bg-zinc-400 rounded-full animate-bounce"
                          ></div>
                          <div
                            class="w-1.5 h-1.5 bg-gray-400 dark:bg-zinc-400 rounded-full animate-bounce"
                            style="animation-delay: 0.1s"
                          ></div>
                          <div
                            class="w-1.5 h-1.5 bg-gray-400 dark:bg-zinc-400 rounded-full animate-bounce"
                            style="animation-delay: 0.2s"
                          ></div>
                        </div>
                      {/if}
                    </div>
                  {:else}
                    {#if message.role === "user"}
                      <div
                        class="whitespace-pre-wrap break-words overflow-hidden {editingMessageId !==
                        message.id
                          ? 'pr-8'
                          : ''}"
                      >
                        {message.content}
                      </div>
                    {:else if message.thinking}
                      <!-- Thinking bubble -->
                      <div
                        class="flex items-center space-x-2 text-gray-500 dark:text-zinc-400"
                      >
                        <div class="flex items-center space-x-1">
                          <div
                            class="w-2 h-2 bg-gray-400 dark:bg-zinc-400 rounded-full animate-bounce"
                          ></div>
                          <div
                            class="w-2 h-2 bg-gray-400 dark:bg-zinc-400 rounded-full animate-bounce"
                            style="animation-delay: 0.1s"
                          ></div>
                          <div
                            class="w-2 h-2 bg-gray-400 dark:bg-zinc-400 rounded-full animate-bounce"
                            style="animation-delay: 0.2s"
                          ></div>
                        </div>
                        <span class="text-sm">Thinking...</span>
                      </div>
                      {#if message.thinkingContent}
                        <details class="mt-2 text-sm">
                          <summary
                            class="cursor-pointer text-gray-600 dark:text-zinc-300 hover:text-gray-800 dark:hover:text-zinc-100"
                          >
                            <span class="text-xs">💭 View thought process</span>
                          </summary>
                          <div
                            class="mt-2 p-3 bg-gray-50 dark:bg-zinc-800 rounded-md border-l-4 border-blue-300 dark:border-blue-600"
                          >
                            <div
                              class="text-gray-700 dark:text-zinc-300 font-mono text-xs"
                            >
                              {@html formatThinkingContent(
                                message.thinkingContent
                              )}
                            </div>
                          </div>
                        </details>
                      {/if}
                    {:else}
                      <div
                        class="prose prose-sm dark:prose-invert max-w-none"
                        use:markdownAction={[message.content, message.id]}
                      ></div>
                      {#if message.thinkingContent}
                        <details class="mt-2">
                          <summary
                            class="cursor-pointer text-gray-600 dark:text-zinc-300 hover:text-gray-800 dark:hover:text-zinc-100"
                          >
                            <span class="text-xs">💭 View thought process</span>
                          </summary>
                          <div
                            class="mt-2 p-3 bg-gray-50 dark:bg-zinc-800 rounded-md border-l-4 border-blue-300 dark:border-blue-600"
                          >
                            <div
                              class="text-gray-700 dark:text-zinc-300 font-mono text-xs"
                            >
                              {@html formatThinkingContent(
                                message.thinkingContent
                              )}
                            </div>
                          </div>
                        </details>
                      {/if}
                      {#if aiState.isChatLoading && message.id === aiState.currentConversation?.messages[aiState.currentConversation.messages.length - 1]?.id}
                        <div class="flex items-center space-x-1 mt-2">
                          <div
                            class="w-1.5 h-1.5 bg-gray-400 dark:bg-zinc-400 rounded-full animate-bounce"
                          ></div>
                          <div
                            class="w-1.5 h-1.5 bg-gray-400 dark:bg-zinc-400 rounded-full animate-bounce"
                            style="animation-delay: 0.1s"
                          ></div>
                          <div
                            class="w-1.5 h-1.5 bg-gray-400 dark:bg-zinc-400 rounded-full animate-bounce"
                            style="animation-delay: 0.2s"
                          ></div>
                        </div>
                      {/if}
                    {/if}
                    {#if message.role === "user" && editingMessageId !== message.id}
                      <button
                        class="menu-button absolute top-2 right-2 p-1 text-blue-200 hover:text-white transition-colors"
                        onclick={() => toggleMessageMenu(message.id)}
                        title="Message options"
                        aria-label="Message options menu"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          class="h-4 w-4"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"
                          />
                        </svg>
                      </button>
                    {/if}
                  {/if}
                </div>
                {#if message.role === "user" && editingMessageId !== message.id && activeMenuMessageId === message.id}
                  <div
                    class="message-menu absolute right-0 top-full mt-1 bg-white dark:bg-zinc-900 shadow-lg rounded-lg py-1 z-50 min-w-[120px]"
                  >
                    <button
                      class="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2 text-gray-700 dark:text-zinc-100"
                      onclick={() => {
                        startEditing(message);
                        activeMenuMessageId = null;
                      }}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-4 w-4"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"
                        />
                      </svg>
                      Edit message
                    </button>
                  </div>
                {/if}
              </div>
              <div
                class="text-xs text-gray-500 dark:text-zinc-400 mt-1 {message.role ===
                'user'
                  ? 'text-right'
                  : 'text-left'}"
              >
                {#if !(message.role === "assistant" && aiState.isChatLoading && message.id === aiState.currentConversation?.messages[aiState.currentConversation.messages.length - 1]?.id)}
                  {formatMessageTime(message.timestamp)}
                {/if}
              </div>
            </div>
          </div>
        {/each}
      {/if}

      {#if aiState.isChatLoading}
        <!-- Show loading indicator when waiting for response to start -->
        {#if !aiState.currentConversation?.messages.length || aiState.currentConversation.messages[aiState.currentConversation.messages.length - 1]?.role !== "assistant"}
          <div class="flex justify-start">
            <div class="w-[80%]">
              <div
                class="px-3 py-2 rounded-lg text-sm bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100"
              >
                <div
                  class="flex items-center space-x-2 text-gray-500 dark:text-zinc-400"
                >
                  <div class="flex items-center space-x-1">
                    <div
                      class="w-2 h-2 bg-gray-400 dark:bg-zinc-400 rounded-full animate-bounce"
                    ></div>
                    <div
                      class="w-2 h-2 bg-gray-400 dark:bg-zinc-400 rounded-full animate-bounce"
                      style="animation-delay: 0.1s"
                    ></div>
                    <div
                      class="w-2 h-2 bg-gray-400 dark:bg-zinc-400 rounded-full animate-bounce"
                      style="animation-delay: 0.2s"
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        {/if}
      {/if}

      {#if aiState.chatError}
        <div
          class="text-sm text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded"
        >
          {aiState.chatError}
        </div>
      {/if}
    </div>
  </div>

  <!-- Message Input -->
  <div class="border-t border-gray-200 dark:border-zinc-800 p-3">
    <!-- Model Selector -->
    <div class="mb-2">
      <ModelSelector />
    </div>

    <div class="flex gap-2">
      <textarea
        bind:value={messageInput}
        onkeydown={handleKeydown}
        placeholder="Ask the AI assistant anything..."
        class="flex-1 resize-none rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-500 dark:placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        rows="2"
        disabled={aiState.isChatLoading || !!editingMessageId}
      ></textarea>
      {#if aiState.isChatLoading}
        <button
          onclick={() => aiService.stopCurrentConversation()}
          class="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center gap-2"
          title="Stop generating"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fill-rule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z"
              clip-rule="evenodd"
            />
          </svg>
          Stop
        </button>
      {:else}
        <button
          onclick={sendMessage}
          disabled={!messageInput.trim() || !!editingMessageId}
          class="flex items-center gap-1.5 px-5 py-2 text-sm font-medium rounded border bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 transition-all"
          title="Send Message"
          aria-label="Send Message"
        >
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
        </button>
      {/if}
    </div>
    <div class="text-xs text-gray-500 dark:text-zinc-400 mt-1">
      Press Enter to send, Shift+Enter for new line
    </div>
  </div>
</div>

<style>
  /* Prevent text selection when right-clicking */
  :global(.user-message) {
    user-select: none;
  }

  /* Remove transitions that might cause issues */
</style>
