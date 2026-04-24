"use strict";

const summary = document.getElementById("summary");
const folder = document.getElementById("folder");
const status = document.getElementById("status");
const approveButton = document.getElementById("approve");
const trashSenderButton = document.getElementById("trash-sender");
const trashDomainButton = document.getElementById("trash-domain");
const junkButton = document.getElementById("junk");

const ALL_BUTTONS = [approveButton, trashSenderButton, trashDomainButton, junkButton];

function setStatus(message, isError = false) {
  status.textContent = message;
  status.className = isError ? "error" : "";
}

async function loadContext() {
  const response = await messenger.runtime.sendMessage({ type: "get-context" });
  if (!response?.ok) {
    setStatus(response?.error || "Failed to load message context.", true);
    ALL_BUTTONS.forEach(b => { b.disabled = true; });
    return;
  }

  summary.textContent = response.author || "(unknown sender)";
  folder.textContent = response.inReview ? "Review folder — workflow active" : "";
}

async function runAction(type) {
  ALL_BUTTONS.forEach(b => { b.disabled = true; });
  setStatus("Working…");

  const response = await messenger.runtime.sendMessage({ type });
  if (!response?.ok) {
    setStatus(response?.error || "Action failed.", true);
    ALL_BUTTONS.forEach(b => { b.disabled = false; });
    return;
  }

  if (type === "approve-sender") {
    const whitelisted = response.created ? "Sender added to Whitelist." : "Sender already in Whitelist.";
    const deleted = response.inReview ? " Review copy deleted." : "";
    setStatus(whitelisted + deleted);

  } else if (type === "mark-trash") {
    const sa = response.senderAdded;
    const recorded = sa?.created ? " Sender added to Trash Senders."
                   : sa?.created === false ? " Sender already in Trash Senders."
                   : sa?.error ? ` Sender was not recorded: ${sa.error}`
                   : "";
    if (response.inReview) {
      const tagged = response.tagged > 0
        ? "Inbox copy tagged as trash."
        : "Inbox copy not found or already tagged.";
      setStatus(tagged + recorded + " Review copy deleted.");
    } else {
      setStatus((response.tagged ? "Trash tag added." : "Message already has Trash tag.") + recorded);
    }

  } else if (type === "mark-trash-domain") {
    const domain = response.domain || "(unknown domain)";
    const sa = response.senderAdded;
    const recorded = sa?.created ? " Sender added to Trash Senders."
                   : sa?.created === false ? " Sender already in Trash Senders."
                   : sa?.error ? ` Sender was not recorded: ${sa.error}`
                   : "";
    const domainNote = `Run: tbblock --add ${domain}`;
    if (response.inReview) {
      const tagged = response.tagged > 0
        ? "Inbox copy tagged as trash."
        : "Inbox copy not found or already tagged.";
      setStatus(tagged + recorded + " Review copy deleted. " + domainNote);
    } else {
      setStatus((response.tagged ? "Trash tag added." : "Message already has Trash tag.") + recorded + " " + domainNote);
    }

  } else if (type === "mark-junk") {
    if (response.inReview) {
      const marked = response.marked > 0
        ? "Inbox copy marked as junk and deleted."
        : "Inbox copy not found.";
      setStatus(marked + " Review copy deleted.");
    } else {
      setStatus("Message marked as junk and deleted.");
    }

  } else {
    setStatus("Action completed.");
  }
}

approveButton.addEventListener("click", () => runAction("approve-sender"));
trashSenderButton.addEventListener("click", () => runAction("mark-trash"));
trashDomainButton.addEventListener("click", () => runAction("mark-trash-domain"));
junkButton.addEventListener("click", () => runAction("mark-junk"));

loadContext().catch(error => {
  setStatus(error instanceof Error ? error.message : String(error), true);
  ALL_BUTTONS.forEach(b => { b.disabled = true; });
});
