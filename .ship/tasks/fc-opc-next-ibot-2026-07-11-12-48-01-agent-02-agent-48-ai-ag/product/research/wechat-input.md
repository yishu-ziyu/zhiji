# WeChat input feasibility - official capability check

Checked on 2026-07-13 against Tencent's official developer documentation.

## Decision-relevant conclusion

The reviewed official APIs do **not** provide a general-purpose way for a third-party product to read an OPC user's arbitrary personal WeChat chat history.

There are official integration paths, but each changes the product scene:

| Route | What it can do | Hard constraint | Fit for the current candidate user |
|---|---|---|---|
| WeCom conversation archive | An enterprise can retrieve archived work conversations, including eligible external-contact conversations | The enterprise administrator configures the archived employee scope, IP and encryption key; employees are notified; external-contact content requires the external contact's consent | Strong ingestion, weak fit for a personal-WeChat-first solo operator |
| Mini Program “open chat material” | A user can open a chat image, file, video or article with an approved Mini Program | The user must have used the Mini Program before; the material handler must pass review; the official page does not expose arbitrary text-message history | Plausible mobile entry for screenshots and files, not automatic chat capture |
| Mini Program chat-tool mode | A bound Mini Program can identify the selected chat/member through opaque IDs and send cards, reminders, text, images and files into that chat | Access is restricted to Mini Programs with transaction protection or specified social/financial categories and requires review; the documentation does not grant read access to prior messages | Potentially useful for sending actions back, not for ingesting existing conversation content |
| Mini Program customer-service messages | Receives messages/events that a user deliberately sends in the Mini Program's customer-service conversation | It is a separate customer-service conversation, not the user's existing client chats | A forwarding inbox is possible, but it moves the conversation |

## What the official documents establish

### 1. WeCom is the only reviewed official path that retrieves conversation records

The WeCom overview says the archive exists for service quality, collaboration and compliance. A business chooses which employees are archived and retrieves those employees' work communications by API.

The setup guide adds the conditions that matter to this product:

- the administrator configures the archived scope, calling IP and encryption public key;
- archived employees are informed;
- messages between an archived and a non-archived employee can be retrieved, but messages only between non-archived employees cannot;
- external-contact conversations require the external contact's consent.

The retrieval reference uses an enterprise SDK, administrator-issued corporation credentials and the conversation-archive secret. It is therefore not a frictionless personal-WeChat connector.

Sources: [WeCom conversation archive overview](https://developer.work.weixin.qq.com/document/path/91360), [setup and consent requirements](https://developer.work.weixin.qq.com/document/path/91361), [retrieval API](https://developer.work.weixin.qq.com/document/path/91774).

### 2. A Mini Program can receive selected chat materials, not the whole chat

WeChat's “chat material open” capability supports files, images, videos and web pages/articles. The user chooses the Mini Program from the material's open-with entry. The Mini Program must declare the material type, pass review and provide meaningful processing. The page lists `text/plain` for `.txt` files; it does not say ordinary text messages or chat history can be handed to the Mini Program.

This creates one credible mobile-first input experiment: select or screenshot the relevant messages, then open the screenshot/file directly with the Mini Program. It removes the cross-device transfer, but it is still an intentional user action.

Source: [WeChat Mini Program chat-material opening](https://developers.weixin.qq.com/miniprogram/dev/framework/material/support_material.html).

### 3. Chat-tool mode is an output/context bridge, not a chat-history reader

The current chat-tool documentation supports binding to a single/group chat, receiving opaque chat/member identifiers, selecting members and sending cards, reminders, text, images and files back to the chat. The current access rule limits applications to transaction-protected Mini Programs or specified social/financial categories and requires review. Neither the current open-mode page nor the earlier Beta guide documents reading prior chat messages.

Sources: [current chat-tool open mode](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/chatToolOpenMode.html), [earlier chat-tool Beta guide](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/chatTool.html).

### 4. Customer-service messages only cover messages sent to the Mini Program

The customer-message capability lets a Mini Program receive messages and events sent in its own customer-service session. It cannot silently import an unrelated client conversation.

Source: [WeChat Mini Program customer messages](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/customer-message/customer-message.html).

## Product consequence

“Automatically read all of a solo operator's personal WeChat client chats” is not a defensible MVP assumption.

The viable input experiments, ordered by fit with the current target scene, are:

1. **Mobile screenshot/file import into a Mini Program.** It stays on the phone and uses an official WeChat handoff, but extraction quality and review eligibility must be tested.
2. **Desktop WeChat copy into a Web app.** It is technically trivial and acceptable when the user already works on desktop, but it does not solve mobile-only friction.
3. **A deliberate forwarding inbox.** It avoids cross-device transfer but adds a separate conversation and still requires the user to choose what to forward.
4. **WeCom conversation archive.** It becomes attractive only if the target user already conducts client work through WeCom and accepts enterprise setup and consent.

The entry path cannot be chosen from technical possibility alone. We first need real usage evidence for: device, message format, number of relevant messages, privacy constraints and whether the user is willing to select the relevant evidence. Until then, “no copy-paste” is a product goal, not a proven requirement or solved capability.

## Unknowns and next evidence

- No reviewed official page answers whether a merged personal-WeChat chat record can be handed to an ordinary Mini Program. Do not claim it can.
- No user-behaviour evidence yet compares screenshot import, desktop copy and forwarding.
- No evidence yet shows that target users use WeCom often enough to justify the enterprise archive path.
- Unofficial desktop hooks, local database readers or UI automation were intentionally excluded here; they require a separate security, stability and platform-policy review before consideration.
