import React from 'react';
import LiveKshetraNative from './LiveKshetraNative';

export default function LiveKshetraFrame({
  meetingCode,
  podTitle = 'Learning Pod Video Conference',
  user,
  isHost = false,
  onClose,
  initialMessages = [],
  sharedWsRef = null,
  sharedClientId = null,
  wsHandlersRef = null,
  pendingMessagesRef = null
}) {
  return (
    <LiveKshetraNative
      meetingCode={meetingCode}
      podTitle={podTitle}
      user={user}
      isHost={isHost}
      onClose={onClose}
      initialMessages={initialMessages}
      sharedWsRef={sharedWsRef}
      sharedClientId={sharedClientId}
      wsHandlersRef={wsHandlersRef}
      pendingMessagesRef={pendingMessagesRef}
    />
  );
}
