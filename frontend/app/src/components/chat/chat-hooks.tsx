import { type Chat, type ChatMessage, ChatMessageRole } from '@/api/chats';
import { isBootstrapStatusPassed } from '@/api/system';
import { ChatController } from '@/components/chat/chat-controller';
import { ChatMessageController, type OngoingState } from '@/components/chat/chat-message-controller';
import { useBootstrapStatus } from '@/components/system/BootstrapStatusProvider';
import { useLatestRef } from '@/components/use-latest-ref';
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';

export interface ChatsProviderValues {
  chats: Map<string, ChatController>;
  disabled: boolean;

  newChat (...args: ConstructorParameters<typeof ChatController>): ChatController;

  destroyChat (id: string): void;
}

const ChatsContext = createContext<ChatsProviderValues>({
  chats: new Map(),
  disabled: true,
  newChat (): ChatController {
    throw new Error('not in a chat context');
  },
  destroyChat () {
    throw new Error('not in a chat context');
  },
});

const ChatControllerContext = createContext<ChatController | null>(null);

export function ChatsProvider ({ children }: { children: ReactNode }) {
  const bootstrapStatusRef = useLatestRef(useBootstrapStatus());
  const [chats, setChats] = useState(() => new Map<string, ChatController>);

  const newChat: ChatsProviderValues['newChat'] = (...args) => {
    if (!isBootstrapStatusPassed(bootstrapStatusRef.current)) {
      throw new Error('System check not passed.');
    }

    const controller = new ChatController(...args);
    controller.once('created', (chat) => {
      setChats(chats => new Map(chats).set(chat.id, controller));
    });

    return controller;
  };

  const destroyChat: ChatsProviderValues['destroyChat'] = (id: string) => {
    setChats(chats => {
      chats = new Map(chats);
      chats.delete(id);
      return chats;
    });
  };

  return (
    <ChatsContext.Provider value={{
      chats,
      disabled: !isBootstrapStatusPassed(bootstrapStatusRef.current),
      newChat,
      destroyChat,
    }}>
      {children}
    </ChatsContext.Provider>
  );
}

export function ChatControllerProvider ({ controller, children }: { controller: ChatController | null, children: ReactNode }) {

  return (
    <ChatControllerContext.Provider value={controller}>
      {children}
    </ChatControllerContext.Provider>
  );
}

export function useChats () {
  return useContext(ChatsContext);
}

export interface ChatMessageGroup {
  user: ChatMessageController;
  assistant: ChatMessageController | undefined;
}

export function useChatController (id: string | undefined, initialChat: Chat | undefined, initialMessages: ChatMessage[] | undefined) {
  const { chats, newChat } = useChats();

  // Create essential chat controller
  const [controller, setController] = useState(() => {
    if (id) {
      let controller = chats.get(id);
      if (!controller) {
        controller = new ChatController(initialChat, initialMessages);
        chats.set(id, controller);
      }
      return controller;
    } else {
      return new ChatController(undefined, undefined, undefined);
    }
  });

  return controller;
}

export function useChatInfo (controller: ChatController) {
  const [chat, setChat] = useState(controller.chat);

  useEffect(() => {
    if (controller) {
      setChat(controller.chat);
      const handleChatUpdated = (chat: Chat) => setChat(chat);
      controller
        .on('updated', handleChatUpdated)
        .on('created', handleChatUpdated);
      return () => {
        controller
          .off('updated', handleChatUpdated)
          .off('created', handleChatUpdated);
      };
    }
  }, [controller]);

  return chat;
}

export function useChatPostState (controller: ChatController | undefined) {
  const [state, setState] = useState(controller?.postState ?? { initialized: false, params: undefined, error: undefined });

  useEffect(() => {
    if (controller) {
      setState(controller.postState);

      const handleStateChange = () => {
        setState(controller.postState);
      };

      controller
        .on('post', handleStateChange)
        .on('post-initialized', handleStateChange)
        .on('post-finished', handleStateChange)
        .on('post-error', handleStateChange);

      return () => {
        controller
          .off('post', handleStateChange)
          .off('post-initialized', handleStateChange)
          .off('post-finished', handleStateChange)
          .off('post-error', handleStateChange);
      };
    }
  }, [controller]);

  return state;
}

export function useChatMessageControllers (controller: ChatController) {
  const [messageControllers, setMessageControllers] = useState(() => controller?.messages);

  useEffect(() => {
    if (controller) {
      setMessageControllers(controller.messages);

      const handleMessageLoaded = () => {
        setMessageControllers(controller.messages);
      };

      controller.on('message-loaded', handleMessageLoaded);

      return () => {
        controller.off('message-loaded', handleMessageLoaded);
      };
    }
  }, [controller]);

  return messageControllers;
}

export function useChatMessageGroups (controllers: ChatMessageController[]) {
  const [chatMessageGroups, setChatMessageGroups] = useState<ChatMessageGroup[]>(() => collectMessageGroups(controllers));

  useEffect(() => {
    setChatMessageGroups(collectMessageGroups(controllers));
  }, [controllers]);

  return chatMessageGroups;
}

function collectMessageGroups (messageControllers: ChatMessageController[]) {
  const groups: ChatMessageGroup[] = [];

  let user: ChatMessageController | undefined;

  for (let messageController of messageControllers) {
    switch (messageController.role) {
      case ChatMessageRole.user:
        user = messageController;
        break;
      case ChatMessageRole.assistant:
        if (user) {
          groups.push({
            user,
            assistant: messageController,
          });
        } else {
          console.warn('No matched user message, drop assistant message', messageController.message.id);
        }
        break;
    }
  }

  return groups;
}

export function useCurrentChatController () {
  const controller = useContext(ChatControllerContext);

  if (!controller) {
    throw new Error('Not in a chat controller provider');
  }

  return controller;
}

export function useChatMessageField<K extends keyof ChatMessage> (controller: ChatMessageController, key: K): ChatMessage[K];
export function useChatMessageField<K extends keyof ChatMessage> (controller: ChatMessageController | undefined, key: K): ChatMessage[K] | undefined;
export function useChatMessageField (controller: ChatMessageController | undefined, key: keyof ChatMessage): any {
  const [value, setValue] = useState(controller?.message[key]);

  useEffect(() => {
    if (controller) {
      setValue(controller.message[key]);

      const handleUpdate = (message: ChatMessage) => {
        setValue(message[key]);
      };

      controller
        .on('update', handleUpdate)
        .on('stream-update', handleUpdate)
        .on('stream-error', handleUpdate)
        .on('stream-finished', handleUpdate);
      return () => {
        controller
          .off('update', handleUpdate)
          .off('stream-update', handleUpdate)
          .off('stream-error', handleUpdate)
          .off('stream-finished', handleUpdate);
      };
    } else {
      setValue(undefined);
    }
  }, [controller]);

  return value;
}

export function useChatMessageStreamState (controller: ChatMessageController | undefined): OngoingState | undefined {
  const [state, setState] = useState(controller?.ongoing);

  useEffect(() => {
    if (controller) {
      setState(controller.ongoing);

      const handleUpdate = (_: any, state?: OngoingState) => setState(state);

      controller
        .on('stream-update', handleUpdate)
        .on('stream-error', handleUpdate)
        .on('stream-finished', handleUpdate);

      return () => {
        controller
          .off('stream-update', handleUpdate)
          .off('stream-error', handleUpdate)
          .off('stream-finished', handleUpdate);
      };
    } else {
      setState(undefined);
    }
  }, [controller]);

  return state;
}
