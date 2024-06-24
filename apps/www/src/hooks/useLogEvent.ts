import { logEvent } from 'firebase/analytics';
import { analytics } from '@/utils/firebase';

type EventType =
  | 'login'
  | 'reply'
  | 'register'
  | 'copy_link'
  | 'send_again'
  | 'save_image'
  | 'share_image'
  | 'send_message'
  | 'open_message'
  | 'edit_username'
  | 'delete_message'
  | 'delete_account'
  | 'edit_user_message';

export const useLogEvent = () => {
  const triggerEvent = <T>(event: EventType, eventParams?: T) => {
    if (process.env.NODE_ENV === 'production') {
      logEvent(analytics, event as string, eventParams);
    }
  };

  return triggerEvent;
};
