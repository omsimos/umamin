import { callAction } from "@/lib/api";

// Group membership mutations not already exposed in lib/actions.ts. Same
// `Out | { error }` envelope the apps/www call sites narrow on.

export function respondToInviteAction(input: {
  groupId: string;
  accept: boolean;
}) {
  return callAction<{ success: true; accepted: boolean }>(
    "respondToInviteAction",
    input,
  );
}

export function requestToJoinGroupAction(input: { groupId: string }) {
  return callAction<{
    success: true;
    joined?: boolean;
    requested?: boolean;
    equipped?: boolean;
  }>("requestToJoinGroupAction", input);
}

export function respondToJoinRequestAction(input: {
  groupId: string;
  userId: string;
  accept: boolean;
}) {
  return callAction<{ success: true; approved: boolean }>(
    "respondToJoinRequestAction",
    input,
  );
}

export function cancelJoinRequestAction(input: { groupId: string }) {
  return callAction<{ success: true }>("cancelJoinRequestAction", input);
}

export function equipGroupBadgeAction(input: { groupId: string | null }) {
  return callAction<{ success: true; equippedGroupId: string | null }>(
    "equipGroupBadgeAction",
    input,
  );
}

export function leaveGroupAction(input: { groupId: string }) {
  return callAction<{ success: true }>("leaveGroupAction", input);
}

export function kickGroupMemberAction(input: {
  groupId: string;
  userId: string;
}) {
  return callAction<{ success: true }>("kickGroupMemberAction", input);
}

export function inviteToGroupAction(input: {
  groupId: string;
  username: string;
}) {
  return callAction<{ success: true; accepted?: boolean }>(
    "inviteToGroupAction",
    input,
  );
}

export function deleteGroupAction(input: { groupId: string }) {
  return callAction<{ success: true }>("deleteGroupAction", input);
}
