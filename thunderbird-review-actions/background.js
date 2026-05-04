"use strict";

const CONFIG = {
  reviewFolderName: "Review",
  whitelistBookName: "Whitelist",
  trashSendersBookName: "Trash Senders",
  trashTag: "trash"
};

async function getCurrentTab() {
  const [tab] = await messenger.tabs.query({ active: true, currentWindow: true });
  if (!tab) {
    throw new Error("No active Thunderbird tab found.");
  }
  return tab;
}

async function getCurrentMessage() {
  const tab = await getCurrentTab();
  const message = await messenger.messageDisplay.getDisplayedMessage(tab.id);
  if (!message) {
    throw new Error("No displayed message found.");
  }
  return message;
}

async function getCurrentContext() {
  const tab = await getCurrentTab();
  const message = await messenger.messageDisplay.getDisplayedMessage(tab.id);
  if (!message) {
    throw new Error("No displayed message found.");
  }
  return { tab, message };
}

function extractEmailAddress(author) {
  if (!author) {
    throw new Error("Message does not have an author field.");
  }

  const match = author.match(/<([^>]+)>/);
  const email = (match ? match[1] : author).trim().toLowerCase();
  if (!email.includes("@")) {
    throw new Error(`Could not parse sender email from: ${author}`);
  }
  return email;
}

async function getWhitelistAddressBook() {
  const books = await messenger.addressBooks.list(false);
  const book = books.find(candidate => candidate.name === CONFIG.whitelistBookName);
  if (!book) {
    throw new Error(`Address book "${CONFIG.whitelistBookName}" not found.`);
  }
  return book;
}

async function contactExists(addressBookId, email) {
  const contacts = await messenger.contacts.list(addressBookId);
  const needle = email.toLowerCase();
  return contacts.some(contact => {
    const props = contact.properties || {};
    return (props.PrimaryEmail || "").toLowerCase() === needle ||
           (props.SecondEmail || "").toLowerCase() === needle;
  });
}

async function ensureWhitelisted(email, displayName) {
  const book = await getWhitelistAddressBook();
  if (await contactExists(book.id, email)) {
    return { created: false };
  }

  await messenger.contacts.create(book.id, {
    PrimaryEmail: email,
    DisplayName: displayName || email
  });
  return { created: true };
}

async function getTrashSendersAddressBook() {
  const books = await messenger.addressBooks.list(false);
  const existing = books.find(b => b.name === CONFIG.trashSendersBookName);
  if (existing) return existing;

  const id = await messenger.addressBooks.create({ name: CONFIG.trashSendersBookName });
  const updated = await messenger.addressBooks.list(false);
  const created = updated.find(b => b.id === id);
  if (!created) {
    throw new Error(`Address book "${CONFIG.trashSendersBookName}" was not created.`);
  }
  return created;
}

async function ensureInTrashSenders(email, displayName) {
  const book = await getTrashSendersAddressBook();
  if (await contactExists(book.id, email)) {
    return { created: false };
  }

  await messenger.contacts.create(book.id, {
    PrimaryEmail: email,
    DisplayName: displayName || email
  });
  return { created: true };
}

// Returns the Review folder containing this message, or null if not in Review.
// The folder property is not available on MessageHeader in Thunderbird 140,
// so we query the Review folder directly.
async function getReviewFolderFor(messageId, headerMessageId) {
  if (!headerMessageId) return null;
  const allFolders = await messenger.folders.query({});
  const reviewFolders = allFolders.filter(f => f.name === CONFIG.reviewFolderName);
  for (const folder of reviewFolders) {
    const results = await messenger.messages.query({
      folderId: folder.id,
      headerMessageId
    });
    if ((results.messages || []).some(m => m.id === messageId)) {
      return folder;
    }
  }
  return null;
}

async function addTag(messageId, tagKey) {
  const message = await messenger.messages.get(messageId);
  const tags = Array.isArray(message.tags) ? message.tags : [];
  if (tags.includes(tagKey)) {
    return false;
  }

  await messenger.messages.update(messageId, {
    tags: [...tags, tagKey]
  });
  return true;
}

async function findInboxCopies(headerMessageId, excludeId) {
  if (!headerMessageId) return [];
  const allFolders = await messenger.folders.query({});
  const inboxFolders = allFolders.filter(f => f.name.toLowerCase() === "inbox");
  const matches = [];
  for (const folder of inboxFolders) {
    const result = await messenger.messages.query({
      folderId: folder.id,
      headerMessageId
    });
    for (const message of result.messages || []) {
      if (message.id !== excludeId) {
        matches.push(message);
      }
    }
  }
  return matches;
}

async function getReviewMessagesForAdvance(tab, reviewFolder) {
  try {
    await messenger.mailTabs.get(tab.id);
    const selectedFolders = await messenger.mailTabs.getSelectedFolders(tab.id);
    if (selectedFolders.some(f => f.id === reviewFolder.id)) {
      const listed = await messenger.mailTabs.getListedMessages(tab.id);
      return { messages: listed.messages || [], mailTabId: tab.id };
    }
  } catch (e) {
    // The action may be running from a standalone message tab/window instead
    // of the 3-pane mail tab. Fall through to a folder query.
  }

  const [mailTab] = await messenger.mailTabs.query({ active: true, currentWindow: true });
  if (mailTab) {
    try {
      const selectedFolders = await messenger.mailTabs.getSelectedFolders(mailTab.id);
      if (selectedFolders.some(f => f.id === reviewFolder.id)) {
        const listed = await messenger.mailTabs.getListedMessages(mailTab.id);
        return { messages: listed.messages || [], mailTabId: mailTab.id };
      }
    } catch (e) {
      // Try other mail tabs before falling through to an unordered folder query.
    }
  }

  for (const candidate of await messenger.mailTabs.query({})) {
    try {
      const selectedFolders = await messenger.mailTabs.getSelectedFolders(candidate.id);
      if (selectedFolders.some(f => f.id === reviewFolder.id)) {
        const listed = await messenger.mailTabs.getListedMessages(candidate.id);
        return { messages: listed.messages || [], mailTabId: candidate.id };
      }
    } catch (e) {
      // Ignore tabs that cannot provide a Review folder listing.
    }
  }

  const results = await messenger.messages.query({ folderId: reviewFolder.id });
  return { messages: results.messages || [], mailTabId: mailTab?.id || null };
}

// Permanently delete a message from the Review folder and advance the mail
// tab selection to the next (or previous) sibling in that folder.
async function deleteAndAdvance(messageId, reviewFolder, sourceTab) {
  const { messages, mailTabId } = await getReviewMessagesForAdvance(sourceTab, reviewFolder);
  const idx = messages.findIndex(m => m.id === messageId);
  const next = idx !== -1 ? (messages[idx + 1] || messages[idx - 1] || null) : null;

  await messenger.messages.delete([messageId], true);

  if (next && mailTabId) {
    await messenger.mailTabs.setSelectedMessages(mailTabId, [next.id]);
  }

  return { advanced: !!(next && mailTabId) };
}

async function approveSender() {
  const { tab, message } = await getCurrentContext();
  const email = extractEmailAddress(message.author);
  const reviewFolder = await getReviewFolderFor(message.id, message.headerMessageId);

  const whitelistResult = await ensureWhitelisted(email, message.author);

  let advanceResult = null;
  if (reviewFolder) {
    advanceResult = await deleteAndAdvance(message.id, reviewFolder, tab);
  }

  return {
    ok: true,
    action: "approve-sender",
    email,
    created: whitelistResult.created,
    inReview: !!reviewFolder,
    advanced: !!advanceResult?.advanced
  };
}

async function markTrash() {
  const { tab, message } = await getCurrentContext();
  const reviewFolder = await getReviewFolderFor(message.id, message.headerMessageId);

  let senderAdded = null;
  try {
    const email = extractEmailAddress(message.author);
    senderAdded = await ensureInTrashSenders(email, message.author);
  } catch (e) {
    senderAdded = { error: e instanceof Error ? e.message : String(e) };
  }

  if (reviewFolder) {
    const others = await findInboxCopies(message.headerMessageId, message.id);
    let tagged = 0;
    for (const other of others) {
      if (await addTag(other.id, CONFIG.trashTag)) {
        tagged++;
      }
    }
    const advanceResult = await deleteAndAdvance(message.id, reviewFolder, tab);
    return {
      ok: true,
      action: "mark-trash",
      inReview: true,
      tagged,
      senderAdded,
      advanced: advanceResult.advanced
    };
  }

  const tagged = await addTag(message.id, CONFIG.trashTag);
  return {
    ok: true,
    action: "mark-trash",
    inReview: false,
    tagged,
    senderAdded
  };
}

async function getLocalFolders() {
  const accounts = await messenger.accounts.list();
  const localAccount = accounts.find(a => a.type === "none");
  if (!localAccount) return [];
  const folders = await messenger.folders.query({ accountId: localAccount.id });
  const skip = new Set(["trash", "junk", "drafts", "sent", "outbox", "templates"]);
  return folders
    .filter(f => !skip.has(f.type || ""))
    .map(f => {
      const path = f.path || f.name;
      return {
        name: f.name,
        path,
        label: path === f.name ? f.name : `${path} (${f.name})`
      };
    });
}

async function queueDomainBlock(domain) {
  try {
    const response = await messenger.runtime.sendNativeMessage("tbblock", {
      type: "tbblock-add",
      domain
    });
    if (response?.ok) {
      return { queued: true };
    }
    return { queued: false, queueError: response?.error || "Native host returned failure" };
  } catch (e) {
    return { queued: false, queueError: e instanceof Error ? e.message : String(e) };
  }
}

async function markTrashDomain() {
  const { tab, message } = await getCurrentContext();
  const email = extractEmailAddress(message.author);
  const domain = "@" + email.split("@")[1];
  const reviewFolder = await getReviewFolderFor(message.id, message.headerMessageId);

  let senderAdded = null;
  try {
    senderAdded = await ensureInTrashSenders(email, message.author);
  } catch (e) {
    senderAdded = { error: e instanceof Error ? e.message : String(e) };
  }

  const queueResult = await queueDomainBlock(domain);

  if (reviewFolder) {
    const others = await findInboxCopies(message.headerMessageId, message.id);
    let tagged = 0;
    for (const other of others) {
      if (await addTag(other.id, CONFIG.trashTag)) {
        tagged++;
      }
    }
    const advanceResult = await deleteAndAdvance(message.id, reviewFolder, tab);
    return {
      ok: true,
      action: "mark-trash-domain",
      domain,
      inReview: true,
      tagged,
      senderAdded,
      advanced: advanceResult.advanced,
      ...queueResult
    };
  }

  const tagged = await addTag(message.id, CONFIG.trashTag);
  return {
    ok: true,
    action: "mark-trash-domain",
    domain,
    inReview: false,
    tagged,
    senderAdded,
    ...queueResult
  };
}

async function routeDomain(folderName) {
  const message = await getCurrentMessage();
  const email = extractEmailAddress(message.author);
  const domain = "@" + email.split("@")[1];

  let queued = false;
  let queueError = null;
  try {
    const response = await messenger.runtime.sendNativeMessage("tbblock", {
      type: "tbblock-route",
      domain,
      folder: folderName
    });
    if (response?.ok) {
      queued = true;
    } else {
      queueError = response?.error || "Native host returned failure";
    }
  } catch (e) {
    queueError = e instanceof Error ? e.message : String(e);
  }

  return { ok: true, action: "route-domain", domain, folder: folderName, queued, queueError };
}

async function markJunk() {
  const { tab, message } = await getCurrentContext();
  const reviewFolder = await getReviewFolderFor(message.id, message.headerMessageId);

  if (reviewFolder) {
    const others = await findInboxCopies(message.headerMessageId, message.id);
    let marked = 0;
    for (const other of others) {
      await messenger.messages.update(other.id, { junk: true });
      await messenger.messages.delete([other.id], true);
      marked++;
    }
    const advanceResult = await deleteAndAdvance(message.id, reviewFolder, tab);
    return {
      ok: true,
      action: "mark-junk",
      inReview: true,
      marked,
      advanced: advanceResult.advanced
    };
  }

  await messenger.messages.update(message.id, { junk: true });
  await messenger.messages.delete([message.id], true);
  return {
    ok: true,
    action: "mark-junk",
    inReview: false
  };
}

messenger.runtime.onMessage.addListener(async request => {
  try {
    if (request?.type === "get-context") {
      const message = await getCurrentMessage();
      const reviewFolder = await getReviewFolderFor(message.id, message.headerMessageId);
      return {
        ok: true,
        author: message.author,
        subject: message.subject,
        inReview: !!reviewFolder
      };
    }

    if (request?.type === "approve-sender") {
      return await approveSender();
    }

    if (request?.type === "mark-trash") {
      return await markTrash();
    }

    if (request?.type === "mark-trash-domain") {
      return await markTrashDomain();
    }

    if (request?.type === "mark-junk") {
      return await markJunk();
    }

    if (request?.type === "get-local-folders") {
      const folders = await getLocalFolders();
      return { ok: true, folders };
    }

    if (request?.type === "route-domain") {
      if (!request.folder) return { ok: false, error: "No folder specified" };
      return await routeDomain(request.folder);
    }

    return {
      ok: false,
      error: `Unknown request type: ${request?.type}`
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
});
