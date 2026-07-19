import { rejectFriendRequest } from "~/server/services/community";
import { runApi } from "~/server/utils/api";
import { requireUserId } from "~/server/utils/session";

export default defineEventHandler((event) => runApi(async () =>
  rejectFriendRequest(requireUserId(event), event.context.params?.id)
));

