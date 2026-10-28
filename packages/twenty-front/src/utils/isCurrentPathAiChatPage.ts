import { isAiChatPath } from '~/utils/isAiChatPath';
import { getAppPathname } from '~/utils/getAppPathname';

export const isCurrentPathAiChatPage = () => isAiChatPath(getAppPathname());
