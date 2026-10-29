import { act, renderHook } from '@testing-library/react';
import { AppPath } from 'twenty-shared/types';

import { useOpenAgentChatChannel } from '@/ai/hooks/useOpenAgentChatChannel';

const navigateAppMock = jest.fn();

jest.mock('~/hooks/useNavigateApp', () => ({
  useNavigateApp: () => navigateAppMock,
}));

jest.mock('~/config', () => ({
  BASE_PATH: '/crm',
}));

const CHANNEL_ID = '11111111-1111-4111-8111-111111111111';

describe('useOpenAgentChatChannel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('replaces the inbox entry when already on the inbox under a sub-path', () => {
    window.history.pushState(null, '', '/crm/inbox');

    const { result } = renderHook(() => useOpenAgentChatChannel());

    act(() => {
      result.current.openAgentChatChannel({ channelId: CHANNEL_ID });
    });

    expect(navigateAppMock).toHaveBeenCalledWith(
      AppPath.AiChatInbox,
      { threadId: null },
      undefined,
      { replace: true },
    );
  });

  it('pushes a new entry when coming from another page', () => {
    window.history.pushState(null, '', '/crm/objects/people');

    const { result } = renderHook(() => useOpenAgentChatChannel());

    act(() => {
      result.current.openAgentChatChannel({ channelId: CHANNEL_ID });
    });

    expect(navigateAppMock).toHaveBeenCalledWith(
      AppPath.AiChatInbox,
      { threadId: null },
      undefined,
      { replace: false },
    );
  });
});
