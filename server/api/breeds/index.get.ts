import { listBreeds } from "~/server/services/breedService";
import { runApi } from "~/server/utils/api";
import { requireUserId } from "~/server/utils/session";

export default defineEventHandler((event) => runApi(async () => {
  requireUserId(event);
  const query = getQuery(event);
  return listBreeds({
    search: query.search,
    type: query.type,
    active: query.active,
    sort: query.sort,
    limit: query.limit,
    offset: query.offset
  });
}));

