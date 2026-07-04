import type { PushSubscriptionRow, PushPayload } from "./types";
import { webPushSender } from "./webPush";
import { fcmSender } from "./fcm";

export type { PushPayload, PushSubscriptionRow } from "./types";
export { PushSendError } from "./types";

export async function sendPush(sub: PushSubscriptionRow, payload: PushPayload): Promise<void> {
  const sender = sub.platform === "web" ? webPushSender : fcmSender;
  await sender.send(sub, payload);
}
