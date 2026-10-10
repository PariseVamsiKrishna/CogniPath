export const getIceServers = () => {
  const turnUrl = import.meta.env.VITE_TURN_URL;
  const turnUsername = import.meta.env.VITE_TURN_USERNAME;
  const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL;

  const stunServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' }
  ];

  if (turnUrl && turnUsername && turnCredential) {
    return [
      ...stunServers,
      {
        urls: turnUrl,
        username: turnUsername,
        credential: turnCredential
      }
    ];
  } else {
    console.warn('[WebRTC] No TURN server configured (VITE_TURN_URL / VITE_TURN_USERNAME / VITE_TURN_CREDENTIAL missing). Peers behind symmetric/strict NAT firewalls may fail to establish direct P2P connections.');
    return stunServers;
  }
};
