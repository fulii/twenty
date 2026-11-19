import { createStore } from 'jotai';

import { newAiChatThreadIdState } from '@/ai/states/newAiChatThreadIdState';
import { getCurrentAiChatPageThreadId } from '@/ai/utils/getCurrentAiChatPageThreadId';

jest.mock('~/config', () => ({
  BASE_PATH: '/crm',
}));

const THREAD_ID = '6f0ea0a8-0d6f-4b0f-9c54-0d2b8a1f4c11';
const NEW_AI_CHAT_THREAD_ID = '3a4b5c6d-7e8f-4a1b-9c2d-3e4f5a6b7c8d';

describe('getCurrentAiChatPageThreadId', () => {
  const store = createStore();

  beforeEach(() => {
    store.set(newAiChatThreadIdState.atom, NEW_AI_CHAT_THREAD_ID);
  });

  it.each([
    [`/crm/chat/${THREAD_ID}`, THREAD_ID],
    [`/crm/inbox/${THREAD_ID}`, THREAD_ID],
    ['/crm/chat', NEW_AI_CHAT_THREAD_ID],
    ['/crm/objects/companies', null],
  ])('reads %s under a sub-path as %s', (pathname, expectedThreadId) => {
    window.history.pushState(null, '', pathname);

    expect(getCurrentAiChatPageThreadId(store)).toBe(expectedThreadId);
  });
});
