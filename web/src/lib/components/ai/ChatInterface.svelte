<script lang="ts">
  import { aiService, type ChatMessage } from "$lib/services/ai/ai.service";
  import { aiStore } from "$lib/services/ai/ai.store";
  import { onMount, onDestroy } from "svelte";
  import ModelSelector from "./ModelSelector.svelte";
  import ConversationService from "$lib/services/ai/conversation.service";
  import ChatBubble from "./ChatBubble.svelte";
  import ConversationPanel from "./ConversationPanel.svelte";
  import { PocketBaseService } from "$lib/services/pocketbase.service";
  // State
  let messageInput = $state("");
  let chatContainer: HTMLElement;
  let editingMessageId = $state<string | null>(null);
  let editingContent = $state("");
  let editingElement: HTMLElement | null = $state(null);
  let activeMenuMessageId = $state<string | null>(null);
  let isConversationPanelVisible = $state(false);
  let pbService = PocketBaseService.getInstance();
  let pbUnsubscribe: (() => void) | null = null;
  let unsubscribe: (() => void) | null = null;

  let aiState = $derived($aiStore);
  let hasInitialized = $state(false);

  onMount(async () => {
    await aiService.loadConversationsFromBackend();

    // Load last conversation if exists and hasn't been loaded yet
    if (aiState.lastConversationId && !hasInitialized) {
      hasInitialized = true;
      await aiService.loadConversation(aiState.lastConversationId);
    }

    pbUnsubscribe = pbService.client.authStore.onChange(() => {
      if (pbService.client.authStore.isValid) {
        aiService.loadConversationsFromBackend();
      }
    });

    // Subscribe to conversation changes
    unsubscribe = ConversationService.getInstance().subscribeToConversations(
      (updatedConversation) => {
        // Only update if it's not the current conversation
        if (updatedConversation.id !== aiState.currentConversation?.id) {
          aiService.updateConversationInList(updatedConversation);
        }
      }
    );
  });

  onDestroy(() => {
    if (unsubscribe) {
      unsubscribe();
    }

    if (pbUnsubscribe) {
      pbUnsubscribe();
    }
  });

  // Auto-scroll for new messages and streaming content
  let previousMessageCount = 0;
  let previousContentLength = 0;
  let isUserNearBottom = true;
  let shouldAutoScroll = true;
  let currentConversationId = $state<string | null>(null);

  // Track if user is near bottom when they scroll manually
  function handleScroll() {
    if (!chatContainer) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainer;
    isUserNearBottom = scrollTop + clientHeight >= scrollHeight - 50;
    shouldAutoScroll = isUserNearBottom;
  }

  // Smooth scroll to bottom
  function scrollToBottom() {
    if (!chatContainer || !shouldAutoScroll) return;
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  // Combined effect for handling scroll behavior
  $effect(() => {
    if (!chatContainer || !aiState.currentConversation) return;

    const currentMessageCount = aiState.currentConversation.messages.length;
    const currentContentLength = aiState.currentConversation.messages
      .map((m) => m.content.length)
      .reduce((a, b) => a + b, 0);

    const hasNewContent =
      currentMessageCount > previousMessageCount ||
      currentContentLength > previousContentLength;

    const isNewConversation = currentConversationId !== aiState.currentConversation.id;

    if (isNewConversation) {
      shouldAutoScroll = true;
      currentConversationId = aiState.currentConversation.id;
    }

    if ((hasNewContent || isNewConversation) && shouldAutoScroll) {
      requestAnimationFrame(scrollToBottom);
    }

    previousMessageCount = currentMessageCount;
    previousContentLength = currentContentLength;
  });

  $effect(() => {
    if (aiState.chatError) {
      setTimeout(() => {
        aiService.clearChatError();
      }, 5000);
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
    shouldAutoScroll = true;

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

  function toggleMessageMenu(messageId: string) {
    activeMenuMessageId = activeMenuMessageId === messageId ? null : messageId;
  }

  // Close menu when clicking outside
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest(".message-menu") && !target.closest(".menu-button")) {
      activeMenuMessageId = null;
    }

    if (
      isConversationPanelVisible &&
      !target.closest(".conversation-panel") &&
      !target.closest(".panel-toggle")
    ) {
      isConversationPanelVisible = false;
    }
  }

  function toggleConversationPanel() {
    isConversationPanelVisible = !isConversationPanelVisible;
  }
</script>

<svelte:window onclick={handleClickOutside} />

<div class="flex flex-col h-full">
  <!-- Main Content Area -->
  <div class="flex flex-1 min-h-0">
    <!-- Conversation Panel -->
    <ConversationPanel
      isVisible={isConversationPanelVisible}
      onClose={toggleConversationPanel}
    />

    <!-- Chat Messages -->
    <div
      class="flex-1 overflow-y-auto p-3 space-y-4 relative"
      bind:this={chatContainer}
      onwheel={handleScroll}
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
        {#each aiState.currentConversation.messages as message, i}
          <ChatBubble
            {message}
            isEditing={editingMessageId === message.id}
            isLastMessage={i ===
              aiState.currentConversation.messages.length - 1}
            isStreaming={aiState.isChatLoading}
            isActiveMenu={activeMenuMessageId === message.id}
            {editingContent}
            {editingElement}
            onCancel={cancelEditing}
            onApply={sendMessage}
            onInput={handleInput}
            onKeydown={handleKeydown}
            onEdit={(messageId) => startEditing(message)}
            onMenuToggle={(messageId) => toggleMessageMenu(messageId)}
          />
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
