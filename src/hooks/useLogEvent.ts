import { logEvent } from 'firebase/analytics';
import { analytics } from '@/firebase';

export const useLogEvent = () => {
  const triggerEvent = <T>(event: string, eventParams?: T) => {
    if (process.env.NODE_ENV === 'production') {
      logEvent(analytics, event, eventParams);
    }
  };

  return triggerEvent;
};
