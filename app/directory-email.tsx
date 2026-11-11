"use client";
import { useState } from "react";
import { bccMailto, directoryRecipients, type DirectoryContact } from "../lib/directory-email";

export default function DirectoryEmail({ members }: { members: DirectoryContact[] }) {
  const [group, setGroup] = useState("all");
  const [message, setMessage] = useState("");
  const { addresses, omitted } = directoryRecipients(members, group);
  const text = addresses.join(", ");
  const mailto = bccMailto(addresses);
  async function copy() {
    try { await navigator.clipboard.writeText(text); setMessage("Addresses copied. Paste them into the BCC field of your email."); }
    catch { setMessage("Select and copy the addresses below, then paste them into BCC."); }
  }
  return <details className="directory-email">
    <summary>Email members</summary>
    <div className="directory-email-body">
    <p>Choose a group and review your message before sending. Addresses are placed in BCC.</p>
    <label>Recipients <select value={group} onChange={event => { setGroup(event.target.value); setMessage(""); }}>
      <option value="all">All members</option><option value="Full member">Full members</option><option value="Social member">Social members</option>
    </select></label>
    <p>{addresses.length} unique recipient{addresses.length === 1 ? "" : "s"}; {omitted} record{omitted === 1 ? "" : "s"} without a usable email address.</p>
    {addresses.length > 0 ? <>
      {mailto ? <a className="outline" href={mailto}>Open BCC email</a> : <p>This list is too long to open safely in an email app. Copy it into BCC instead.</p>}{" "}
      <button type="button" onClick={() => void copy()}>Copy email addresses</button>
      <label>BCC addresses (select and copy if needed)<textarea readOnly value={text} rows={3} onFocus={event => event.currentTarget.select()} /></label>
      <p>If no email app opens, copy the addresses and paste them into its BCC field.</p>
    </> : <p>No usable email addresses in this group.</p>}
    <p role="status">{message}</p>
    </div>
  </details>;
}
