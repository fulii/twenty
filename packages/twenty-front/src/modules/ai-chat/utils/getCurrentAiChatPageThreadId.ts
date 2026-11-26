import { type createStore } from 'jotai';

import { newAiChatThreadIdState } from '@/ai-chat/states/newAiChatThreadIdState';
import { getAiChatPageThreadId } from '@/ai-chat/utils/getAiChatPageThreadId';
import { getAppPathname } from '~/utils/getAppPathname';

export const getCurrentAiChatPageThreadId = (
  store: ReturnType<typeof createStore>,
) =>
  getAiChatPageThreadId({
    pathname: getAppPathname(),
    newAiChatThreadId: store.get(newAiChatThreadIdState.atom),
  });
