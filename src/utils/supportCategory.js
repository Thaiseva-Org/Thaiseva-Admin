export function messageCategory(message) {
  if (message?.deleted || (message?.type !== "heading" && message?.legacyType !== "heading")) return "";
  const value = message.category || message.text;
  return typeof value === "string" ? value.trim() : "";
}

export function currentChatCategory(conversation, messages = []) {
  if (typeof conversation?.currentCategory === "string" && conversation.currentCategory.trim()) return conversation.currentCategory.trim();
  return messages.filter(message => !conversation?.customerId || message.customerId === conversation.customerId)
    .sort((a, b) => Number(b.createdAt) - Number(a.createdAt)).map(messageCategory).find(Boolean) || "";
}
