import StatusPage from "../models/StatusPage.js";
import StatusIncident from "../models/StatusIncident.js";
import StatusMaintenance from "../models/StatusMaintenance.js";
import StatusSubscriber from "../models/StatusSubscriber.js";
import StatusDelivery from "../models/StatusDelivery.js";

export async function deleteStatusPagesForOwner(ownerId) {
  const pages = await StatusPage.find({ owner: ownerId }).select("_id").lean();
  const pageIds = pages.map((page) => page._id);
  if (!pageIds.length) return;
  await Promise.all([
    StatusDelivery.deleteMany({ statusPage: { $in: pageIds } }),
    StatusSubscriber.deleteMany({ statusPage: { $in: pageIds } }),
    StatusIncident.deleteMany({ statusPage: { $in: pageIds } }),
    StatusMaintenance.deleteMany({ statusPage: { $in: pageIds } }),
    StatusPage.deleteMany({ _id: { $in: pageIds } }),
  ]);
}

export async function deleteStatusPageData(pageId) {
  await Promise.all([
    StatusDelivery.deleteMany({ statusPage: pageId }),
    StatusSubscriber.deleteMany({ statusPage: pageId }),
    StatusIncident.deleteMany({ statusPage: pageId }),
    StatusMaintenance.deleteMany({ statusPage: pageId }),
    StatusPage.deleteOne({ _id: pageId }),
  ]);
}
