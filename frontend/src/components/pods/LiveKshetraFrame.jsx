import React from 'react';
import LiveKshetraNative from './LiveKshetraNative';

/**
 * LiveKshetraFrame - Native Live Kshetra Conference Component.
 * Fully embedded inside CogniPath Learning Pods with zero external dependencies.
 */
export default function LiveKshetraFrame({
  meetingCode,
  podTitle = 'Learning Pod Video Conference',
  user,
  isHost = false,
  onClose,
  initialMessages = []
}) {
  return (
    <LiveKshetraNative
      meetingCode={meetingCode}
      podTitle={podTitle}
      user={user}
      isHost={isHost}
      onClose={onClose}
      initialMessages={initialMessages}
    />
  );
}
