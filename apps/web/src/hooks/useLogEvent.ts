import { logEvent } from 'firebase/analytics';
import { analytics } from '@/utils/firebase';

type EventType =
  | 'login'
  | 'reply'
  | 'register'
  | 'open_message'
  | 'save_image'
  | 'share_image'
  | 'copy_link'
  | 'send_message'
  | 'send_again';

export const useLogEvent = () => {
  const triggerEvent = <T>(event: EventType, eventParams?: T) => {
    if (process.env.NODE_ENV === 'production') {
      logEvent(analytics, event as string, eventParams);
    }
  };

  return triggerEvent;
};
