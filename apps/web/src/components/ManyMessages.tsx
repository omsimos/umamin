import { getManyMessages } from '@/api';
import { useUser } from '@/hooks';
import { useQuery } from '@tanstack/react-query';
import { toPng } from 'html-to-image';
import { useSession } from 'next-auth/react';
import React, { useCallback, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { InboxTabContainer, SeenCard } from './InboxTabs';

export const ManyMessages = () => {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [pageNo, setPageNo] = useState(1);
  const [loading, setLoading] = useState(false);

  const { data: session } = useSession();
  const { data: user } = useUser('inbox_user', session?.user?.id ?? '', 'id');

  const [cursorId, setCursorId] = useState('');
  const queryArgs = { userId: user?.id ?? '', cursorId };

  const {
    data: seenData,
    isLoading,
    refetch: refetchSeen,
  } = useQuery(
    ['many_messages', { userId: user?.id ?? '', cursorId }],
    () => getManyMessages(queryArgs),
    {
      select: (data) => data.getManyMessages,
    }
  );

  const saveImage = useCallback(
    (id: string) => {
      if (cardRef.current === null) {
        return;
      }

      setLoading(true);

      toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 5,
      })
        .then((dataUrl) => {
          const link = document.createElement('a');
          link.download = `${user?.username}_${id}.png`;
          link.href = dataUrl;
          link.click();
          setLoading(false);
        })
        .catch((err) => {
          toast.error(err);
          setLoading(false);
        });
    },
    [cardRef, user?.username]
  );

  const handleDownloadAll = useCallback(() => {
    seenData?.forEach((m) => {
      cardRef.current = document.getElementById(m.id) as HTMLDivElement;

      saveImage(m.id);
    });
  }, [cardRef, seenData, saveImage]);

  return (
    <InboxTabContainer
      isMany
      pageNo={pageNo}
      cursorId={cursorId}
      messages={seenData}
      isLoading={isLoading}
      setPageNo={setPageNo}
      setCursorId={setCursorId}
    >
      {loading ? (
        <p className='text-center'>Downloading...</p>
      ) : (
        <button
          type='button'
          disabled={loading}
          onClick={handleDownloadAll}
          className='underline'
        >
          Save All
        </button>
      )}
      <div className='grid grid-cols-3 max-w-screen-2xl mx-auto w-full'>
        {seenData?.map((m) => {
          return <SeenCard key={m.id} refetch={refetchSeen} message={m} />;
        })}
      </div>
    </InboxTabContainer>
  );
};
