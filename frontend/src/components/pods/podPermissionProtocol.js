/**
 * Real-Time Signaling & Permission Protocol for Learning Pods
 * Defines standard message types and payload builders for Remote Mute
 * and Privacy-Compliant Unmute Handshake.
 */

export const POD_PERM_TYPES = {
  // Host -> Backend -> Participant
  FORCE_MUTE_PARTICIPANT: 'FORCE_MUTE_PARTICIPANT',
  
  // Participant -> Backend -> Host
  REQUEST_UNMUTE_PERMISSION: 'REQUEST_UNMUTE_PERMISSION',
  UNMUTE_PERMISSION_REQUESTED: 'UNMUTE_PERMISSION_REQUESTED',
  
  // Host -> Backend -> Participant
  GRANT_UNMUTE_PERMISSION: 'GRANT_UNMUTE_PERMISSION',
  EVENT_UNMUTE_PERMISSION_GRANTED: 'EVENT_UNMUTE_PERMISSION_GRANTED',
  
  // Host -> Backend -> Participant
  DENY_UNMUTE_PERMISSION: 'DENY_UNMUTE_PERMISSION',
  EVENT_UNMUTE_PERMISSION_DENIED: 'EVENT_UNMUTE_PERMISSION_DENIED',
  
  // Broadcasts
  HOST_MUTED_PEER: 'HOST_MUTED_PEER',
  MEDIA_STATE_CHANGE: 'MEDIA_STATE_CHANGE'
};

/**
 * Creates payload for host-initiated force mute
 */
export function createForceMutePayload(targetUserId, hostId, reason = 'Muted by host') {
  return {
    type: POD_PERM_TYPES.FORCE_MUTE_PARTICIPANT,
    targetUserId,
    target_client_id: targetUserId,
    hostId,
    reason,
    timestamp: new Date().toISOString()
  };
}

/**
 * Creates payload for participant requesting permission to unmute
 */
export function createRequestUnmutePayload(senderId, senderName) {
  return {
    type: POD_PERM_TYPES.REQUEST_UNMUTE_PERMISSION,
    senderId,
    sender_client_id: senderId,
    senderName,
    sender_name: senderName,
    timestamp: new Date().toISOString()
  };
}

/**
 * Creates payload for host granting permission / inviting participant to unmute
 */
export function createGrantUnmutePayload(targetUserId, hostId, hostName = 'Host') {
  return {
    type: POD_PERM_TYPES.GRANT_UNMUTE_PERMISSION,
    targetUserId,
    target_client_id: targetUserId,
    hostId,
    hostName,
    timestamp: new Date().toISOString()
  };
}

/**
 * Creates payload for host denying unmute permission request
 */
export function createDenyUnmutePayload(targetUserId, reason = 'Please wait for the Q&A section') {
  return {
    type: POD_PERM_TYPES.DENY_UNMUTE_PERMISSION,
    targetUserId,
    target_client_id: targetUserId,
    reason,
    timestamp: new Date().toISOString()
  };
}
