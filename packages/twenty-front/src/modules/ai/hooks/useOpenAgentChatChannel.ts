import { useStore } from 'jotai';
import { useCallback } from 'react';
import { AppPath } from 'twenty-shared/types';
import { getAppPath } from 'twenty-shared/utils';

import { agentChatChannelViewState } from '@/ai/states/agentChatChannelViewState';
import { type AgentChatChannelView } from '@/ai/types/AgentChatChannelView';
import { useNavigateApp } from '~/hooks/useNavigateApp';
import {
  AgentChatChannelAssignmentFilter,
  AgentChatChannelThreadStatus,
} from '~/generated-metadata/graphql';
import { isMatchingPathname } from '~/utils/isMatchingPathname';
import { getAppPathname } from '~/utils/getAppPathname';

export const useOpenAgentChatChannel = () => {
  const store = useStore();
  const navigate = useNavigateApp();

  const openAgentChatChannel = useCallback(
    ({
      channelId,
      channelStatus = AgentChatChannelThreadStatus.OPEN,
      assignment = AgentChatChannelAssignmentFilter.ANY,
    }: Pick<AgentChatChannelView, 'channelId'> &
      Partial<Pick<AgentChatChannelView, 'channelStatus' | 'assignment'>>) => {
      store.set(agentChatChannelViewState.atom, {
        channelId,
        channelStatus,
        assignment,
      });
      navigate(AppPath.AiChatInbox, { threadId: null }, undefined, {
        replace: isMatchingPathname(
          getAppPathname(),
          getAppPath(AppPath.AiChatInbox, { threadId: null }),
        ),
      });
    },
    [navigate, store],
  );

  return { openAgentChatChannel };
};
