import * as admin from "firebase-admin";
import {FieldPath, FieldValue, Filter, Timestamp} from "firebase-admin/firestore";
import {HttpsError, onCall} from "firebase-functions/v2/https";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {randomUUID} from "node:crypto";
import {
  bookingCollections,
  ownerFields,
  ownsBooking,
  id,
  text,
  fingerprint,
  searchTerms,
  words,
  extractLinks,
  validatedFile,
} from "./customerChatCore";
import {held, cutoff} from "./retentionPolicy";

const db = () => admin.firestore();
const conversations = () => db().collection("customerSupportV2");
const messages = () => db().collection("customerSupportMessagesV2");
const attachments = () => db().collection("customerSupportAttachmentsV2");
type Actor = {uid: string; administrator: boolean; name: string};
type Data = Record<string, any>;

async function actor(request: any): Promise<Actor> {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to use support chat.");
  const uid = id(request.auth.uid, "user ID");
  const [account, profile] = await Promise.all([
    admin.auth().getUser(uid),
    db().doc(`users/${uid}`).get(),
  ]);
  const authTime = Number(request.auth.token.auth_time) * 1000;
  const validAfter = Date.parse(account.tokensValidAfterTime || "1970-01-01");
  if (
    account.disabled ||
    profile.data()?.isSuspended === true ||
    !Number.isFinite(authTime) ||
    authTime <= 0 ||
    !Number.isFinite(validAfter) ||
    authTime < validAfter
  )
    throw new HttpsError("permission-denied", "Account inactive. Sign in again.");
  return {
    uid,
    administrator:
      account.customClaims?.admin === true || ["Admin", "admin"].includes(profile.data()?.role),
    name: String(profile.data()?.displayName || account.displayName || "Customer").slice(0, 120),
  };
}
function customerId(a: Actor, value: unknown): string {
  const uid = value === undefined ? a.uid : id(value, "customer ID");
  if (!a.administrator && uid !== a.uid)
    throw new HttpsError("permission-denied", "You can only access your own support chat.");
  return uid;
}
function adminOnly(a: Actor) {
  if (!a.administrator) throw new HttpsError("permission-denied", "Admin access required.");
}
async function rateLimit(a: Actor, upload = false) {
  const ref = db().doc(`customerSupportRateLimits/${a.uid}_${upload ? "upload" : "request"}`);
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const previous = snap.data() || {};
    const now = Date.now();
    const count = Number(previous.until) > now ? Number(previous.count || 0) + 1 : 1;
    if (count > (upload ? 10 : 180))
      throw new HttpsError("resource-exhausted", "Too many requests. Retry in one minute.");
    tx.set(ref, {count, until: Number(previous.until) > now ? previous.until : now + 60000});
  });
}
function serialize(snap: admin.firestore.DocumentSnapshot): Data {
  const convert = (v: any): any => {
    if (v instanceof Timestamp) return v.toMillis();
    if (Array.isArray(v)) return v.map(convert);
    if (v && typeof v === "object")
      return Object.fromEntries(
        Object.entries(v)
          .filter(
            ([k]) => !["searchTerms", "fingerprint", "storagePath", "legacyIndex"].includes(k),
          )
          .map(([k, value]) => [k, convert(value)]),
      );
    return v;
  };
  return {id: snap.id, ...convert(snap.data() || {})};
}
async function booking(uid: string, value: any): Promise<Data | null> {
  if (value === undefined || value === null) return null;
  const service = text(value.service, 30);
  const collection = bookingCollections[service];
  if (!collection) throw new HttpsError("invalid-argument", "Select a supported booking service.");
  const bookingId = id(value.id, "booking ID");
  const snap = await db().collection(collection).doc(bookingId).get();
  if (!snap.exists || !ownsBooking(snap.data() || {}, uid))
    throw new HttpsError(
      "permission-denied",
      "This booking is not available in this customer's chat.",
    );
  return bookingCard(service, snap);
}
function bookingCard(service: string, snap: admin.firestore.DocumentSnapshot): Data {
  const data = snap.data() || {};
  const date =
    data.checkInDate ||
    data.checkIn ||
    data.arrivalDate ||
    data.pickUpDate ||
    data.pickUpTime ||
    data.startDate ||
    "";
  return {
    id: snap.id,
    service,
    reference: String(data.bookingReference || data.bookingId || snap.id).slice(0, 200),
    title: String(
      data.hotelName ||
        data.packageName ||
        data.vehicleName ||
        data.carName ||
        data.title ||
        `${service} booking`,
    ).slice(0, 200),
    date: date instanceof Timestamp ? date.toDate().toISOString() : String(date).slice(0, 80),
    status: String(data.status || data.bookingStatus || "").slice(0, 60),
  };
}
/** Single callable API shared by the admin portal and mobile clients. */
export const customerChat = onCall(
  {region: "asia-east2", memory: "512MiB", concurrency: 4, maxInstances: 10, timeoutSeconds: 60},
  async (request) => {
    request.rawRequest?.res?.setHeader("Cache-Control", "private, no-store");
    const a = await actor(request);
    const body: Data = request.data || {};
    const action = text(body.action, 40);
    await rateLimit(a, action === "upload");
    const uid = customerId(a, body.customerId);
    const conversation = conversations().doc(uid);

    if (action === "open") {
      if (a.administrator && uid === a.uid)
        throw new HttpsError("invalid-argument", "Select a customer first.");
      const profile = a.administrator ? (await db().doc(`users/${uid}`).get()).data() : null;
      await db().runTransaction(async (tx) => {
        const current = await tx.get(conversation);
        if (!current.exists)
          tx.create(conversation, {
            customerId: uid,
            customerName: String(profile?.displayName || (a.administrator ? "Customer" : a.name)),
            status: "open",
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            lastMessage: "",
            customerUnread: 0,
            adminUnread: 0,
          });
      });
      return {conversation: serialize(await conversation.get())};
    }
    if (action === "inbox") {
      adminOnly(a);
      let query: admin.firestore.Query = conversations()
        .orderBy("updatedAt", "desc")
        .orderBy(FieldPath.documentId(), "desc");
      if (body.cursor) {
        const last = await conversations().doc(id(body.cursor)).get();
        if (!last.exists) throw new HttpsError("invalid-argument", "Invalid inbox cursor.");
        query = query.startAfter(last);
      }
      const count = Math.min(50, Math.max(1, Number(body.limit) || 30));
      const snap = await query.limit(count + 1).get();
      return {
        items: snap.docs.slice(0, count).map(serialize),
        nextCursor: snap.size > count ? snap.docs[count - 1].id : null,
      };
    }
    if (action === "bookings") {
      const service = text(body.service || "hotel", 30);
      const collection = bookingCollections[service];
      if (!collection) throw new HttpsError("invalid-argument", "Unsupported booking service.");
      let query: admin.firestore.Query = db()
        .collection(collection)
        .where(Filter.or(...ownerFields.map((field) => Filter.where(field, "==", uid))))
        .orderBy(FieldPath.documentId());
      if (body.cursor) query = query.startAfter(id(body.cursor));
      const snap = await query.limit(31).get();
      return {
        items: snap.docs
          .slice(0, 30)
          .filter((doc) => ownsBooking(doc.data(), uid))
          .map((doc) => bookingCard(service, doc)),
        nextCursor: snap.size > 30 ? snap.docs[29].id : null,
      };
    }
    if (action === "booking") return {booking: await booking(uid, body.booking)};
    if (action === "messages" || action === "search" || action === "shared") {
      const global = action === "search" && body.allCustomers === true;
      if (global) adminOnly(a);
      let query: admin.firestore.Query = messages();
      if (!global) query = query.where("customerId", "==", uid);
      query = query.where("deleted", "==", false);
      const terms = action === "search" ? words(text(body.query, 100)) : [];
      if (
        action === "search" &&
        (!terms.length || terms.some((t) => t.length < 2 || t.length > 48))
      )
        throw new HttpsError("invalid-argument", "Use search words of 2–48 characters.");
      if (terms.length) query = query.where("searchTerms", "array-contains", terms[0]);
      if (action === "shared") {
        if (!["media", "documents", "links"].includes(body.category))
          throw new HttpsError("invalid-argument", "Select media, documents or links.");
        query = query.where("categories", "array-contains", body.category);
      }
      for (const [key, comparison] of [
        ["from", ">="],
        ["to", "<="],
      ] as const) {
        if (body[key] !== undefined) {
          const timestamp = Number(body[key]);
          if (!Number.isFinite(timestamp) || timestamp < 0)
            throw new HttpsError("invalid-argument", "Date filters must be Unix milliseconds.");
          query = query.where("createdAt", comparison, Timestamp.fromMillis(timestamp));
        }
      }
      query = query.orderBy("createdAt", "desc").orderBy(FieldPath.documentId(), "desc");
      if (body.cursor) {
        const cursor = await messages().doc(id(body.cursor)).get();
        if (!cursor.exists || (!global && cursor.data()?.customerId !== uid))
          throw new HttpsError("invalid-argument", "Invalid message cursor.");
        query = query.startAfter(cursor);
      }
      const count = Math.min(50, Math.max(1, Number(body.limit) || 30));
      const snap = await query.limit(count + 1).get();
      const docs = snap.docs.slice(0, count);
      return {
        items: docs
          .filter(
            (doc) =>
              terms.every((term) => (doc.data().searchTerms || []).includes(term)) &&
              (!body.senderRole || doc.data().senderRole === body.senderRole) &&
              (!body.contentType || doc.data().attachment?.contentType === body.contentType),
          )
          .map(serialize),
        nextCursor: snap.size > count ? docs[docs.length - 1].id : null,
      };
    }
    if (action === "send") {
      const requestId = id(body.requestId, "request ID");
      const messageText = text(body.text);
      const selectedBooking = await booking(uid, body.booking);
      const attachmentId = body.attachmentId ? id(body.attachmentId) : null;
      if (!messageText && !selectedBooking && !attachmentId)
        throw new HttpsError("invalid-argument", "Add a message, booking or attachment.");
      const replyId = body.replyTo ? id(body.replyTo) : null;
      const ref = messages().doc(fingerprint([uid, a.uid, requestId]));
      const digest = fingerprint([messageText, body.booking || null, attachmentId, replyId]);
      const links = extractLinks(messageText);
      await db().runTransaction(async (tx) => {
        const [previous, thread, attachment, reply] = await Promise.all([
          tx.get(ref),
          tx.get(conversation),
          attachmentId ? tx.get(attachments().doc(attachmentId)) : null,
          replyId ? tx.get(messages().doc(replyId)) : null,
        ]);
        if (previous.exists) {
          if (previous.data()?.fingerprint !== digest)
            throw new HttpsError(
              "already-exists",
              "Request ID was already used for different content.",
            );
          return;
        }
        if (!thread.exists)
          throw new HttpsError("failed-precondition", "Open the conversation before sending.");
        if (
          attachmentId &&
          (!attachment?.exists ||
            attachment.data()?.customerId !== uid ||
            attachment.data()?.uploaderId !== a.uid ||
            attachment.data()?.messageId ||
            attachment.data()?.deleting ||
            attachment.data()?.expiresAt.toMillis() < Date.now())
        )
          throw new HttpsError("permission-denied", "Attachment unavailable. Upload again.");
        if (
          replyId &&
          (!reply?.exists || reply.data()?.customerId !== uid || reply.data()?.deleted)
        )
          throw new HttpsError("invalid-argument", "Reply target unavailable.");
        const file = attachment?.data();
        const categories = [
          ...new Set([...(file ? [file.category] : []), ...(links.length ? ["links"] : [])]),
        ];
        const value = {
          customerId: uid,
          senderId: a.uid,
          senderRole: a.administrator ? "admin" : "customer",
          text: messageText,
          booking: selectedBooking,
          replyTo: replyId,
          attachment: file
            ? {
                id: attachmentId,
                name: file.name,
                contentType: file.contentType,
                size: file.size,
                category: file.category,
              }
            : null,
          links,
          categories,
          createdAt: Timestamp.now(),
          editedAt: null,
          deleted: false,
          fingerprint: digest,
          searchTerms: searchTerms(
            [
              messageText,
              file?.name || "",
              ...links,
              selectedBooking?.reference || "",
              selectedBooking?.title || "",
            ].join(" "),
          ),
        };
        tx.create(ref, value);
        if (attachmentId)
          tx.update(attachments().doc(attachmentId), {
            messageId: ref.id,
            expiresAt: FieldValue.delete(),
          });
        tx.update(conversation, {
          updatedAt: value.createdAt,
          lastMessage:
            messageText.slice(0, 160) || file?.name || selectedBooking?.title || "Message",
          status: "open",
          [a.administrator ? "customerUnread" : "adminUnread"]: FieldValue.increment(1),
        });
      });
      return {message: serialize(await ref.get())};
    }
    if (action === "edit" || action === "delete") {
      const ref = messages().doc(id(body.messageId));
      let fileId: string | null = null;
      await db().runTransaction(async (tx) => {
        const [snap, thread] = await Promise.all([tx.get(ref), tx.get(conversation)]);
        const data = snap.data();
        if (!data || data.customerId !== uid || (!a.administrator && data.senderId !== a.uid))
          throw new HttpsError("permission-denied", "Message unavailable.");
        if (held(data) || held(thread.data() || {}))
          throw new HttpsError("failed-precondition", "This conversation has a retention hold.");
        if (action === "edit") {
          if (data.senderId !== a.uid || data.deleted)
            throw new HttpsError(
              "permission-denied",
              "Only your own active messages can be edited.",
            );
          const value = text(body.text);
          if (!value && !data.attachment && !data.booking)
            throw new HttpsError("invalid-argument", "Message cannot be empty.");
          const links = extractLinks(value);
          tx.update(ref, {
            text: value,
            links,
            categories: [
              ...(data.attachment ? [data.attachment.category] : []),
              ...(links.length ? ["links"] : []),
            ],
            searchTerms: searchTerms(
              [
                value,
                data.attachment?.name || "",
                ...links,
                data.booking?.reference || "",
                data.booking?.title || "",
              ].join(" "),
            ),
            editedAt: Timestamp.now(),
          });
        } else if (!data.deleted) {
          fileId = data.attachment?.id || null;
          tx.update(ref, {
            text: "",
            links: [],
            booking: null,
            attachment: null,
            replyTo: null,
            categories: [],
            searchTerms: [],
            deleted: true,
            deletedAt: Timestamp.now(),
          });
          if (fileId)
            tx.update(attachments().doc(fileId), {deleting: true, expiresAt: Timestamp.now()});
        }
        // Avoid keeping removed/edited text in inbox previews.
        tx.update(conversation, {lastMessage: "Conversation updated"});
      });
      return {success: true};
    }
    if (action === "read" || action === "status") {
      if (action === "status") {
        adminOnly(a);
        if (!["open", "resolved"].includes(body.status))
          throw new HttpsError("invalid-argument", "Invalid conversation status.");
        await conversation.update({status: body.status});
      } else {
        // Client supplies the highest visible incoming timestamp; never blindly clear newer arrivals.
        const through = Number(body.through);
        if (!Number.isFinite(through) || through < 0 || through > Date.now())
          throw new HttpsError(
            "invalid-argument",
            "A valid visible-message timestamp is required.",
          );
        await db().runTransaction(async (tx) => {
          const snap = await tx.get(conversation);
          if (!snap.exists) throw new HttpsError("not-found", "Conversation unavailable.");
          const field = a.administrator ? "adminReadAt" : "customerReadAt";
          const previous = snap.data()?.[field]?.toMillis() || 0;
          if (through > previous)
            tx.update(conversation, {
              [field]: Timestamp.fromMillis(through),
              ...(through >= (snap.data()?.updatedAt?.toMillis() || 0)
                ? {[a.administrator ? "adminUnread" : "customerUnread"]: 0}
                : {}),
            });
        });
      }
      return {success: true};
    }
    if (action === "upload") {
      if (!(await conversation.get()).exists)
        throw new HttpsError("failed-precondition", "Open the conversation before uploading.");
      const file = validatedFile(body.contentBase64, body.contentType);
      const name = text(body.name, 180).replace(/[\\/\x00-\x1f]/g, "_") || "attachment";
      const attachmentId = randomUUID();
      const storagePath = `customer-support-v2/${uid}/${attachmentId}`;
      await admin
        .storage()
        .bucket()
        .file(storagePath)
        .save(file.bytes, {
          resumable: false,
          contentType: file.contentType,
          metadata: {cacheControl: "private, no-store"},
        });
      try {
        await attachments()
          .doc(attachmentId)
          .create({
            customerId: uid,
            uploaderId: a.uid,
            name,
            contentType: file.contentType,
            category: file.category,
            size: file.bytes.length,
            storagePath,
            createdAt: Timestamp.now(),
            expiresAt: Timestamp.fromMillis(Date.now() + 86400000),
            messageId: null,
          });
      } catch (error) {
        await admin.storage().bucket().file(storagePath).delete({ignoreNotFound: true});
        throw error;
      }
      return {
        attachment: {
          id: attachmentId,
          name,
          contentType: file.contentType,
          category: file.category,
          size: file.bytes.length,
        },
      };
    }
    if (action === "download") {
      const file = await attachments().doc(id(body.attachmentId)).get();
      const data = file.data();
      if (!data || data.customerId !== uid || data.deleting || !data.messageId)
        throw new HttpsError("permission-denied", "Attachment unavailable.");
      const message = await messages().doc(data.messageId).get();
      if (!message.exists || message.data()?.deleted || message.data()?.attachment?.id !== file.id)
        throw new HttpsError("permission-denied", "Attachment unavailable.");
      // No reusable public URL is issued. Already downloaded bytes cannot be revoked.
      const [bytes] = await admin.storage().bucket().file(data.storagePath).download();
      return {
        contentBase64: bytes.toString("base64"),
        contentType: data.contentType,
        name: data.name,
      };
    }
    throw new HttpsError("invalid-argument", "Unknown customer chat action.");
  },
);

/** Removes unattached uploads and files whose messages were deleted. */
export const cleanupCustomerChatAttachments = onSchedule(
  {region: "asia-east2", schedule: "every 60 minutes", timeoutSeconds: 300, maxInstances: 1},
  async () => {
    // Match the existing two-year chat policy, preserving held conversations/messages.
    const retentionState = db().doc("customerSupportMaintenance/retention");
    const retentionCursor = (await retentionState.get()).data();
    let retentionQuery: admin.firestore.Query = messages()
      .where("createdAt", "<=", Timestamp.fromMillis(cutoff(new Date(), 2)))
      .orderBy("createdAt")
      .orderBy(FieldPath.documentId());
    if (retentionCursor?.time)
      retentionQuery = retentionQuery.startAfter(
        Timestamp.fromMillis(retentionCursor.time),
        retentionCursor.id,
      );
    const expired = await retentionQuery.limit(200).get();
    for (const document of expired.docs) {
      await db().runTransaction(async (tx) => {
        const [fresh, thread] = await Promise.all([
          tx.get(document.ref),
          tx.get(conversations().doc(document.data().customerId)),
        ]);
        const data = fresh.data();
        if (!data || held(data) || held(thread.data() || {})) return;
        if (data.attachment?.id)
          tx.update(attachments().doc(data.attachment.id), {
            deleting: true,
            expiresAt: Timestamp.now(),
          });
        tx.delete(document.ref);
        if (thread.exists) tx.update(thread.ref, {lastMessage: "Conversation updated"});
      });
    }
    const lastExpired = expired.docs[expired.size - 1];
    await retentionState.set(
      expired.size === 200
        ? {time: lastExpired.data().createdAt.toMillis(), id: lastExpired.id}
        : {time: null},
    );
    const cleanupState = db().doc("customerSupportMaintenance/attachments");
    const cleanupCursor = (await cleanupState.get()).data();
    let cleanupQuery: admin.firestore.Query = attachments()
      .where("expiresAt", "<=", Timestamp.now())
      .orderBy("expiresAt")
      .orderBy(FieldPath.documentId());
    if (cleanupCursor?.time)
      cleanupQuery = cleanupQuery.startAfter(
        Timestamp.fromMillis(cleanupCursor.time),
        cleanupCursor.id,
      );
    const candidates = await cleanupQuery.limit(200).get();
    for (const candidate of candidates.docs) {
      const remove = await db().runTransaction(async (tx) => {
        const [current, thread] = await Promise.all([
          tx.get(candidate.ref),
          tx.get(conversations().doc(candidate.data().customerId)),
        ]);
        const data = current.data();
        if (
          !data ||
          held(data) ||
          held(thread.data() || {}) ||
          (!data.deleting && data.messageId) ||
          !data.expiresAt ||
          data.expiresAt.toMillis() > Date.now()
        )
          return false;
        tx.update(candidate.ref, {deleting: true});
        return true;
      });
      if (remove) {
        await admin
          .storage()
          .bucket()
          .file(candidate.data().storagePath)
          .delete({ignoreNotFound: true});
        await candidate.ref.delete();
      }
    }
    const lastCandidate = candidates.docs[candidates.size - 1];
    await cleanupState.set(
      candidates.size === 200
        ? {time: lastCandidate.data().expiresAt.toMillis(), id: lastCandidate.id}
        : {time: null},
    );
  },
);
