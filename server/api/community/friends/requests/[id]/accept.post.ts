import { acceptFriendRequest } from "~/server/services/community";
import { runApi } from "~/server/utils/api";
import { requireUserId } from "~/server/utils/session";

export default defineEventHandler((event) => runApi(async () =>
  acceptFriendRequest(requireUserId(event), event.context.params?.id)
));

