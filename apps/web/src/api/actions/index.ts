import { Hono } from "hono";
import type { AppBindings } from "../../server-lib/context";
import {
  deleteAccountHandler,
  loginHandler,
  logoutHandler,
  signupHandler,
} from "./auth";
import {
  cancelJoinRequestHandler,
  createGroupHandler,
  deleteGroupHandler,
  equipGroupBadgeHandler,
  inviteToGroupHandler,
  kickGroupMemberHandler,
  leaveGroupHandler,
  requestToJoinGroupHandler,
  respondToInviteHandler,
  respondToJoinRequestHandler,
  updateGroupHandler,
} from "./group";
import {
  deleteGroupMessageHandler,
  markGroupChatReadHandler,
  reactToGroupMessageHandler,
  sendGroupMessageHandler,
} from "./group-chat";
import {
  createReplyHandler,
  deleteMessageHandler,
  markThreadReadHandler,
  openMessageHandler,
  sendMessageHandler,
} from "./message";
import {
  allowIpHandler,
  banUserHandler,
  denyIpHandler,
  unbanUserHandler,
} from "./moderation";
import {
  addNoteReactionHandler,
  clearNoteHandler,
  createNoteHandler,
  getCurrentNoteHandler,
  removeNoteHandler,
  removeNoteReactionHandler,
} from "./note";
import { markNotificationsSeenHandler } from "./notification";
import {
  addCommentLikeHandler,
  addLikeHandler,
  addRepostHandler,
  createCommentHandler,
  createPostHandler,
  deleteCommentHandler,
  deletePostHandler,
  getPostHandler,
  getPostPublicHandler,
  pinPostHandler,
  removeCommentLikeHandler,
  removeLikeHandler,
  removeRepostHandler,
  unpinPostHandler,
  votePollHandler,
} from "./post";
import {
  registerPushSubscriptionHandler,
  unregisterPushSubscriptionHandler,
} from "./push";
import {
  presignAvatarUploadHandler,
  presignBannerUploadHandler,
  presignPostImagesHandler,
} from "./upload";
import {
  blockUserHandler,
  followUserHandler,
  generalSettingsHandler,
  getCurrentUserHandler,
  getUserProfileHandler,
  removeProfileBannerHandler,
  toggleDisplayPictureHandler,
  toggleQuietModeHandler,
  unblockUserHandler,
  unfollowUserHandler,
  updateAvatarHandler,
  updateBlockedWordsHandler,
  updatePasswordHandler,
  updateProfileBannerHandler,
  updateProfileMusicHandler,
  updateProfilePhotoHandler,
} from "./user";

/**
 * Every apps/www mutation (+ the plain reads embedded in the action files) as a
 * single flat Hono chain under `/actions/<actionName>`.
 *
 * Route-naming scheme (chosen for hc<ActionsType> ergonomics + contract
 * stability — this IS the future mobile contract): one flat namespace, keyed by
 * the EXACT apps/www action export name (globally unique). Flat camelCase
 * segments give the cleanest typed-client property access
 * (`client.actions.createPostAction.$post()`) — no bracket/dot escaping — and a
 * 1:1 map from every old `import { fooAction }` call site to `callAction("fooAction", …)`.
 *
 * Mounting: this app defines paths at `/actions/...`; the orchestrator mounts it
 * under `/api`, so the live path is `/api/actions/<name>` and the hc client is
 * created with base `/api` (see src/lib/api.ts). Kept as ONE chained expression
 * so the RPC type flows through to ActionsType.
 */
export const actionsApp = new Hono<AppBindings>()
  // auth (unwrapped, redirect-shaped)
  .post("/actions/login", loginHandler)
  .post("/actions/signup", signupHandler)
  .post("/actions/logout", logoutHandler)
  .post("/actions/deleteAccount", deleteAccountHandler)
  // post
  .post("/actions/getPostAction", getPostHandler)
  .post("/actions/getPostPublicAction", getPostPublicHandler)
  .post("/actions/createPostAction", createPostHandler)
  .post("/actions/deletePostAction", deletePostHandler)
  .post("/actions/createCommentAction", createCommentHandler)
  .post("/actions/deleteCommentAction", deleteCommentHandler)
  .post("/actions/addLikeAction", addLikeHandler)
  .post("/actions/votePollAction", votePollHandler)
  .post("/actions/removeLikeAction", removeLikeHandler)
  .post("/actions/addCommentLikeAction", addCommentLikeHandler)
  .post("/actions/removeCommentLikeAction", removeCommentLikeHandler)
  .post("/actions/addRepostAction", addRepostHandler)
  .post("/actions/removeRepostAction", removeRepostHandler)
  .post("/actions/pinPostAction", pinPostHandler)
  .post("/actions/unpinPostAction", unpinPostHandler)
  // message
  .post("/actions/deleteMessageAction", deleteMessageHandler)
  .post("/actions/openMessageAction", openMessageHandler)
  .post("/actions/createReplyAction", createReplyHandler)
  .post("/actions/markThreadReadAction", markThreadReadHandler)
  .post("/actions/sendMessageAction", sendMessageHandler)
  // note
  .post("/actions/createNoteAction", createNoteHandler)
  .post("/actions/getCurrentNoteAction", getCurrentNoteHandler)
  .post("/actions/clearNoteAction", clearNoteHandler)
  .post("/actions/removeNoteAction", removeNoteHandler)
  .post("/actions/addNoteReactionAction", addNoteReactionHandler)
  .post("/actions/removeNoteReactionAction", removeNoteReactionHandler)
  // notification
  .post("/actions/markNotificationsSeenAction", markNotificationsSeenHandler)
  // user
  .post("/actions/getCurrentUserAction", getCurrentUserHandler)
  .post("/actions/getUserProfileAction", getUserProfileHandler)
  .post("/actions/generalSettingsAction", generalSettingsHandler)
  .post("/actions/updateProfileMusicAction", updateProfileMusicHandler)
  .post("/actions/updatePasswordAction", updatePasswordHandler)
  .post("/actions/followUserAction", followUserHandler)
  .post("/actions/unfollowUserAction", unfollowUserHandler)
  .post("/actions/blockUserAction", blockUserHandler)
  .post("/actions/unblockUserAction", unblockUserHandler)
  .post("/actions/toggleDisplayPictureAction", toggleDisplayPictureHandler)
  .post("/actions/toggleQuietModeAction", toggleQuietModeHandler)
  .post("/actions/updateBlockedWordsAction", updateBlockedWordsHandler)
  .post("/actions/updateAvatarAction", updateAvatarHandler)
  .post("/actions/updateProfilePhotoAction", updateProfilePhotoHandler)
  .post("/actions/updateProfileBannerAction", updateProfileBannerHandler)
  .post("/actions/removeProfileBannerAction", removeProfileBannerHandler)
  // group
  .post("/actions/createGroupAction", createGroupHandler)
  .post("/actions/inviteToGroupAction", inviteToGroupHandler)
  .post("/actions/requestToJoinGroupAction", requestToJoinGroupHandler)
  .post("/actions/respondToInviteAction", respondToInviteHandler)
  .post("/actions/respondToJoinRequestAction", respondToJoinRequestHandler)
  .post("/actions/cancelJoinRequestAction", cancelJoinRequestHandler)
  .post("/actions/equipGroupBadgeAction", equipGroupBadgeHandler)
  .post("/actions/leaveGroupAction", leaveGroupHandler)
  .post("/actions/kickGroupMemberAction", kickGroupMemberHandler)
  .post("/actions/updateGroupAction", updateGroupHandler)
  .post("/actions/deleteGroupAction", deleteGroupHandler)
  // group chat
  .post("/actions/sendGroupMessageAction", sendGroupMessageHandler)
  .post("/actions/markGroupChatReadAction", markGroupChatReadHandler)
  .post("/actions/deleteGroupMessageAction", deleteGroupMessageHandler)
  .post("/actions/reactToGroupMessageAction", reactToGroupMessageHandler)
  // push
  .post(
    "/actions/registerPushSubscriptionAction",
    registerPushSubscriptionHandler,
  )
  .post(
    "/actions/unregisterPushSubscriptionAction",
    unregisterPushSubscriptionHandler,
  )
  // upload
  .post("/actions/presignPostImagesAction", presignPostImagesHandler)
  .post("/actions/presignAvatarUploadAction", presignAvatarUploadHandler)
  .post("/actions/presignBannerUploadAction", presignBannerUploadHandler)
  // moderation
  .post("/actions/banUserAction", banUserHandler)
  .post("/actions/unbanUserAction", unbanUserHandler)
  .post("/actions/denyIpAction", denyIpHandler)
  .post("/actions/allowIpAction", allowIpHandler);

export type ActionsType = typeof actionsApp;
