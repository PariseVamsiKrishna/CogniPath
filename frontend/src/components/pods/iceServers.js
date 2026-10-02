export const getIceServers = () => {
  const turnUrl = import.meta.env.VITE_TURN_URL;
  const turnUsername = import.meta.env.VITE_TURN_USERNAME;
  const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL;

  const stunServer = {
    urls: 'stun:stun.l.google.com:19302'
  };

  if (turnUrl && turnUsername && turnCredential) {
    return [
      stunServer,
      {
        urls: turnUrl,
        username: turnUsername,
        credential: turnCredential
      }
    ];
  } else {
    console.warn('[WebRTC] No TURN server configured (missing VITE_TURN_URL/USERNAME/CREDENTIAL). Falling back to Google STUN only. This may fail on strict NATs.');
    return [stunServer];
  }
};
