/**
 * podProtocol.js - Normalization layer for Learning Pod WebRTC & Socket signaling schema
 */

export const normalizeSignalMessage = (data) => {
  if (!data || typeof data !== 'object') return data;

  return {
    ...data,
    audio_on: data.audio_on !== undefined ? data.audio_on : data.mic_on,
    video_on: data.video_on !== undefined ? data.video_on : data.camera_on,
    target_client_id: data.target_client_id || data.targetUserId,
    sender_client_id: data.sender_client_id || data.senderId || data.from_client,
  };
};

export const createSignalPayload = (type, payload = {}) => {
  return {
    type,
    timestamp: Date.now(),
    audio_on: payload.audio_on ?? payload.mic_on,
    video_on: payload.video_on ?? payload.camera_on,
    target_client_id: payload.target_client_id ?? payload.targetUserId,
    ...payload
  };
};
