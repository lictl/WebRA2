# Campaign launch preparation provenance

`src/campaign-launch.ts` and `src/campaign-launch-source.ts` are original WebRA2
GPL-3.0-or-later implementations. They compose existing bounded catalog, INI and
CSF readers and the canonical fingerprint helper. The reader follows the explicit
standard-definition mount policy in `installation-profile.ts`; this is a WebRA2
policy and does not newly establish native archive precedence.

The pinned YRpp [CampaignClass header](https://github.com/Phobos-developers/YRpp/blob/9402d7da0fe14d46703ba871ce3e6b3cde855bfc/CampaignClass.h)
and [Theater header](https://github.com/Phobos-developers/YRpp/blob/9402d7da0fe14d46703ba871ce3e6b3cde855bfc/Theater.h)
provided address/layout leads. No YRpp implementation is copied. Read-only checks
of both pinned reference executables independently establish the named campaign
button lookup, CampaignClass `Scenario` consumer, map theater lookup and filename
construction. See [the focused report](../../docs/campaign-chooser.md).

Original tests use fabricated mission names, INI rows and strings. Retail source
bytes, extracted text, maps, disassembly, screenshots and saved games remain in
ignored `local/`; none are distributed with the app. Runtime localized strings
are read from files selected on the user's own device.
