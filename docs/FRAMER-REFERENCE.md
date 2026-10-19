# Framer reference access and FrameAuth

References supplied by the user:

- https://make-circle-364735.framer.app/
- https://inexpensive-direction-528222.framer.app/

The initial requests from the cloud environment fail at the HTTPS proxy with CONNECT 403. This is a network allowlist issue and is distinct from the user's reported FrameAuth banner. The network draft adds these two hosts and `framerusercontent.com` while retaining existing custom destinations. A saved draft does not activate network access: the user must review/save the environment settings and publish the environment, after which the affected requests must be checked again. Inspect the actual page's remaining asset destinations before requesting further domains.

The public website implementation uses the supplied screenshots until the reference can be inspected. Its motion should not be described as a verified recreation of the live Framer site's animation.

## FrameAuth banner

The published Framer source has not yet been retrieved, so the remaining FrameAuth integration has not been located. Deleting a visible component may leave a script in site-level Custom Code, page-level custom code, a code component or an override. Check those locations for FrameAuth, remove the remaining integration if present, publish the affected pages, and verify in a private window. These are diagnostic steps, not a confirmed remote fix. No changes have been made to the user's Framer project.
